import { promises as fs } from 'node:fs';
import path from 'node:path';
import type OpenAI from 'openai';
import type { SupabaseClient } from '@supabase/supabase-js';
import { runDownloadStage } from './stages/download';
import { runExtractStage } from './stages/extract';
import { runOcrStage } from './stages/ocr';
import { runChunkStage } from './stages/chunk';
import { runEmbedStage } from './stages/embed';
import { runWriteStage } from './stages/write';
import { runBriefStage } from './stages/brief';
import type { DequeuedCaseDocument } from './types';
import type { IngestionConfig } from './config';
import { logError, logInfo, stageEvent } from './logger';
import {
  findDuplicateReadyDocumentBySha,
  logWorkerStage,
  markDocumentAsDuplicate,
  markDocumentReady,
} from './db';
import { normalizeText } from './tokenize';
import { sha256File } from './hash';

export async function processDequeuedDocument(params: {
  supabase: SupabaseClient;
  openai: OpenAI;
  config: IngestionConfig;
  doc: DequeuedCaseDocument;
}) {
  const { supabase, openai, config, doc } = params;
  const tempRoot = path.join(config.tempDir, doc.id);

  let filePath = '';

  try {
    const download = await runStage({
      supabase,
      doc,
      stage: 'download',
      run: () => runDownloadStage(supabase, doc, tempRoot),
    });

    filePath = download.filePath;
    const downloadedSha = await sha256File(filePath);

    const duplicate = await runStage({
      supabase,
      doc,
      stage: 'dedupe',
      run: () =>
        findDuplicateReadyDocumentBySha(supabase, doc.org_id, doc.case_id, doc.sha256, doc.id),
    });

    if (duplicate) {
      await markDocumentAsDuplicate(supabase, doc.id, duplicate.id, {
        strategy: 'sha256_duplicate_short_circuit',
        downloaded_sha256: downloadedSha,
      });
      logInfo('ingestion_duplicate_short_circuit', {
        doc_id: doc.id,
        duplicate_of: duplicate.id,
      });
      return;
    }

    const extracted = await runStage({
      supabase,
      doc,
      stage: 'extract',
      run: () => runExtractStage(doc, filePath, config.textDensityThreshold),
    });

    let text = extracted.text;
    let usedOcr = false;
    let pageCount = extracted.pageCount;

    if (extracted.needsOcr) {
      const ocr = await runStage({
        supabase,
        doc,
        stage: 'ocr',
        run: () => runOcrStage(filePath, doc.mime_type),
      });

      if (ocr.text.length > text.length * 0.6) {
        text = ocr.text;
      }
      pageCount = Math.max(pageCount, ocr.pageCount);
      usedOcr = true;
    }

    const normalized = normalizeText(text);
    if (!normalized) {
      throw new Error('no_extractable_text');
    }

    const chunks = await runStage({
      supabase,
      doc,
      stage: 'chunk',
      run: () =>
        Promise.resolve(
          runChunkStage(
            normalized,
            config.maxChunkTokens,
            config.chunkOverlapTokens,
            config.maxChunksPerDocument,
          ),
        ),
    });

    if (!chunks.length) {
      throw new Error('no_chunks_produced');
    }

    const embeddedChunks = await runStage({
      supabase,
      doc,
      stage: 'embed',
      run: () => runEmbedStage(openai, config.embeddingModel, chunks),
    });

    await runStage({
      supabase,
      doc,
      stage: 'write',
      run: () => runWriteStage(supabase, doc, embeddedChunks),
    });

    await runStage({
      supabase,
      doc,
      stage: 'brief',
      run: () =>
        runBriefStage(supabase, openai, config.draftingModel, {
          orgId: doc.org_id,
          caseId: doc.case_id,
        }),
    });

    await markDocumentReady(supabase, doc.id, {
      extraction_method: extracted.extractionMethod,
      used_ocr: usedOcr,
      page_count: pageCount,
      text_density: extracted.textDensity,
      chunk_count: embeddedChunks.length,
      downloaded_sha256: downloadedSha,
      source_sha256: doc.sha256,
      sha256_match: downloadedSha === doc.sha256,
      processed_at: new Date().toISOString(),
    });

    logInfo('ingestion_completed', {
      doc_id: doc.id,
      org_id: doc.org_id,
      case_id: doc.case_id,
      chunk_count: embeddedChunks.length,
      used_ocr: usedOcr,
    });
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true }).catch(() => undefined);
  }
}

async function runStage<T>(params: {
  supabase: SupabaseClient;
  doc: DequeuedCaseDocument;
  stage: string;
  run: () => Promise<T>;
}): Promise<T> {
  const { supabase, doc, stage, run } = params;
  const start = Date.now();

  stageEvent(stage, 'started', { doc_id: doc.id, org_id: doc.org_id, case_id: doc.case_id });
  await logWorkerStage(supabase, {
    orgId: doc.org_id,
    caseDocumentId: doc.id,
    stage,
    status: 'started',
  }).catch(() => undefined);

  try {
    const value = await run();
    const duration = Date.now() - start;
    stageEvent(stage, 'completed', { doc_id: doc.id, duration_ms: duration });
    await logWorkerStage(supabase, {
      orgId: doc.org_id,
      caseDocumentId: doc.id,
      stage,
      status: 'completed',
      durationMs: duration,
    }).catch(() => undefined);

    return value;
  } catch (error) {
    const duration = Date.now() - start;
    const message = error instanceof Error ? error.message : String(error);
    stageEvent(stage, 'failed', {
      doc_id: doc.id,
      duration_ms: duration,
      error: message,
    });
    await logWorkerStage(supabase, {
      orgId: doc.org_id,
      caseDocumentId: doc.id,
      stage,
      status: 'failed',
      durationMs: duration,
      errorCode: stage,
      details: { message },
    }).catch(() => undefined);

    logError('ingestion_stage_failed', {
      stage,
      doc_id: doc.id,
      error: message,
    });
    throw error;
  }
}
