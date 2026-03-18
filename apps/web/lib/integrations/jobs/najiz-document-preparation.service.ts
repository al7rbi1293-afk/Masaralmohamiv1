import 'server-only';

import { createHash } from 'crypto';
import { logError, logInfo, logWarn } from '@/lib/logger';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { IntegrationActor, IntegrationAccount, JsonObject, SyncJobRecord } from '../domain/models';
import { appendSyncLog, enqueueSyncJob, findQueuedSyncJobByDedupeKey, updateSyncJob } from '../repositories/sync-job.repository';
import {
  getExternalDocumentById,
  type ExternalDocumentRow,
  updateExternalDocumentProcessing,
} from '../repositories/external-documents.repository';
import { createIntegrationNotification } from '../repositories/notifications.repository';

export async function queueNajizDocumentPreparationJobs(input: {
  actor: IntegrationActor;
  account: IntegrationAccount;
  parentJobId?: string | null;
  webhookEventId?: string | null;
  documents: ExternalDocumentRow[];
}) {
  const queueableDocuments = input.documents.filter(
    (document) =>
      Boolean(document.document_id) &&
      Boolean(document.download_url) &&
      document.processing_status !== 'ready',
  );

  let queuedCount = 0;
  const queuedJobIds: string[] = [];

  for (const document of queueableDocuments) {
    const dedupeKey = `najiz:document_prepare:${document.id}`;
    const existing = await findQueuedSyncJobByDedupeKey({
      orgId: input.actor.orgId,
      provider: 'najiz',
      dedupeKey,
    });

    if (existing) {
      queuedJobIds.push(existing.id);
      continue;
    }

    const job = await enqueueSyncJob({
      orgId: input.actor.orgId,
      integrationId: input.account.id,
      provider: 'najiz',
      jobKind: 'document_prepare',
      environment: input.account.activeEnvironment,
      triggerMode: input.parentJobId ? 'system' : 'manual',
      requestedBy: input.actor.userId,
      matterId: document.matter_id,
      subjectType: 'external_document',
      subjectId: document.id,
      retryable: true,
      maxAttempts: 4,
      queueName: 'najiz.documents',
      parentJobId: input.parentJobId ?? null,
      webhookEventId: input.webhookEventId ?? null,
      dedupeKey,
      requestPayload: {
        external_document_id: document.id,
        document_id: document.document_id,
        file_name: document.file_name,
        download_url: document.download_url,
      },
    });

    queuedCount += 1;
    queuedJobIds.push(job.id);

    await updateExternalDocumentProcessing({
      orgId: input.actor.orgId,
      externalDocumentId: document.id,
      processingStatus: 'pending',
      processingError: null,
    });

    await appendSyncLog({
      jobId: job.id,
      orgId: input.actor.orgId,
      provider: 'najiz',
      level: 'info',
      action: 'document_prepare_queued',
      message: 'تمت جدولة تجهيز مستند ناجز في الخلفية.',
      context: {
        external_document_id: document.id,
        document_id: document.document_id,
      },
      createdBy: input.actor.userId,
    });
  }

  return {
    queuedCount,
    queuedJobIds,
  };
}

export async function processNajizDocumentPreparationJob(job: SyncJobRecord) {
  const orgId = job.orgId;
  const externalDocumentId =
    normalizeOptionalString(job.subjectId) ??
    normalizeOptionalString(stringFromJson(job.requestPayload.external_document_id));

  if (!externalDocumentId) {
    return finalizePreparedJob(job, {
      status: 'failed',
      errorMessage: 'missing_external_document_id',
      summary: { ok: false, skipped: false },
    });
  }

  const externalDocument = await getExternalDocumentById(orgId, externalDocumentId);
  if (!externalDocument) {
    return finalizePreparedJob(job, {
      status: 'failed',
      errorMessage: 'external_document_not_found',
      summary: { ok: false, external_document_id: externalDocumentId },
    });
  }

  const nowIso = new Date().toISOString();
  const uploaderId = await resolveUploaderUserId(orgId, job.requestedBy);

  if (!externalDocument.document_id || !externalDocument.download_url) {
    await updateExternalDocumentProcessing({
      orgId,
      externalDocumentId: externalDocument.id,
      processingStatus: 'skipped',
      processingError: externalDocument.download_url ? 'document_link_missing' : 'download_url_missing',
      lastProcessingAttemptAt: nowIso,
      processedAt: nowIso,
    });

    return finalizePreparedJob(job, {
      status: 'partial',
      errorMessage: externalDocument.download_url ? 'document_link_missing' : 'download_url_missing',
      summary: {
        ok: false,
        skipped: true,
        external_document_id: externalDocument.id,
      },
    });
  }

  const supabase = createSupabaseServerClient();
  const { data: latestVersion, error: latestVersionError } = await supabase
    .from('document_versions')
    .select('id, version_no, storage_path')
    .eq('org_id', orgId)
    .eq('document_id', externalDocument.document_id)
    .order('version_no', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestVersionError) {
    throw latestVersionError;
  }

  if (latestVersion?.id) {
    await updateExternalDocumentProcessing({
      orgId,
      externalDocumentId: externalDocument.id,
      processingStatus: 'ready',
      processingError: null,
      lastProcessingAttemptAt: nowIso,
      processedAt: nowIso,
    });

    return finalizePreparedJob(job, {
      status: 'succeeded',
      errorMessage: null,
      summary: {
        ok: true,
        reused_existing_version: true,
        external_document_id: externalDocument.id,
        version_id: String(latestVersion.id),
      },
    });
  }

  await updateExternalDocumentProcessing({
    orgId,
    externalDocumentId: externalDocument.id,
    processingStatus: 'downloading',
    processingError: null,
    lastProcessingAttemptAt: nowIso,
  });

  try {
    const downloaded = await downloadExternalDocument(externalDocument);
    const nextVersionNo = 1;
    const fileName = sanitizeFileName(externalDocument.file_name || `${externalDocument.external_id}.bin`);
    const storagePath = buildStoragePath(orgId, externalDocument.document_id, nextVersionNo, fileName);

    const { error: uploadError } = await supabase.storage.from('documents').upload(storagePath, downloaded.buffer, {
      upsert: false,
      contentType: downloaded.mimeType,
    });

    if (uploadError) {
      throw uploadError;
    }

    const checksum = downloaded.checksum ?? externalDocument.checksum ?? sha256(downloaded.buffer);
    const { data: insertedVersion, error: insertVersionError } = await supabase
      .from('document_versions')
      .insert({
        org_id: orgId,
        document_id: externalDocument.document_id,
        version_no: nextVersionNo,
        storage_path: storagePath,
        file_name: fileName,
        file_size: downloaded.fileSize,
        mime_type: downloaded.mimeType,
        checksum,
        uploaded_by: uploaderId,
      })
      .select('id, document_id, version_no, storage_path')
      .single();

    if (insertVersionError || !insertedVersion) {
      await supabase.storage.from('documents').remove([storagePath]).catch(() => undefined);
      throw insertVersionError ?? new Error('document_version_insert_failed');
    }

    await updateExternalDocumentProcessing({
      orgId,
      externalDocumentId: externalDocument.id,
      processingStatus: 'ready',
      processingError: null,
      lastProcessingAttemptAt: nowIso,
      processedAt: nowIso,
    });

    if (externalDocument.matter_id) {
      await createIntegrationNotification({
        orgId,
        recipientUserId: job.requestedBy,
        category: 'integration_sync',
        title: 'اكتمل تجهيز مستند ناجز',
        body: `تم تجهيز المستند "${externalDocument.title}" وأصبح قابلاً للتنزيل داخل المنصة.`,
        entityType: 'document',
        entityId: externalDocument.document_id,
        payloadJson: {
          matter_id: externalDocument.matter_id,
          external_document_id: externalDocument.id,
          portal_visible: externalDocument.portal_visible,
        },
      }).catch(() => undefined);
    }

    logInfo('najiz_document_prepared', {
      org_id: orgId,
      external_document_id: externalDocument.id,
      document_id: externalDocument.document_id,
      storage_path: storagePath,
    });

    return finalizePreparedJob(job, {
      status: 'succeeded',
      errorMessage: null,
      summary: {
        ok: true,
        external_document_id: externalDocument.id,
        document_id: externalDocument.document_id,
        version_id: String((insertedVersion as { id: string }).id),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'document_prepare_failed';
    await updateExternalDocumentProcessing({
      orgId,
      externalDocumentId: externalDocument.id,
      processingStatus: 'failed',
      processingError: message,
      lastProcessingAttemptAt: nowIso,
    }).catch(() => undefined);

    if (job.retryable && job.attempts < job.maxAttempts && isRetryableError(message)) {
      const updated = await updateSyncJob(job.id, {
        status: 'retrying',
        attempts: job.attempts + 1,
        errorMessage: message,
        summary: {
          ok: false,
          external_document_id: externalDocument.id,
          retry_scheduled: true,
        },
        availableAt: nextRetryAt(job.attempts),
        lockedAt: null,
        lockedBy: null,
      });

      await appendSyncLog({
        jobId: job.id,
        orgId,
        provider: 'najiz',
        level: 'warn',
        action: 'document_prepare_retry_scheduled',
        message,
        context: { external_document_id: externalDocument.id },
        createdBy: job.requestedBy,
      });

      logWarn('najiz_document_prepare_retry', {
        org_id: orgId,
        external_document_id: externalDocument.id,
        message,
      });

      return updated;
    }

    logError('najiz_document_prepare_failed', {
      org_id: orgId,
      external_document_id: externalDocument.id,
      message,
    });

    return finalizePreparedJob(job, {
      status: 'failed',
      errorMessage: message,
      summary: {
        ok: false,
        external_document_id: externalDocument.id,
      },
    });
  }
}

async function finalizePreparedJob(
  job: SyncJobRecord,
  input: {
    status: SyncJobRecord['status'];
    errorMessage: string | null;
    summary: JsonObject;
  },
) {
  const completedAt = input.status === 'retrying' ? undefined : new Date().toISOString();
  const updated = await updateSyncJob(job.id, {
    status: input.status,
    completedAt,
    errorMessage: input.errorMessage,
    summary: input.summary,
    responsePayload: input.summary,
    lockedAt: null,
    lockedBy: null,
    availableAt: input.status === 'retrying' ? undefined : null,
  });

  await appendSyncLog({
    jobId: job.id,
    orgId: job.orgId,
    provider: 'najiz',
    level: input.status === 'succeeded' ? 'info' : input.status === 'partial' || input.status === 'retrying' ? 'warn' : 'error',
    action:
      input.status === 'succeeded'
        ? 'document_prepare_completed'
        : input.status === 'retrying'
        ? 'document_prepare_retrying'
        : 'document_prepare_failed',
    message: input.errorMessage ?? 'تم تجهيز مستند ناجز.',
    context: input.summary,
    createdBy: job.requestedBy,
  }).catch(() => undefined);

  return updated;
}

async function downloadExternalDocument(document: ExternalDocumentRow) {
  if (document.download_url?.includes('sandbox.najiz.example')) {
    const pdf = buildMockPdf(document);
    return {
      buffer: pdf,
      mimeType: document.mime_type || 'application/pdf',
      fileSize: pdf.byteLength,
      checksum: sha256(pdf),
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const response = await fetch(String(document.download_url), {
      method: 'GET',
      signal: controller.signal,
      headers: {
        accept: document.mime_type || '*/*',
      },
    });

    if (!response.ok) {
      throw new Error(`download_failed_${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    return {
      buffer,
      mimeType: response.headers.get('content-type')?.split(';')[0]?.trim() || document.mime_type || inferMimeType(document.file_name),
      fileSize: buffer.byteLength,
      checksum: response.headers.get('x-checksum-sha256') || null,
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('download_timeout');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function resolveUploaderUserId(orgId: string, preferredUserId?: string | null) {
  const supabase = createSupabaseServerClient();
  const preferred = normalizeOptionalString(preferredUserId);
  if (preferred) {
    const { data, error } = await supabase
      .from('app_users')
      .select('id')
      .eq('id', preferred)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (data?.id) {
      return String(data.id);
    }
  }

  const { data: owner, error: ownerError } = await supabase
    .from('memberships')
    .select('user_id')
    .eq('org_id', orgId)
    .eq('role', 'owner')
    .limit(1)
    .maybeSingle();

  if (ownerError) {
    throw ownerError;
  }

  if (owner?.user_id) {
    return String(owner.user_id);
  }

  const { data: fallback, error: fallbackError } = await supabase
    .from('memberships')
    .select('user_id')
    .eq('org_id', orgId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (fallbackError) {
    throw fallbackError;
  }

  if (!fallback?.user_id) {
    throw new Error('document_prepare_uploader_missing');
  }

  return String(fallback.user_id);
}

function buildStoragePath(orgId: string, documentId: string, versionNo: number, fileName: string) {
  return `org/${orgId}/doc/${documentId}/v${versionNo}/${fileName}`;
}

function sanitizeFileName(value: string) {
  const normalized = String(value || 'document')
    .replaceAll('\\', '_')
    .replaceAll('/', '_')
    .replaceAll('\u0000', '')
    .trim();

  const parts = normalized.split('.').filter(Boolean);
  const ext = parts.length > 1 ? parts[parts.length - 1] : '';
  const base = parts.length > 1 ? parts.slice(0, -1).join('.') : normalized;

  const safeBase = base
    .replace(/[^A-Za-z0-9 _-]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80) || 'file';

  const safeExt = ext.replace(/[^A-Za-z0-9]/g, '').slice(0, 12);
  return safeExt ? `${safeBase}.${safeExt}` : safeBase;
}

function inferMimeType(fileName: string) {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  return 'application/octet-stream';
}

function buildMockPdf(document: ExternalDocumentRow) {
  const bodyText = `BT /F1 18 Tf 72 720 Td (Najiz Mock Document) Tj 0 -28 Td /F1 11 Tf (${escapePdfText(document.title)}) Tj 0 -20 Td (${escapePdfText(document.external_id)}) Tj ET`;
  const objects = [
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
    '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj',
    `4 0 obj << /Length ${Buffer.byteLength(bodyText, 'utf8')} >> stream\n${bodyText}\nendstream endobj`,
    '5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
  ];

  let content = '%PDF-1.4\n';
  const objectOffsets = [0];
  for (const object of objects) {
    objectOffsets.push(Buffer.byteLength(content, 'utf8'));
    content += `${object}\n`;
  }

  const xrefStart = Buffer.byteLength(content, 'utf8');
  const xref = [
    'xref',
    `0 ${objects.length + 1}`,
    '0000000000 65535 f ',
    ...objectOffsets.slice(1).map((entry) => `${String(entry).padStart(10, '0')} 00000 n `),
    `trailer << /Size ${objects.length + 1} /Root 1 0 R >>`,
    'startxref',
    String(xrefStart),
    '%%EOF',
  ].join('\n');

  return Buffer.from(`${content}${xref}\n`, 'utf8');
}

function escapePdfText(value: string) {
  return value.replace(/[()\\]/g, '_').replace(/[^\x20-\x7E]/g, '?').slice(0, 120);
}

function sha256(buffer: Buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function stringFromJson(value: unknown) {
  return typeof value === 'string' ? value : null;
}

function isRetryableError(message: string) {
  const normalized = message.toLowerCase();
  return normalized.includes('timeout') || normalized.includes('download_failed_429') || normalized.includes('temporar') || normalized.includes('network');
}

function nextRetryAt(attempt: number) {
  const delayMs = Math.min(15 * 60 * 1000, Math.max(30_000, 60_000 * 2 ** Math.max(0, attempt - 1)));
  return new Date(Date.now() + delayMs).toISOString();
}

function normalizeOptionalString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
