import 'server-only';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { ExternalDocumentPreparationStatus, NormalizedExternalDocument } from '../domain/models';

export type ExternalDocumentRow = {
  id: string;
  org_id: string;
  external_case_id: string | null;
  matter_id: string | null;
  external_id: string;
  document_type: string;
  title: string;
  file_name: string;
  mime_type: string | null;
  download_url: string | null;
  file_size: number | null;
  checksum: string | null;
  issued_at: string | null;
  portal_visible: boolean;
  document_id: string | null;
  processing_status: ExternalDocumentPreparationStatus;
  processing_error: string | null;
  processed_at: string | null;
  last_processing_attempt_at: string | null;
  payload_json: Record<string, unknown> | null;
  synced_at: string;
};

const EXTERNAL_DOCUMENT_SELECT = [
  'id',
  'org_id',
  'external_case_id',
  'matter_id',
  'external_id',
  'document_type',
  'title',
  'file_name',
  'mime_type',
  'download_url',
  'file_size',
  'checksum',
  'issued_at',
  'portal_visible',
  'document_id',
  'processing_status',
  'processing_error',
  'processed_at',
  'last_processing_attempt_at',
  'payload_json',
  'synced_at',
].join(', ');

export async function upsertExternalDocuments(input: {
  orgId: string;
  matterId?: string | null;
  externalCaseDbId?: string | null;
  syncJobId?: string | null;
  clientId?: string | null;
  createdBy?: string | null;
  documents: NormalizedExternalDocument[];
}) {
  if (!input.documents.length) {
    return {
      rows: [] as ExternalDocumentRow[],
      createdRows: [] as ExternalDocumentRow[],
    };
  }

  const supabase = createSupabaseServerClient();
  const externalIds = input.documents.map((item) => item.externalId);
  const { data: existingRows, error: existingError } = await supabase
    .from('external_documents')
    .select('external_id, processing_status')
    .eq('org_id', input.orgId)
    .in('external_id', externalIds);

  if (existingError) {
    throw existingError;
  }

  const existingRowsList = (((existingRows as unknown) as Array<{
    external_id: string;
    processing_status?: ExternalDocumentPreparationStatus | null;
  }> | null) ?? []);
  const existingExternalIds = new Set(
    existingRowsList.map((row) => row.external_id),
  );
  const existingProcessingStatus = new Map(
    existingRowsList.map((row) => [row.external_id, row.processing_status ?? null]),
  );

  const payload = input.documents.map((item) => ({
    org_id: input.orgId,
    external_case_id: input.externalCaseDbId ?? null,
    matter_id: input.matterId ?? null,
    sync_job_id: input.syncJobId ?? null,
    provider: item.provider,
    source: item.source,
    external_id: item.externalId,
    document_type: item.documentType,
    title: item.title,
    file_name: item.fileName,
    mime_type: item.mimeType,
    download_url: item.downloadUrl,
    file_size: item.fileSize,
    checksum: item.checksum,
    issued_at: item.issuedAt,
    portal_visible: item.portalVisible,
    processing_status:
      existingProcessingStatus.get(item.externalId) ??
      (item.downloadUrl ? 'pending' : 'skipped'),
    processing_error: null,
    payload_json: item.payloadJson,
    synced_at: item.syncedAt,
  }));

  const { data, error } = await supabase
    .from('external_documents')
    .upsert(payload, { onConflict: 'org_id,provider,external_id' })
    .select(EXTERNAL_DOCUMENT_SELECT);

  if (error) {
    throw error;
  }

  const rows = ((data as unknown) as ExternalDocumentRow[] | null) ?? [];
  const createdRows = rows.filter((row) => !existingExternalIds.has(row.external_id));
  if (!input.matterId) {
    return { rows, createdRows };
  }

  const rowsMissingLocalDocument = rows.filter((row) => !row.document_id);
  if (!rowsMissingLocalDocument.length) {
    return { rows, createdRows };
  }

  const { data: insertedDocuments, error: insertDocsError } = await supabase
    .from('documents')
    .insert(
      rowsMissingLocalDocument.map((row) => ({
        org_id: input.orgId,
        matter_id: input.matterId ?? null,
        client_id: input.clientId ?? null,
        title: row.title,
        description: row.download_url
          ? 'تمت مزامنة هذا المستند من ناجز. سيتم تنزيل النسخة وربطها تلقائيًا عبر طبقة المعالجة الخلفية.'
          : 'تمت مزامنة هذا المستند من ناجز بانتظار استكمال النسخة القابلة للتنزيل.',
        folder: '/najiz',
        tags: ['najiz', 'external_sync', row.document_type],
      })),
    )
    .select('id');

  if (insertDocsError) {
    throw insertDocsError;
  }

  const createdDocumentRows = (((insertedDocuments as unknown) as Array<{ id: string }> | null) ?? []);
  const updatePairs = rowsMissingLocalDocument
    .map((row, index) => ({
      externalDocumentId: row.id,
      documentId: createdDocumentRows[index]?.id ?? null,
    }))
    .filter((entry): entry is { externalDocumentId: string; documentId: string } => Boolean(entry.documentId));

  for (const pair of updatePairs) {
    const { error: linkError } = await supabase
      .from('external_documents')
      .update({ document_id: pair.documentId })
      .eq('id', pair.externalDocumentId)
      .eq('org_id', input.orgId);

    if (linkError) {
      throw linkError;
    }

    const inMemoryRow = rows.find((row) => row.id === pair.externalDocumentId);
    if (inMemoryRow) {
      inMemoryRow.document_id = pair.documentId;
    }
  }

  return { rows, createdRows };
}

export async function listMatterExternalDocuments(orgId: string, matterId: string) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('external_documents')
    .select(EXTERNAL_DOCUMENT_SELECT)
    .eq('org_id', orgId)
    .eq('matter_id', matterId)
    .order('issued_at', { ascending: false, nullsFirst: false })
    .order('synced_at', { ascending: false })
    .limit(100);

  if (error) {
    throw error;
  }

  return (((data as unknown) as ExternalDocumentRow[] | null) ?? []);
}

export async function getExternalDocumentById(orgId: string, externalDocumentId: string) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('external_documents')
    .select(EXTERNAL_DOCUMENT_SELECT)
    .eq('org_id', orgId)
    .eq('id', externalDocumentId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? (((data as unknown) as ExternalDocumentRow)) : null;
}

export async function updateExternalDocumentProcessing(input: {
  orgId: string;
  externalDocumentId: string;
  processingStatus: ExternalDocumentPreparationStatus;
  processingError?: string | null;
  processedAt?: string | null;
  lastProcessingAttemptAt?: string | null;
}) {
  const supabase = createSupabaseServerClient();
  const payload: Record<string, unknown> = {
    processing_status: input.processingStatus,
  };

  if (input.processingError !== undefined) {
    payload.processing_error = input.processingError;
  }
  if (input.processedAt !== undefined) {
    payload.processed_at = input.processedAt;
  }
  if (input.lastProcessingAttemptAt !== undefined) {
    payload.last_processing_attempt_at = input.lastProcessingAttemptAt;
  }

  const { data, error } = await supabase
    .from('external_documents')
    .update(payload)
    .eq('org_id', input.orgId)
    .eq('id', input.externalDocumentId)
    .select(EXTERNAL_DOCUMENT_SELECT)
    .single();

  if (error) {
    throw error;
  }

  return ((data as unknown) as ExternalDocumentRow);
}
