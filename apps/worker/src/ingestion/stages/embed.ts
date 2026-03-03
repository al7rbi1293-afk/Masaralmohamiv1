import type OpenAI from 'openai';
import type { ChunkRecord, EmbeddedChunkRecord } from '../types';
import { embedTexts } from '../openai';

export async function runEmbedStage(
  openai: OpenAI,
  model: string,
  chunks: ChunkRecord[],
): Promise<EmbeddedChunkRecord[]> {
  if (!chunks.length) return [];

  const batchSize = 64;
  const result: EmbeddedChunkRecord[] = [];

  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    const embeddings = await embedTexts(openai, model, batch.map((chunk) => chunk.content));

    for (let idx = 0; idx < batch.length; idx += 1) {
      result.push({
        ...batch[idx],
        embedding: embeddings[idx],
      });
    }
  }

  return result;
}
