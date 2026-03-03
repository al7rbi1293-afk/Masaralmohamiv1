import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getMatterById } from '@/lib/matters';
import { getCurrentAuthUser } from '@/lib/supabase/auth-session';
import { requireOrgIdForUser } from '@/lib/org';
import { createSupabaseRlsUserClient } from '@/lib/supabase/rls-user-client';
import { getCopilotEnv, isMissingEnvError } from '@/lib/env';
import { logError } from '@/lib/logger';
import {
  buildFallbackCitations,
  copilotRequestSchema,
  copilotResponseSchema,
  defaultFailureResponse,
  sanitizeAndValidateCitations,
  type CopilotRequest,
  type CopilotResponse,
  type CopilotSource,
} from '@/lib/copilot/schema';
import { buildCopilotUserPrompt, buildRepairPrompt, COPILOT_SYSTEM_PROMPT } from '@/lib/copilot/prompts';
import { chooseModelForIntent, inferIntentHeuristically } from '@/lib/copilot/routing';
import { retrieveSources, normalizeCopilotQuery, extractQuotedTerms } from '@/lib/copilot/retrieval';
import { selectBuiltInLegalReferences } from '@/lib/copilot/legal-references';
import {
  buildScopedCacheKey,
  getCachePayload,
  stableHash,
  upsertCachePayload,
} from '@/lib/copilot/cache';
import { consumeRequestQuota, addTokenUsage } from '@/lib/copilot/quota';
import { consumeCopilotRateLimit } from '@/lib/copilot/rate-limit';
import { insertCopilotAuditLog } from '@/lib/copilot/audit';
import {
  classifyIntentWithModel,
  createEmbedding,
  generateJsonResponse,
  getOpenAiClient,
} from '@/lib/copilot/openai';
import { fitSourcesIntoBudget, getBudgetForModel } from '@/lib/copilot/token-budget';

export const runtime = 'nodejs';

type CachedRetrievalPayload = {
  sources: any[];
  caseBrief: string | null;
};

type CachedAnswerPayload = {
  response: CopilotResponse;
};

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  const requestId = randomUUID();
  const env = getCopilotEnv();

  try {
  const origin = request.headers.get('origin');
  if (origin) {
    try {
      const originHost = new URL(origin).host;
      if (originHost !== request.nextUrl.host) {
        return NextResponse.json(
          defaultFailureResponse({
            model: env.midModel,
            latencyMs: Date.now() - startedAt,
            message: 'Origin غير مسموح لهذا الطلب.',
          }),
          { status: 403 },
        );
      }
    } catch {
      return NextResponse.json(
        defaultFailureResponse({
          model: env.midModel,
          latencyMs: Date.now() - startedAt,
          message: 'Origin غير صالح.',
        }),
        { status: 403 },
      );
    }
  }

  const user = await getCurrentAuthUser();
  if (!user) {
    return NextResponse.json(
      defaultFailureResponse({
        model: env.midModel,
        latencyMs: Date.now() - startedAt,
        message: 'يرجى تسجيل الدخول لاستخدام المساعد القانوني.',
      }),
      { status: 401 },
    );
  }

  let orgId = '';
  try {
    orgId = await requireOrgIdForUser();
  } catch {
    return NextResponse.json(
      defaultFailureResponse({
        model: env.midModel,
        latencyMs: Date.now() - startedAt,
        message: 'لا يوجد مكتب مفعّل لهذا الحساب.',
      }),
      { status: 403 },
    );
  }

  const payload = copilotRequestSchema.safeParse(await request.json().catch(() => null));
  if (!payload.success) {
    return NextResponse.json(
      defaultFailureResponse({
        model: env.midModel,
        latencyMs: Date.now() - startedAt,
        message: payload.error.issues[0]?.message || 'بيانات الطلب غير صالحة.',
      }),
      { status: 400 },
    );
  }

  const rls = await createSupabaseRlsUserClient(user.id);
  const parsed = payload.data;

  const { data: matterByRls, error: matterError } = await rls
    .from('matters')
    .select('id, title, is_private, case_type')
    .eq('org_id', orgId)
    .eq('id', parsed.case_id)
    .maybeSingle();

  let matter = matterByRls as
    | {
        id: string;
        title: string;
        is_private: boolean;
        case_type: string | null;
      }
    | null;

  if (matterError) {
    logError('copilot_case_lookup_failed', { message: matterError.message, requestId });
  }

  // Keep the access decision aligned with the matter page when RLS lookup fails
  // or returns no rows for legacy private-matter assignments.
  if (!matter) {
    const fallbackMatter = await getMatterById(parsed.case_id).catch((error) => {
      logError('copilot_case_lookup_fallback_failed', {
        requestId,
        message: error instanceof Error ? error.message : String(error),
      });
      return null;
    });

    if (fallbackMatter && fallbackMatter.org_id === orgId) {
      matter = {
        id: fallbackMatter.id,
        title: fallbackMatter.title,
        is_private: fallbackMatter.is_private,
        case_type: fallbackMatter.case_type ?? null,
      };
    }
  }

  if (!matter && matterError) {
    return NextResponse.json(
      defaultFailureResponse({
        model: env.midModel,
        latencyMs: Date.now() - startedAt,
        message: 'تعذر التحقق من صلاحية الوصول إلى القضية.',
      }),
      { status: 400 },
    );
  }

  if (!matter) {
    const forbiddenResponse = defaultFailureResponse({
      model: env.midModel,
      latencyMs: Date.now() - startedAt,
      message: 'لا تملك صلاحية الوصول إلى هذه القضية.',
    });
    await safeAudit(rls, {
      requestId,
      orgId,
      userId: user.id,
      caseId: parsed.case_id,
      status: 'forbidden',
      model: env.midModel,
      cached: false,
      inputTokens: 0,
      outputTokens: 0,
      latencyMs: Date.now() - startedAt,
      errorCode: 'forbidden',
      errorMessage: 'case_access_denied',
    });
    return NextResponse.json(forbiddenResponse, { status: 403 });
  }

  const rate = await consumeCopilotRateLimit({
    supabase: rls,
    orgId,
    limit: env.rateLimitPerMinute,
    windowSeconds: 60,
  }).catch((error) => {
    logError('copilot_rate_limit_error', {
      requestId,
      message: error instanceof Error ? error.message : String(error),
    });
    return { allowed: true, currentCount: 0, resetAt: new Date(Date.now() + 60_000).toISOString() };
  });

  if (!rate.allowed) {
    const response = defaultFailureResponse({
      model: env.midModel,
      latencyMs: Date.now() - startedAt,
      message: 'تم تجاوز حد الطلبات في الدقيقة. حاول مرة أخرى بعد دقيقة.',
    });
    await safeAudit(rls, {
      requestId,
      orgId,
      userId: user.id,
      caseId: parsed.case_id,
      status: 'rate_limited',
      model: env.midModel,
      cached: false,
      inputTokens: 0,
      outputTokens: 0,
      latencyMs: Date.now() - startedAt,
      errorCode: 'rate_limited',
      errorMessage: `reset_at:${rate.resetAt}`,
    });
    return NextResponse.json(response, { status: 429 });
  }

  const quota = await consumeRequestQuota({
    supabase: rls,
    orgId,
    requestsLimit: env.requestsMonthlyDefault,
    tokensLimit: env.tokensMonthlyDefault,
  });

  if (!quota.allowed) {
    const response = defaultFailureResponse({
      model: env.midModel,
      latencyMs: Date.now() - startedAt,
      message: 'تم استهلاك الحصة الشهرية للمساعد القانوني. يرجى ترقية الخطة أو الانتظار للشهر القادم.',
    });
    await safeAudit(rls, {
      requestId,
      orgId,
      userId: user.id,
      caseId: parsed.case_id,
      status: 'quota_exceeded',
      model: env.midModel,
      cached: false,
      inputTokens: 0,
      outputTokens: 0,
      latencyMs: Date.now() - startedAt,
      errorCode: 'quota_exceeded',
      errorMessage: `requests_used:${quota.requestsUsed},tokens_used:${quota.tokensUsed}`,
    });
    return NextResponse.json(response, { status: 429 });
  }

  const normalizedQuery = normalizeCopilotQuery(parsed.message);
  const queryHash = stableHash(normalizedQuery);

  const answerCacheKey = buildScopedCacheKey({
    base: `answer:${queryHash}:${parsed.template ?? 'none'}`,
    orgId,
    userId: user.id,
    caseId: parsed.case_id,
  });

  if (!parsed.options?.disable_answer_cache) {
    const cachedAnswer = await getCachePayload<CachedAnswerPayload>({
      supabase: rls,
      orgId,
      cacheType: 'answer',
      cacheKey: answerCacheKey,
    }).catch(() => null);

    if (cachedAnswer?.response) {
      const cached = {
        ...cachedAnswer.response,
        meta: {
          ...cachedAnswer.response.meta,
          cached: true,
          latency_ms: Date.now() - startedAt,
        },
      };

      const validated = copilotResponseSchema.safeParse(cached);
      if (validated.success) {
        const sessionId = await ensureSession(rls, {
          orgId,
          caseId: parsed.case_id,
          userId: user.id,
          inputSessionId: parsed.session_id,
          initialTitle: normalizedQuery.slice(0, 100),
        });

        const userMessageId = await insertMessage(rls, {
          orgId,
          caseId: parsed.case_id,
          userId: user.id,
          sessionId,
          role: 'user',
          messageMarkdown: normalizedQuery,
          citations: [],
          model: null,
          tokenInput: 0,
          tokenOutput: 0,
          latencyMs: null,
        });

        const assistantMessageId = await insertMessage(rls, {
          orgId,
          caseId: parsed.case_id,
          userId: user.id,
          sessionId,
          role: 'assistant',
          messageMarkdown: validated.data.answer_markdown,
          citations: validated.data.citations,
          model: validated.data.meta.model,
          tokenInput: 0,
          tokenOutput: 0,
          latencyMs: validated.data.meta.latency_ms,
        });

        await safeAudit(rls, {
          requestId,
          orgId,
          userId: user.id,
          caseId: parsed.case_id,
          sessionId,
          messageId: assistantMessageId || userMessageId,
          status: 'ok',
          model: validated.data.meta.model,
          cached: true,
          inputTokens: 0,
          outputTokens: 0,
          latencyMs: Date.now() - startedAt,
          meta: { cache_hit: 'answer' },
        });

        const response = NextResponse.json(validated.data, { status: 200 });
        response.headers.set('x-copilot-session-id', sessionId);
        response.headers.set('x-copilot-request-id', requestId);
        return response;
      }
    }
  }

  const openAiApiKey = process.env.OPENAI_API_KEY?.trim();
  if (!openAiApiKey) {
    return await respondWithLocalFallback({
      rls,
      env,
      requestId,
      startedAt,
      orgId,
      userId: user.id,
      parsed,
      normalizedQuery,
      caseType: typeof (matter as any).case_type === 'string' ? String((matter as any).case_type) : null,
      isRestrictedCase: Boolean((matter as any).is_private),
    });
  }

  const openai = getOpenAiClient(openAiApiKey);

  const embeddingCacheKey = buildScopedCacheKey({
    base: `embedding:${queryHash}`,
    orgId,
    userId: user.id,
    caseId: parsed.case_id,
  });

  const retrievalCacheKey = buildScopedCacheKey({
    base: `retrieval:${queryHash}`,
    orgId,
    userId: user.id,
    caseId: parsed.case_id,
  });

  let embedding = await getCachePayload<number[]>({
    supabase: rls,
    orgId,
    cacheType: 'embedding',
    cacheKey: embeddingCacheKey,
  }).catch(() => null);

  if (!embedding) {
    embedding = await createEmbedding(openai, env.embeddingModel, normalizedQuery);
    await upsertCachePayload({
      supabase: rls,
      orgId,
      userId: user.id,
      caseId: parsed.case_id,
      cacheType: 'embedding',
      cacheKey: embeddingCacheKey,
      payload: embedding,
      ttlSeconds: env.retrievalCacheTtlSec,
    }).catch(() => undefined);
  }

  let retrieval = await getCachePayload<CachedRetrievalPayload>({
    supabase: rls,
    orgId,
    cacheType: 'retrieval',
    cacheKey: retrievalCacheKey,
  }).catch(() => null);

  if (!retrieval) {
    const keywordTerms = extractQuotedTerms(normalizedQuery);
    retrieval = await retrieveSources({
      supabase: rls,
      orgId,
      caseId: parsed.case_id,
      query: normalizedQuery,
      caseType: typeof (matter as any).case_type === 'string' ? String((matter as any).case_type) : null,
      embedding,
      caseTopK: env.caseTopK,
      kbTopK: env.kbTopK,
      builtInKbTopK: env.kbTopK,
      minSimilarity: 0.45,
      keywordTerms,
    });

    await upsertCachePayload({
      supabase: rls,
      orgId,
      userId: user.id,
      caseId: parsed.case_id,
      cacheType: 'retrieval',
      cacheKey: retrievalCacheKey,
      payload: retrieval,
      ttlSeconds: env.retrievalCacheTtlSec,
    }).catch(() => undefined);
  }

  const heuristicIntent = inferIntentHeuristically(parsed);
  const intent =
    heuristicIntent === 'ambiguous'
      ? await classifyIntentWithModel({
          openai,
          model: env.midModel,
          message: normalizedQuery,
        }).catch(() => 'qna' as const)
      : heuristicIntent;

  const routedModel = chooseModelForIntent({
    intent,
    sources: retrieval.sources,
    midModel: env.midModel,
    strongModel: env.strongModel,
  });

  const budgetedSources = fitSourcesIntoBudget({
    sources: retrieval.sources,
    modelBudget: getBudgetForModel(routedModel, env.midModel),
    promptOverheadTokens: 900,
  }).slice(0, env.maxSources);

  const basePrompt = buildCopilotUserPrompt({
    request: parsed,
    sources: budgetedSources,
    caseBrief: retrieval.caseBrief,
    sourceCap: env.maxSources,
  });

  let inputTokens = 0;
  let outputTokens = 0;

  const primaryGeneration = await generateJsonResponse({
    openai,
    model: routedModel,
    systemPrompt: COPILOT_SYSTEM_PROMPT,
    userPrompt: basePrompt,
  });

  inputTokens += primaryGeneration.inputTokens;
  outputTokens += primaryGeneration.outputTokens;

  let parsedResponse = parseCopilotResponse(primaryGeneration.raw);
  let validation = parsedResponse ? copilotResponseSchema.safeParse(parsedResponse) : null;

  if (!validation?.success) {
    const repairGeneration = await generateJsonResponse({
      openai,
      model: routedModel,
      systemPrompt: COPILOT_SYSTEM_PROMPT,
      userPrompt: buildRepairPrompt({
        previousOutput: primaryGeneration.raw,
        validationError: validation?.error?.message || 'invalid_json',
        originalPrompt: basePrompt,
      }),
      temperature: 0,
    }).catch(() => null);

    if (repairGeneration) {
      inputTokens += repairGeneration.inputTokens;
      outputTokens += repairGeneration.outputTokens;
      parsedResponse = parseCopilotResponse(repairGeneration.raw);
      validation = parsedResponse ? copilotResponseSchema.safeParse(parsedResponse) : null;
    }
  }

  const sessionId = await ensureSession(rls, {
    orgId,
    caseId: parsed.case_id,
    userId: user.id,
    inputSessionId: parsed.session_id,
    initialTitle: normalizedQuery.slice(0, 100),
  });

  const userMessageId = await insertMessage(rls, {
    orgId,
    caseId: parsed.case_id,
    userId: user.id,
    sessionId,
    role: 'user',
    messageMarkdown: normalizedQuery,
    citations: [],
    model: null,
    tokenInput: 0,
    tokenOutput: 0,
    latencyMs: null,
  });

  if (!validation?.success) {
    const fallback = defaultFailureResponse({
      model: routedModel,
      latencyMs: Date.now() - startedAt,
      message:
        'تعذر توليد نتيجة صالحة بنيويًا. تمت حماية الطلب وإيقاف المخرجات غير الموثوقة. حاول إعادة الصياغة.',
    });

    const assistantMessageId = await insertMessage(rls, {
      orgId,
      caseId: parsed.case_id,
      userId: user.id,
      sessionId,
      role: 'assistant',
      messageMarkdown: fallback.answer_markdown,
      citations: [],
      model: routedModel,
      tokenInput: inputTokens,
      tokenOutput: outputTokens,
      latencyMs: Date.now() - startedAt,
    });

    await addTokenUsage({
      supabase: rls,
      orgId,
      tokenInc: inputTokens + outputTokens,
    }).catch(() => undefined);

    await safeAudit(rls, {
      requestId,
      orgId,
      userId: user.id,
      caseId: parsed.case_id,
      sessionId,
      messageId: assistantMessageId || userMessageId,
      status: 'validation_failed',
      model: routedModel,
      intent,
      cached: false,
      inputTokens,
      outputTokens,
      latencyMs: Date.now() - startedAt,
      errorCode: 'invalid_json',
      errorMessage: validation?.error?.message || 'invalid_json',
    });

    const response = NextResponse.json(fallback, { status: 502 });
    response.headers.set('x-copilot-session-id', sessionId);
    response.headers.set('x-copilot-request-id', requestId);
    return response;
  }

  const sourceMap = new Map(budgetedSources.map((source) => [source.chunkId, source]));
  const strictCitations = sanitizeAndValidateCitations(validation.data.citations, sourceMap);
  const citations = strictCitations.length ? strictCitations : buildFallbackCitations(budgetedSources);

  const finalResponse: CopilotResponse = {
    ...validation.data,
    citations,
    meta: {
      model: routedModel,
      latency_ms: Date.now() - startedAt,
      cached: false,
    },
  };

  const assistantMessageId = await insertMessage(rls, {
    orgId,
    caseId: parsed.case_id,
    userId: user.id,
    sessionId,
    role: 'assistant',
    messageMarkdown: finalResponse.answer_markdown,
    citations: finalResponse.citations,
    model: routedModel,
    tokenInput: inputTokens,
    tokenOutput: outputTokens,
    latencyMs: Date.now() - startedAt,
  });

  await addTokenUsage({
    supabase: rls,
    orgId,
    tokenInc: inputTokens + outputTokens,
  }).catch(() => undefined);

  await upsertCachePayload({
    supabase: rls,
    orgId,
    userId: user.id,
    caseId: parsed.case_id,
    cacheType: 'answer',
    cacheKey: answerCacheKey,
    payload: {
      response: finalResponse,
    } satisfies CachedAnswerPayload,
    ttlSeconds: env.answerCacheTtlSec,
  }).catch(() => undefined);

  await safeAudit(rls, {
    requestId,
    orgId,
    userId: user.id,
    caseId: parsed.case_id,
    sessionId,
    messageId: assistantMessageId || userMessageId,
    status: 'ok',
    model: routedModel,
    intent,
    cached: false,
    inputTokens,
    outputTokens,
    latencyMs: Date.now() - startedAt,
    meta: {
      source_count: budgetedSources.length,
      is_restricted_case: Boolean((matter as any).is_private),
      template: parsed.template ?? null,
    },
  });

  const response = NextResponse.json(finalResponse, { status: 200 });
  response.headers.set('x-copilot-session-id', sessionId);
  response.headers.set('x-copilot-request-id', requestId);
  return response;
  } catch (error) {
    const safeMessage = mapCopilotInternalErrorToMessage(error);
    logError('copilot_unhandled_error', {
      requestId,
      message: error instanceof Error ? error.message : String(error),
    });

    const response = NextResponse.json(
      defaultFailureResponse({
        model: env.midModel,
        latencyMs: Date.now() - startedAt,
        message: safeMessage,
      }),
      { status: 500 },
    );
    response.headers.set('x-copilot-request-id', requestId);
    return response;
  }
}

function parseCopilotResponse(raw: string): unknown | null {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function ensureSession(
  supabase: Awaited<ReturnType<typeof createSupabaseRlsUserClient>>,
  params: {
    orgId: string;
    caseId: string;
    userId: string;
    inputSessionId?: string;
    initialTitle: string;
  },
): Promise<string> {
  if (params.inputSessionId) {
    const { data, error } = await supabase
      .from('copilot_sessions')
      .select('id')
      .eq('id', params.inputSessionId)
      .eq('org_id', params.orgId)
      .eq('case_id', params.caseId)
      .eq('user_id', params.userId)
      .maybeSingle();

    if (!error && data) {
      const updateResult = await supabase
        .from('copilot_sessions')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', params.inputSessionId);
      if (updateResult.error) {
        logError('copilot_session_touch_failed', { message: updateResult.error.message });
      }
      return String((data as any).id);
    }
  }

  const { data, error } = await supabase
    .from('copilot_sessions')
    .insert({
      org_id: params.orgId,
      case_id: params.caseId,
      user_id: params.userId,
      title: params.initialTitle.slice(0, 100),
      last_message_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error || !data) {
    throw new Error(`create_session_failed:${error?.message ?? 'unknown'}`);
  }

  return String((data as any).id);
}

async function insertMessage(
  supabase: Awaited<ReturnType<typeof createSupabaseRlsUserClient>>,
  params: {
    orgId: string;
    caseId: string;
    userId: string;
    sessionId: string;
    role: 'user' | 'assistant' | 'system';
    messageMarkdown: string;
    citations: unknown;
    model: string | null;
    tokenInput: number;
    tokenOutput: number;
    latencyMs: number | null;
  },
): Promise<string | null> {
  const { data, error } = await supabase
    .from('copilot_messages')
    .insert({
      org_id: params.orgId,
      case_id: params.caseId,
      user_id: params.userId,
      session_id: params.sessionId,
      role: params.role,
      message_markdown: params.messageMarkdown,
      citations: params.citations,
      model: params.model,
      token_input: params.tokenInput,
      token_output: params.tokenOutput,
      latency_ms: params.latencyMs,
    })
    .select('id')
    .single();

  if (error) {
    logError('copilot_message_insert_failed', { message: error.message, role: params.role });
    return null;
  }

  const updateResult = await supabase
    .from('copilot_sessions')
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', params.sessionId);
  if (updateResult.error) {
    logError('copilot_session_touch_failed', { message: updateResult.error.message });
  }

  return String((data as any).id);
}

async function safeAudit(
  supabase: Awaited<ReturnType<typeof createSupabaseRlsUserClient>>,
  params: Omit<Parameters<typeof insertCopilotAuditLog>[0], 'supabase'>,
) {
  await insertCopilotAuditLog({
    supabase,
    ...params,
  }).catch((error) => {
    logError('copilot_audit_insert_failed', {
      message: error instanceof Error ? error.message : String(error),
      requestId: params.requestId,
    });
  });
}

async function respondWithLocalFallback(params: {
  rls: Awaited<ReturnType<typeof createSupabaseRlsUserClient>>;
  env: ReturnType<typeof getCopilotEnv>;
  requestId: string;
  startedAt: number;
  orgId: string;
  userId: string;
  parsed: CopilotRequest;
  normalizedQuery: string;
  caseType: string | null;
  isRestrictedCase: boolean;
}): Promise<NextResponse> {
  let caseBrief: string | null = null;
  let briefResult: { data?: unknown; error?: unknown } | null = null;
  try {
    briefResult = await params.rls
      .from('case_briefs')
      .select('brief_markdown')
      .eq('org_id', params.orgId)
      .eq('case_id', params.parsed.case_id)
      .maybeSingle();
  } catch {
    briefResult = null;
  }

  if (briefResult && !briefResult.error && (briefResult.data as any)?.brief_markdown) {
    caseBrief = String((briefResult.data as any).brief_markdown);
  }

  const kbSources = selectBuiltInLegalReferences({
    query: params.normalizedQuery,
    caseType: params.caseType,
    limit: params.env.kbTopK,
  });

  const briefSources: CopilotSource[] = caseBrief
    ? [
        {
          chunkId: deterministicFallbackBriefChunkId(params.parsed.case_id),
          label: 'Case brief',
          content: caseBrief,
          pageNo: null,
          similarity: 0.82,
          pool: 'brief',
        },
      ]
    : [];

  const selectedSources = fitSourcesIntoBudget({
    sources: [...briefSources, ...kbSources],
    modelBudget: getBudgetForModel(params.env.midModel, params.env.midModel),
    promptOverheadTokens: 500,
  }).slice(0, params.env.maxSources);

  const fallbackResponse = buildLocalFallbackResponse({
    request: params.parsed,
    caseBrief,
    sources: selectedSources,
    model: `${params.env.midModel}-local-fallback`,
    latencyMs: Date.now() - params.startedAt,
  });

  const sessionId = await ensureSession(params.rls, {
    orgId: params.orgId,
    caseId: params.parsed.case_id,
    userId: params.userId,
    inputSessionId: params.parsed.session_id,
    initialTitle: params.normalizedQuery.slice(0, 100),
  });

  const userMessageId = await insertMessage(params.rls, {
    orgId: params.orgId,
    caseId: params.parsed.case_id,
    userId: params.userId,
    sessionId,
    role: 'user',
    messageMarkdown: params.normalizedQuery,
    citations: [],
    model: null,
    tokenInput: 0,
    tokenOutput: 0,
    latencyMs: null,
  });

  const assistantMessageId = await insertMessage(params.rls, {
    orgId: params.orgId,
    caseId: params.parsed.case_id,
    userId: params.userId,
    sessionId,
    role: 'assistant',
    messageMarkdown: fallbackResponse.answer_markdown,
    citations: fallbackResponse.citations,
    model: fallbackResponse.meta.model,
    tokenInput: 0,
    tokenOutput: 0,
    latencyMs: Date.now() - params.startedAt,
  });

  const inferredIntent = inferIntentHeuristically(params.parsed);
  await safeAudit(params.rls, {
    requestId: params.requestId,
    orgId: params.orgId,
    userId: params.userId,
    caseId: params.parsed.case_id,
    sessionId,
    messageId: assistantMessageId || userMessageId,
    status: 'ok',
    model: fallbackResponse.meta.model,
    intent: inferredIntent === 'ambiguous' ? 'qna' : inferredIntent,
    cached: false,
    inputTokens: 0,
    outputTokens: 0,
    latencyMs: Date.now() - params.startedAt,
    meta: {
      fallback_mode: 'local_no_openai_key',
      source_count: selectedSources.length,
      is_restricted_case: params.isRestrictedCase,
      template: params.parsed.template ?? null,
    },
  });

  const response = NextResponse.json(fallbackResponse, { status: 200 });
  response.headers.set('x-copilot-session-id', sessionId);
  response.headers.set('x-copilot-request-id', params.requestId);
  return response;
}

function buildLocalFallbackResponse(params: {
  request: CopilotRequest;
  sources: CopilotSource[];
  caseBrief: string | null;
  model: string;
  latencyMs: number;
}): CopilotResponse {
  const kbSourceLabels = params.sources
    .filter((source) => source.pool === 'kb')
    .slice(0, 4)
    .map((source) => `- ${source.label}`);

  const sections: string[] = [
    'استجابة استرشادية مؤقتة: تم توليد هذا الرد من المراجع القانونية المضافة داخل النظام لأن تكامل OpenAI غير مفعّل في بيئة الإنتاج.',
  ];

  if (params.caseBrief) {
    sections.push(`ملخص الوقائع المتاح:\n${truncateText(params.caseBrief, 500)}`);
  }

  if (kbSourceLabels.length) {
    sections.push(`أقرب المراجع النظامية لسؤالك:\n${kbSourceLabels.join('\n')}`);
  }

  sections.push('الخطوة التالية: أعد إرسال الطلب بعد تفعيل OPENAI_API_KEY للحصول على تحليل وصياغة موسعة.');

  const drafts =
    params.request.template === 'draft_response'
      ? [
          {
            title: 'مسودة جواب أولية (استرشادية)',
            content_markdown:
              'أتمسك بالدفوع الشكلية والموضوعية وفق الوقائع والمستندات المتاحة، وألتمس رفض الطلبات غير المؤسسة نظامًا مع حفظ كافة الحقوق.',
          },
        ]
      : [];

  return {
    answer_markdown: sections.join('\n\n'),
    action_items: [
      'راجع الوقائع المؤثرة زمنيًا واربط كل واقعة بدليل واضح.',
      'طابق الطلبات مع السند النظامي المناسب من المراجع المشار إليها.',
      'فعّل متغير OPENAI_API_KEY في بيئة الإنتاج لاستعادة التحليل المتقدم.',
    ],
    missing_info_questions: [
      'ما الوقائع الجوهرية التي يمكن إثباتها حاليًا بمستندات رسمية؟',
      'ما الطلب القضائي النهائي المطلوب بدقة (أصلي واحتياطي)؟',
    ],
    drafts,
    citations: buildFallbackCitations(params.sources),
    confidence: params.caseBrief ? 'medium' : 'low',
    meta: {
      model: params.model,
      latency_ms: params.latencyMs,
      cached: false,
    },
  };
}

function deterministicFallbackBriefChunkId(caseId: string): string {
  const suffix = caseId.replace(/-/g, '').slice(0, 12).padEnd(12, '0');
  return `00000000-0000-0000-0000-${suffix}`;
}

function truncateText(value: string, maxChars: number): string {
  const clean = String(value || '').trim();
  if (clean.length <= maxChars) return clean;
  return `${clean.slice(0, maxChars).trim()}...`;
}

function mapCopilotInternalErrorToMessage(error: unknown): string {
  if (isMissingEnvError(error)) {
    if (error.envVarName === 'SUPABASE_JWT_SECRET') {
      return 'تهيئة Supabase للمساعد القانوني غير مكتملة. يرجى إضافة SUPABASE_JWT_SECRET في بيئة الإنتاج ثم إعادة النشر.';
    }

    if (error.envVarName === 'OPENAI_API_KEY') {
      return 'مفتاح OPENAI_API_KEY غير مهيأ في بيئة الإنتاج. أضف المفتاح أو فعّل الوضع الاسترشادي المحلي.';
    }

    if (
      error.envVarName === 'NEXT_PUBLIC_SUPABASE_URL' ||
      error.envVarName === 'NEXT_PUBLIC_SUPABASE_ANON_KEY' ||
      error.envVarName === 'SUPABASE_SERVICE_ROLE_KEY'
    ) {
      return 'تهيئة اتصال Supabase غير مكتملة للمساعد القانوني. تأكد من NEXT_PUBLIC_SUPABASE_URL وNEXT_PUBLIC_SUPABASE_ANON_KEY وSUPABASE_SERVICE_ROLE_KEY.';
    }

    return `تهيئة بيئة الإنتاج غير مكتملة للمساعد القانوني (${error.envVarName}). يرجى استكمال المتغير وإعادة المحاولة.`;
  }

  const raw = (error instanceof Error ? error.message : String(error || '')).toLowerCase();

  if (raw.includes('إعدادات البيئة غير مكتملة') || raw.includes('missing required environment variable')) {
    return 'تهيئة خدمة الذكاء غير مكتملة في بيئة الإنتاج. يرجى استكمال متغيرات البيئة وإعادة المحاولة.';
  }

  if (raw.includes('openai') || raw.includes('api key') || raw.includes('authentication')) {
    return 'تعذر الاتصال بمزود الذكاء الاصطناعي. يرجى التحقق من مفاتيح الخدمة أو المحاولة لاحقًا.';
  }

  if (raw.includes('quota') || raw.includes('rate limit') || raw.includes('429')) {
    return 'خدمة الذكاء مزدحمة حاليًا أو تجاوزت الحصة. حاول مرة أخرى بعد قليل.';
  }

  if (raw.includes('match_case_chunks') || raw.includes('match_kb_chunks') || raw.includes('does not exist')) {
    return 'مكون استرجاع المراجع غير مهيأ في قاعدة البيانات. يلزم تطبيق آخر ترحيلات قاعدة البيانات.';
  }

  return 'تعذر إكمال طلب المساعد القانوني بسبب خطأ داخلي. حاول مرة أخرى خلال لحظات.';
}
