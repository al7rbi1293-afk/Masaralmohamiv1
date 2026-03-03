import OpenAI from 'openai';
import type { CopilotIntent } from './routing';

let client: OpenAI | null = null;

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
  const completion = await params.openai.chat.completions.create({
    model: params.model,
    temperature: 0,
    messages: [
      {
        role: 'system',
        content:
          'Classify user request into one label only: qna, draft, analyze. Return label only, lowercase.',
      },
      {
        role: 'user',
        content: params.message,
      },
    ],
  });

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
  const completion = await params.openai.chat.completions.create({
    model: params.model,
    temperature: params.temperature ?? 0.2,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: params.systemPrompt },
      { role: 'user', content: params.userPrompt },
    ],
  });

  return {
    raw: completion.choices[0]?.message?.content || '{}',
    inputTokens: completion.usage?.prompt_tokens || 0,
    outputTokens: completion.usage?.completion_tokens || 0,
  };
}
