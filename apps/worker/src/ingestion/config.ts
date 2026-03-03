import os from 'node:os';
import path from 'node:path';

export type IngestionConfig = {
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  openAiApiKey: string;
  embeddingModel: string;
  draftingModel: string;
  bucketDefault: string;
  concurrency: number;
  pollIntervalMs: number;
  dequeueBatchSize: number;
  maxRetries: number;
  maxChunkTokens: number;
  chunkOverlapTokens: number;
  maxChunksPerDocument: number;
  textDensityThreshold: number;
  tempDir: string;
};

function envRequired(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function envInt(name: string, fallback: number, min: number, max: number) {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const num = Number(raw);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(num)));
}

function envFloat(name: string, fallback: number, min: number, max: number) {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const num = Number(raw);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(min, Math.min(max, num));
}

export function getIngestionConfig(): IngestionConfig {
  const tempDir = process.env.COPILOT_TEMP_DIR?.trim() || path.join(os.tmpdir(), 'masar-copilot');

  return {
    supabaseUrl: envRequired('NEXT_PUBLIC_SUPABASE_URL'),
    supabaseServiceRoleKey: envRequired('SUPABASE_SERVICE_ROLE_KEY'),
    openAiApiKey: envRequired('OPENAI_API_KEY'),
    embeddingModel: process.env.OPENAI_MODEL_EMBEDDING?.trim() || 'text-embedding-3-small',
    draftingModel: process.env.OPENAI_MODEL_MID?.trim() || 'gpt-4.1-mini',
    bucketDefault: process.env.COPILOT_DOCS_BUCKET?.trim() || 'documents',
    concurrency: envInt('COPILOT_WORKER_CONCURRENCY', 3, 1, 20),
    pollIntervalMs: envInt('COPILOT_WORKER_POLL_INTERVAL_MS', 3000, 500, 60000),
    dequeueBatchSize: envInt('COPILOT_WORKER_DEQUEUE_BATCH_SIZE', 10, 1, 100),
    maxRetries: envInt('COPILOT_WORKER_MAX_RETRIES', 5, 1, 20),
    maxChunkTokens: envInt('COPILOT_CHUNK_TOKENS', 500, 100, 2000),
    chunkOverlapTokens: envInt('COPILOT_CHUNK_OVERLAP_TOKENS', 80, 0, 500),
    maxChunksPerDocument: envInt('COPILOT_MAX_CHUNKS_PER_DOCUMENT', 1200, 20, 5000),
    textDensityThreshold: envFloat('COPILOT_PDF_TEXT_DENSITY_THRESHOLD', 160, 20, 2000),
    tempDir,
  };
}
