import OpenAI from 'openai';

let client: OpenAI | null = null;

export function getOpenAIClient(apiKey: string): OpenAI {
  if (!client) {
    client = new OpenAI({ apiKey });
  }
  return client;
}

export async function embedTexts(
  openai: OpenAI,
  model: string,
  inputs: string[],
): Promise<number[][]> {
  if (!inputs.length) return [];

  const response = await openai.embeddings.create({
    model,
    input: inputs,
  });

  return response.data.map((entry) => entry.embedding);
}

export async function generateCaseBrief(
  openai: OpenAI,
  model: string,
  prompt: string,
): Promise<string> {
  const completion = await openai.chat.completions.create({
    model,
    temperature: 0.2,
    messages: [
      {
        role: 'system',
        content:
          'You summarize legal case information in Arabic. Never invent facts. Be concise and structured.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
  });

  return completion.choices[0]?.message?.content?.trim() || '';
}
