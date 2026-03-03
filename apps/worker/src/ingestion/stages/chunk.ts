import type { ChunkRecord } from '../types';
import { approximateTokenCount, splitIntoParagraphs } from '../tokenize';

export function runChunkStage(
  text: string,
  maxChunkTokens: number,
  overlapTokens: number,
  maxChunksPerDocument: number,
): ChunkRecord[] {
  const paragraphs = splitIntoParagraphs(text);
  if (!paragraphs.length) return [];

  const chunks: ChunkRecord[] = [];
  let buffer: string[] = [];
  let bufferTokens = 0;
  let chunkIndex = 0;

  const pushChunk = () => {
    const content = buffer.join('\n\n').trim();
    if (!content) return;

    const tokenCount = approximateTokenCount(content);
    chunks.push({
      chunkIndex,
      pageNo: null,
      content,
      tokenCount,
      metadata: {},
    });
    chunkIndex += 1;

    if (overlapTokens > 0) {
      const overlap: string[] = [];
      let overlapCount = 0;
      for (let i = buffer.length - 1; i >= 0; i -= 1) {
        const p = buffer[i];
        const pt = approximateTokenCount(p);
        if (overlapCount + pt > overlapTokens) break;
        overlap.unshift(p);
        overlapCount += pt;
      }
      buffer = overlap;
      bufferTokens = overlapCount;
    } else {
      buffer = [];
      bufferTokens = 0;
    }
  };

  for (const paragraph of paragraphs) {
    const paragraphTokens = approximateTokenCount(paragraph);

    if (paragraphTokens >= maxChunkTokens) {
      if (buffer.length) {
        pushChunk();
      }
      const slices = splitLongParagraph(paragraph, maxChunkTokens);
      for (const slice of slices) {
        const tokenCount = approximateTokenCount(slice);
        chunks.push({
          chunkIndex,
          pageNo: null,
          content: slice,
          tokenCount,
          metadata: {},
        });
        chunkIndex += 1;
        if (chunks.length >= maxChunksPerDocument) {
          return chunks.slice(0, maxChunksPerDocument);
        }
      }
      continue;
    }

    if (bufferTokens + paragraphTokens > maxChunkTokens && buffer.length) {
      pushChunk();
    }

    buffer.push(paragraph);
    bufferTokens += paragraphTokens;

    if (chunks.length >= maxChunksPerDocument) {
      return chunks.slice(0, maxChunksPerDocument);
    }
  }

  if (buffer.length && chunks.length < maxChunksPerDocument) {
    pushChunk();
  }

  return chunks.slice(0, maxChunksPerDocument);
}

function splitLongParagraph(paragraph: string, maxChunkTokens: number): string[] {
  const words = paragraph.split(/\s+/);
  const pieces: string[] = [];
  let current: string[] = [];

  for (const word of words) {
    current.push(word);
    if (approximateTokenCount(current.join(' ')) >= maxChunkTokens) {
      pieces.push(current.join(' ').trim());
      current = [];
    }
  }

  if (current.length) {
    pieces.push(current.join(' ').trim());
  }

  return pieces.filter(Boolean);
}
