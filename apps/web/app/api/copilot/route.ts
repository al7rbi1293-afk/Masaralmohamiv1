import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getMatterById } from '@/lib/matters';
import { isUserAppAdmin } from '@/lib/admin';
import { getCurrentAuthUser } from '@/lib/supabase/auth-session';
import { requireOrgIdForUser } from '@/lib/org';
import { createSupabaseRlsUserClient } from '@/lib/supabase/rls-user-client';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCopilotEnv, getOpenAiApiKey, isCopilotEnabled, isMissingEnvError } from '@/lib/env';
import { logError } from '@/lib/logger';
import {
  buildFallbackCitations,
  copilotRequestSchema,
  copilotResponseSchema,
  defaultFailureResponse,
  sanitizeAndValidateCitations,
  type CopilotResponse,
} from '@/lib/copilot/schema';
import { buildCopilotUserPrompt, buildRepairPrompt, COPILOT_SYSTEM_PROMPT } from '@/lib/copilot/prompts';
import { chooseModelForIntent, inferIntentHeuristically } from '@/lib/copilot/routing';
import { retrieveSources, normalizeCopilotQuery, extractQuotedTerms } from '@/lib/copilot/retrieval';
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
  if (!isCopilotEnabled()) {
    const response = NextResponse.json(
      defaultFailureResponse({
        model: env.midModel,
        latencyMs: Date.now() - startedAt,
        message: 'ميزة الذكاء الاصطناعي موقوفة مؤقتًا وستعود قريبًا.',
      }),
      { status: 503 },
    );
    response.headers.set('x-copilot-request-id', requestId);
    return response;
  }

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

  const isAdmin = await isUserAppAdmin(user.id).catch(() => false);
  if (!isAdmin) {
    return NextResponse.json(
      defaultFailureResponse({
        model: env.midModel,
        latencyMs: Date.now() - startedAt,
        message: 'ميزة الذكاء الاصطناعي متاحة فقط لحساب الإدارة.',
      }),
      { status: 403 },
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

  let rls: Awaited<ReturnType<typeof createSupabaseRlsUserClient>>;
  let isServiceFallback = false;
  try {
    rls = await createSupabaseRlsUserClient(user.id);
  } catch (error) {
    if (isMissingEnvError(error) && error.envVarName === 'SUPABASE_JWT_SECRET') {
      logError('copilot_rls_missing_jwt_secret_using_service', { requestId });
      rls = createSupabaseServerClient();
      isServiceFallback = true;
    } else {
      throw error;
    }
  }
  const parsed = payload.data;

  let matterLookupResult = await rls
    .from('matters')
    .select('id, title, is_private, case_type')
    .eq('org_id', orgId)
    .eq('id', parsed.case_id)
    .maybeSingle();

  if (isSupabaseJwtKeyError(matterLookupResult.error)) {
    logError('copilot_rls_jwt_invalid_fallback_service', {
      requestId,
      message: matterLookupResult.error?.message ?? 'unknown',
    });
    rls = createSupabaseServerClient();
    isServiceFallback = true;
    matterLookupResult = await rls
      .from('matters')
      .select('id, title, is_private, case_type')
      .eq('org_id', orgId)
      .eq('id', parsed.case_id)
      .maybeSingle();
  }

  const { data: matterByRls, error: matterError } = matterLookupResult;

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

  let rate = await consumeCopilotRateLimit({
    supabase: rls,
    orgId,
    limit: env.rateLimitPerMinute,
    windowSeconds: 60,
    userId: isServiceFallback ? user.id : undefined,
  }).catch((error) => {
    logError('copilot_rate_limit_error', {
      requestId,
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  });

  if (!rate) {
    logError('copilot_rate_limit_soft_bypass_unavailable', {
      requestId,
      userId: user.id,
      serviceFallback: isServiceFallback,
    });
    rate = {
      allowed: true,
      currentCount: 0,
      resetAt: new Date(Date.now() + 60_000).toISOString(),
    };
  }

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

  let quota = await consumeRequestQuota({
    supabase: rls,
    orgId,
    requestsLimit: env.requestsMonthlyDefault,
    tokensLimit: env.tokensMonthlyDefault,
    userId: isServiceFallback ? user.id : undefined,
  }).catch((error) => {
    logError('copilot_quota_error', {
      requestId,
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  });

  if (!quota) {
    logError('copilot_quota_soft_bypass_unavailable', {
      requestId,
      userId: user.id,
      serviceFallback: isServiceFallback,
    });
    quota = {
      allowed: true,
      requestsUsed: 0,
      tokensUsed: 0,
      monthStart: new Date().toISOString().slice(0, 10),
    };
  }

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

  const openai = getOpenAiClient(getOpenAiApiKey());

  try {
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
      caseType: matter.case_type ?? null,
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
    promptOverheadTokens: 1100,
  }).slice(0, env.maxSources);

  const basePrompt = buildCopilotUserPrompt({
    request: parsed,
    sources: budgetedSources,
    caseBrief: retrieval.caseBrief,
    sourceCap: env.maxSources,
    caseType: matter.case_type,
    intent,
    customStyleProfile: env.styleProfile,
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
      userId: isServiceFallback ? user.id : undefined,
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
    userId: isServiceFallback ? user.id : undefined,
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
  } catch (openAiPathError) {
    if (isOpenAiProviderError(openAiPathError)) {
      const providerMessage = mapCopilotInternalErrorToMessage(openAiPathError);
      logError('copilot_openai_provider_error', {
        requestId,
        message: openAiPathError instanceof Error ? openAiPathError.message : String(openAiPathError),
      });
      await safeAudit(rls, {
        requestId,
        orgId,
        userId: user.id,
        caseId: parsed.case_id,
        status: 'error',
        model: env.midModel,
        cached: false,
        inputTokens: 0,
        outputTokens: 0,
        latencyMs: Date.now() - startedAt,
        errorCode: 'openai_provider_error',
        errorMessage: openAiPathError instanceof Error ? openAiPathError.message : String(openAiPathError),
        meta: {
          is_restricted_case: Boolean((matter as any).is_private),
          template: parsed.template ?? null,
        },
      });
      const response = NextResponse.json(
        defaultFailureResponse({
          model: env.midModel,
          latencyMs: Date.now() - startedAt,
          message: providerMessage,
        }),
        { status: 502 },
      );
      response.headers.set('x-copilot-request-id', requestId);
      return response;
    }
    throw openAiPathError;
  }
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
    logError('copilot_session_create_failed', {
      message: error?.message ?? 'unknown',
      caseId: params.caseId,
      orgId: params.orgId,
      userId: params.userId,
    });
    return params.inputSessionId || randomUUID();
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

function isOpenAiProviderError(error: unknown): boolean {
  const raw = (error instanceof Error ? error.message : String(error || '')).toLowerCase();
  return (
    raw.includes('openai') ||
    raw.includes('api key') ||
    raw.includes('authentication') ||
    raw.includes('rate limit') ||
    raw.includes('insufficient_quota') ||
    raw.includes('model_not_found') ||
    raw.includes('invalid_request_error')
  );
}

function isSupabaseJwtKeyError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const message = String((error as { message?: unknown }).message ?? '').toLowerCase();
  return (
    message.includes('no suitable key or wrong key type') ||
    message.includes('jwt') && message.includes('key')
  );
}

function mapCopilotInternalErrorToMessage(error: unknown): string {
  if (isMissingEnvError(error)) {
    if (error.envVarName === 'SUPABASE_JWT_SECRET') {
      return 'تهيئة Supabase للمساعد القانوني غير مكتملة. يرجى إضافة SUPABASE_JWT_SECRET في بيئة الإنتاج ثم إعادة النشر.';
    }

    if (error.envVarName === 'OPENAI_API_KEY') {
      return 'مفتاح OPENAI_API_KEY غير مهيأ في بيئة الإنتاج. أضف المفتاح ثم أعد النشر.';
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

  if (
    raw.includes('supabase_rls_jwt_invalid') ||
    raw.includes('no suitable key or wrong key type') ||
    (raw.includes('jwt') && raw.includes('key'))
  ) {
    return 'تهيئة RLS في Supabase غير صحيحة للمساعد القانوني. تأكد من قيمة SUPABASE_JWT_SECRET المطابقة للمشروع ثم أعد النشر.';
  }

  if (raw.includes('openai') || raw.includes('api key') || raw.includes('authentication')) {
    return 'تعذر الاتصال بخدمة OpenAI. يرجى التحقق من المفاتيح أو المحاولة لاحقًا.';
  }

  if (raw.includes('quota') || raw.includes('rate limit') || raw.includes('429')) {
    return 'خدمة الذكاء مزدحمة حاليًا أو تجاوزت الحصة. حاول مرة أخرى بعد قليل.';
  }

  if (raw.includes('match_case_chunks') || raw.includes('match_kb_chunks') || raw.includes('does not exist')) {
    return 'مكون استرجاع المراجع غير مهيأ في قاعدة البيانات. يلزم تطبيق آخر ترحيلات قاعدة البيانات.';
  }

  if (
    raw.includes('consume_copilot_quota') ||
    raw.includes('consume_copilot_rate_limit') ||
    raw.includes('copilot_sessions') ||
    raw.includes('copilot_messages') ||
    raw.includes('copilot_usage') ||
    raw.includes('copilot_cache')
  ) {
    return 'مكونات المساعد القانوني في قاعدة البيانات غير مكتملة. يلزم تطبيق آخر ترحيلات قاعدة البيانات ثم إعادة المحاولة.';
  }

  return 'تعذر إكمال طلب المساعد القانوني بسبب خطأ داخلي. حاول مرة أخرى خلال لحظات.';
}
