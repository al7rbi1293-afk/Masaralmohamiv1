import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { DequeuedCaseDocument, EmbeddedChunkRecord, CaseSummaryContext, StageLogStatus } from './types';
import { toPgVector } from './hash';

export function createServiceClient(url: string, serviceRoleKey: string): SupabaseClient {
  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function dequeueCaseDocuments(
  supabase: SupabaseClient,
  batchSize: number,
): Promise<DequeuedCaseDocument[]> {
  const { data, error } = await supabase.rpc('dequeue_case_documents', {
    p_batch_size: batchSize,
  });

  if (error) {
    throw new Error(`dequeue_failed:${error.message}`);
  }

  return ((data as DequeuedCaseDocument[] | null) ?? []).map((row) => ({
    ...row,
    extraction_meta: (row.extraction_meta ?? {}) as Record<string, unknown>,
  }));
}

export async function logWorkerStage(
  supabase: SupabaseClient,
  params: {
    orgId: string;
    caseDocumentId: string;
    stage: string;
    status: StageLogStatus;
    durationMs?: number;
    errorCode?: string | null;
    details?: Record<string, unknown>;
  },
) {
  await supabase.from('copilot_worker_logs').insert({
    org_id: params.orgId,
    case_document_id: params.caseDocumentId,
    stage: params.stage,
    status: params.status,
    duration_ms: params.durationMs ?? null,
    error_code: params.errorCode ?? null,
    details: params.details ?? {},
  });
}

export async function findDuplicateReadyDocumentBySha(
  supabase: SupabaseClient,
  orgId: string,
  caseId: string,
  sha256: string,
  excludeId: string,
): Promise<{ id: string } | null> {
  const { data, error } = await supabase
    .from('case_documents')
    .select('id')
    .eq('org_id', orgId)
    .eq('case_id', caseId)
    .eq('sha256', sha256)
    .eq('status', 'ready')
    .neq('id', excludeId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`find_duplicate_failed:${error.message}`);
  }

  return data ? { id: String((data as any).id) } : null;
}

export async function markDocumentReady(
  supabase: SupabaseClient,
  docId: string,
  meta: Record<string, unknown>,
) {
  const { error } = await supabase
    .from('case_documents')
    .update({
      status: 'ready',
      processed_at: new Date().toISOString(),
      last_error_code: null,
      last_error_message: null,
      extraction_meta: meta,
    })
    .eq('id', docId);

  if (error) {
    throw new Error(`mark_ready_failed:${error.message}`);
  }
}

export async function markDocumentAsDuplicate(
  supabase: SupabaseClient,
  docId: string,
  duplicateOfDocumentId: string,
  meta: Record<string, unknown>,
) {
  const { error } = await supabase
    .from('case_documents')
    .update({
      status: 'ready',
      processed_at: new Date().toISOString(),
      duplicate_of_document_id: duplicateOfDocumentId,
      extraction_meta: meta,
      last_error_code: null,
      last_error_message: null,
    })
    .eq('id', docId);

  if (error) {
    throw new Error(`mark_duplicate_failed:${error.message}`);
  }
}

export async function requeueDocument(
  supabase: SupabaseClient,
  docId: string,
  waitMs: number,
  errorCode: string,
  errorMessage: string,
) {
  const nextRetryAt = new Date(Date.now() + waitMs).toISOString();
  const { error } = await supabase
    .from('case_documents')
    .update({
      status: 'queued',
      next_retry_at: nextRetryAt,
      last_error_code: errorCode,
      last_error_message: errorMessage.slice(0, 1000),
    })
    .eq('id', docId);

  if (error) {
    throw new Error(`requeue_failed:${error.message}`);
  }
}

export async function markDocumentFailed(
  supabase: SupabaseClient,
  docId: string,
  errorCode: string,
  errorMessage: string,
) {
  const { error } = await supabase
    .from('case_documents')
    .update({
      status: 'failed',
      processed_at: new Date().toISOString(),
      last_error_code: errorCode,
      last_error_message: errorMessage.slice(0, 1000),
    })
    .eq('id', docId);

  if (error) {
    throw new Error(`mark_failed_failed:${error.message}`);
  }
}

export async function replaceDocumentChunks(
  supabase: SupabaseClient,
  doc: DequeuedCaseDocument,
  chunks: EmbeddedChunkRecord[],
) {
  const { error: deleteError } = await supabase
    .from('document_chunks')
    .delete()
    .eq('document_id', doc.id);

  if (deleteError) {
    throw new Error(`delete_chunks_failed:${deleteError.message}`);
  }

  const batchSize = 100;
  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize).map((chunk) => ({
      org_id: doc.org_id,
      case_id: doc.case_id,
      document_id: doc.id,
      chunk_index: chunk.chunkIndex,
      page_no: chunk.pageNo,
      content: chunk.content,
      token_count: chunk.tokenCount,
      embedding: toPgVector(chunk.embedding),
      metadata: chunk.metadata ?? {},
    }));

    const { error } = await supabase.from('document_chunks').insert(batch);
    if (error) {
      throw new Error(`insert_chunks_failed:${error.message}`);
    }
  }
}

export async function getCaseSummaryContext(
  supabase: SupabaseClient,
  orgId: string,
  caseId: string,
): Promise<CaseSummaryContext> {
  const [matterRes, eventsRes, chunksRes] = await Promise.all([
    supabase
      .from('matters')
      .select('id, title, summary, claims, case_type')
      .eq('org_id', orgId)
      .eq('id', caseId)
      .single(),
    supabase
      .from('matter_events')
      .select('type, note, event_date, created_at')
      .eq('matter_id', caseId)
      .order('event_date', { ascending: true })
      .limit(100),
    supabase
      .from('document_chunks')
      .select('id, content, page_no')
      .eq('org_id', orgId)
      .eq('case_id', caseId)
      .order('created_at', { ascending: false })
      .limit(30),
  ]);

  if (matterRes.error || !matterRes.data) {
    throw new Error(`get_case_context_matter_failed:${matterRes.error?.message ?? 'not_found'}`);
  }

  if (eventsRes.error) {
    throw new Error(`get_case_context_events_failed:${eventsRes.error.message}`);
  }

  if (chunksRes.error) {
    throw new Error(`get_case_context_chunks_failed:${chunksRes.error.message}`);
  }

  return {
    matter: {
      id: String((matterRes.data as any).id),
      title: String((matterRes.data as any).title),
      summary: ((matterRes.data as any).summary as string | null) ?? null,
      claims: ((matterRes.data as any).claims as string | null) ?? null,
      case_type: ((matterRes.data as any).case_type as string | null) ?? null,
    },
    events: ((eventsRes.data as any[]) ?? []).map((row) => ({
      type: String(row.type),
      note: row.note ? String(row.note) : null,
      event_date: row.event_date ? String(row.event_date) : null,
      created_at: String(row.created_at),
    })),
    topChunks: ((chunksRes.data as any[]) ?? []).map((row) => ({
      id: String(row.id),
      content: String(row.content ?? ''),
      page_no: row.page_no == null ? null : Number(row.page_no),
    })),
  };
}

export async function upsertCaseBrief(
  supabase: SupabaseClient,
  params: {
    orgId: string;
    caseId: string;
    userId?: string | null;
    briefMarkdown: string;
    facts: unknown;
    timeline: unknown;
    sourceChunkIds: string[];
  },
) {
  const { error } = await supabase
    .from('case_briefs')
    .upsert(
      {
        org_id: params.orgId,
        case_id: params.caseId,
        created_by: params.userId ?? null,
        brief_markdown: params.briefMarkdown,
        facts: params.facts,
        timeline: params.timeline,
        source_chunk_ids: params.sourceChunkIds,
        is_stale: false,
        built_at: new Date().toISOString(),
      },
      { onConflict: 'case_id' },
    );

  if (error) {
    throw new Error(`upsert_case_brief_failed:${error.message}`);
  }
}
