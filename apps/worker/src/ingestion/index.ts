import { setTimeout as sleep } from 'node:timers/promises';
import { getIngestionConfig } from './config';
import { createServiceClient, dequeueCaseDocuments, markDocumentFailed, requeueDocument } from './db';
import { getOpenAIClient } from './openai';
import { processDequeuedDocument } from './pipeline';
import { computeBackoffMs, isTransientError } from './retry';
import { logError, logInfo } from './logger';
import type { DequeuedCaseDocument } from './types';

let shuttingDown = false;

async function main() {
  const config = getIngestionConfig();
  const supabase = createServiceClient(config.supabaseUrl, config.supabaseServiceRoleKey);
  const openai = getOpenAIClient(config.openAiApiKey);

  logInfo('ingestion_worker_started', {
    concurrency: config.concurrency,
    poll_interval_ms: config.pollIntervalMs,
    dequeue_batch_size: config.dequeueBatchSize,
    max_retries: config.maxRetries,
  });

  let lastCleanupAt = 0;

  while (!shuttingDown) {
    try {
      const docs = await dequeueCaseDocuments(supabase, config.dequeueBatchSize);

      if (!docs.length) {
        await maybeCleanupCaches(supabase, lastCleanupAt);
        if (Date.now() - lastCleanupAt >= 10 * 60 * 1000) {
          lastCleanupAt = Date.now();
        }
        await sleep(config.pollIntervalMs);
        continue;
      }

      logInfo('ingestion_batch_claimed', { size: docs.length });

      await mapWithConcurrency(docs, config.concurrency, async (doc) => {
        await processDocumentWithRetryHandling({
          doc,
          config,
          supabase,
          openai,
        });
      });

      await maybeCleanupCaches(supabase, lastCleanupAt);
      if (Date.now() - lastCleanupAt >= 10 * 60 * 1000) {
        lastCleanupAt = Date.now();
      }
    } catch (error) {
      logError('ingestion_loop_error', {
        message: error instanceof Error ? error.message : String(error),
      });
      await sleep(Math.max(1000, config.pollIntervalMs));
    }
  }

  logInfo('ingestion_worker_stopped');
}

async function processDocumentWithRetryHandling(params: {
  doc: DequeuedCaseDocument;
  config: ReturnType<typeof getIngestionConfig>;
  supabase: ReturnType<typeof createServiceClient>;
  openai: ReturnType<typeof getOpenAIClient>;
}) {
  const { doc, config, supabase, openai } = params;

  try {
    await processDequeuedDocument({
      supabase,
      openai,
      config,
      doc,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const transient = isTransientError(error);
    const code = extractErrorCode(message);

    if (transient && doc.attempt_count < config.maxRetries) {
      const waitMs = computeBackoffMs(doc.attempt_count);
      await requeueDocument(supabase, doc.id, waitMs, code, message);
      logInfo('ingestion_requeued', {
        doc_id: doc.id,
        attempt: doc.attempt_count,
        wait_ms: waitMs,
        error_code: code,
      });
      return;
    }

    await markDocumentFailed(supabase, doc.id, code, message);
    logError('ingestion_marked_failed', {
      doc_id: doc.id,
      attempt: doc.attempt_count,
      transient,
      error_code: code,
      message,
    });
  }
}

function extractErrorCode(message: string): string {
  const [first] = message.split(':');
  const normalized = first.trim().toLowerCase();
  if (!normalized) return 'processing_error';
  if (normalized.length > 64) return 'processing_error';
  return normalized.replace(/[^a-z0-9_]/g, '_');
}

async function mapWithConcurrency<T>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<void>,
) {
  const limit = Math.max(1, Math.min(concurrency, items.length));
  let cursor = 0;

  await Promise.all(
    Array.from({ length: limit }, async () => {
      while (true) {
        const index = cursor;
        cursor += 1;
        if (index >= items.length) return;
        await mapper(items[index]);
      }
    }),
  );
}

async function maybeCleanupCaches(
  supabase: ReturnType<typeof createServiceClient>,
  lastCleanupAt: number,
) {
  if (Date.now() - lastCleanupAt < 10 * 60 * 1000) {
    return;
  }

  await supabase
    .rpc('cleanup_copilot_expired_cache_and_limits', {
      p_cache_delete_limit: 1000,
      p_rate_delete_limit: 1000,
    })
    .then(({ error }) => {
      if (error) {
        logError('cleanup_cache_failed', { message: error.message });
      }
    });
}

function shutdown() {
  shuttingDown = true;
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

void main();
