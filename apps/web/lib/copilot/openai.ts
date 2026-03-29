import OpenAI from 'openai';
import type { CopilotIntent } from './routing';

let client: OpenAI | null = null;
const DEFAULT_FALLBACK_CHAT_MODELS = ['gpt-4.1-mini', 'gpt-4o-mini', 'o4-mini'];
const CONFIGURED_FALLBACK_CHAT_MODELS = parseFallbackModels();

export function getOpenAiClient(apiKey: string): OpenAI {
  if (!client) {
    client = new OpenAI({ apiKey });
  }
  return client;
}

export async function createEmbedding(
  openai: OpenAI,
  model: string,
  input: string,
): Promise<number[]> {
  const result = await openai.embeddings.create({
    model,
    input,
  });

  return result.data[0]?.embedding ?? [];
}

export async function classifyIntentWithModel(params: {
  openai: OpenAI;
  model: string;
  message: string;
}): Promise<CopilotIntent> {
  const requestPayload = {
    temperature: 0,
    stream: false as const,
    messages: [
      {
        role: 'system' as const,
        content:
          'Classify user request into one label only: qna, draft, analyze. Return label only, lowercase.',
      },
      {
        role: 'user' as const,
        content: params.message,
      },
    ],
  };

  const completion = await runWithFallbackModels(
    params.model,
    (model) =>
      params.openai.chat.completions.create({
        model,
        ...requestPayload,
      }),
  );

  const label = completion.choices[0]?.message?.content?.trim().toLowerCase();
  if (label === 'draft' || label === 'analyze') return label;
  return 'qna';
}

export async function generateJsonResponse(params: {
  openai: OpenAI;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
}): Promise<{ raw: string; inputTokens: number; outputTokens: number }> {
  const requestPayload = {
    temperature: params.temperature ?? 0.2,
    stream: false as const,
    messages: [
      { role: 'system' as const, content: params.systemPrompt },
      { role: 'user' as const, content: params.userPrompt },
    ],
  };

  const generateForModel = async (model: string) => {
    try {
      return await params.openai.chat.completions.create({
        model,
        response_format: { type: 'json_object' },
        ...requestPayload,
      });
    } catch (error) {
      if (!shouldRetryWithoutJsonResponseFormat(error)) {
        throw error;
      }
      return params.openai.chat.completions.create({
        model,
        ...requestPayload,
      });
    }
  };

  const completion = await runWithFallbackModels(params.model, (model) => generateForModel(model));

  return {
    raw: completion.choices[0]?.message?.content || '{}',
    inputTokens: completion.usage?.prompt_tokens || 0,
    outputTokens: completion.usage?.completion_tokens || 0,
  };
}

function shouldRetryWithFallbackModel(error: unknown): boolean {
  const raw = (error instanceof Error ? error.message : String(error || '')).toLowerCase();
  return (
    raw.includes('does not have access to model') ||
    raw.includes('model_not_found') ||
    raw.includes('unsupported') ||
    raw.includes('does not support') ||
    raw.includes('not supported') ||
    raw.includes('invalid model')
  );
}

function shouldRetryWithoutJsonResponseFormat(error: unknown): boolean {
  const raw = (error instanceof Error ? error.message : String(error || '')).toLowerCase();
  return raw.includes('response_format') && (raw.includes('unsupported') || raw.includes('not support'));
}

async function runWithFallbackModels<T>(
  primaryModel: string,
  action: (model: string) => Promise<T>,
): Promise<T> {
  const modelsToTry = [primaryModel, ...getFallbackModels(primaryModel)];
  let lastError: unknown = null;

  for (let index = 0; index < modelsToTry.length; index += 1) {
    const model = modelsToTry[index];
    try {
      return await action(model);
    } catch (error) {
      lastError = error;
      const hasMoreCandidates = index < modelsToTry.length - 1;
      if (!hasMoreCandidates || !shouldRetryWithFallbackModel(error)) {
        throw error;
      }
    }
  }

  throw lastError ?? new Error('fallback_model_exhausted');
}

function getFallbackModels(primaryModel: string): string[] {
  return CONFIGURED_FALLBACK_CHAT_MODELS.filter((model) => model !== primaryModel);
}

function parseFallbackModels(): string[] {
  const fromEnv = (process.env.OPENAI_MODEL_FALLBACKS || process.env.OPENAI_MODEL_FALLBACK || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  const seeded = [...fromEnv, process.env.OPENAI_MODEL_STRONG?.trim(), process.env.OPENAI_MODEL_MID?.trim()];
  const merged = [...seeded, ...DEFAULT_FALLBACK_CHAT_MODELS].filter(Boolean) as string[];
  return Array.from(new Set(merged));
}
