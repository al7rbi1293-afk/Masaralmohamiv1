import 'server-only';

import type { MobileAppSessionContext } from '@/lib/mobile/auth';
import { isMissingColumnError } from '@/lib/shared-utils';
import type { Document, DocumentVersion } from '@/lib/documents';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { CircuitOpenError, TimeoutError, withCircuitBreaker, withTimeout } from '@/lib/runtime-safety';

type Relation<T> = T | T[] | null;

type DocumentRow = Omit<Document, 'matter' | 'client'> & {
  matter: Relation<Document['matter']>;
  client: Relation<Document['client']>;
};

type DocumentRowLike = Omit<DocumentRow, 'is_archived'> & {
  is_archived?: boolean;
};

const DOCUMENT_SELECT =
  'id, org_id, title, description, folder, tags, is_archived, created_at, matter_id, client_id, matter:matters(id, title), client:clients(id, name)';
const DOCUMENT_SELECT_LEGACY =
  'id, org_id, title, description, folder, tags, created_at, matter_id, client_id, matter:matters(id, title), client:clients(id, name)';
const DOCUMENT_VERSION_SELECT =
  'id, org_id, document_id, version_no, storage_path, file_name, file_size, mime_type, checksum, uploaded_by, created_at';
const DOCUMENT_VERSION_META_SELECT = 'version_no';

function pickRelation<T>(value: Relation<T>) {
  if (!value) return null;
  if (Array.isArray(value)) return (value[0] as T | undefined) ?? null;
  return value;
}

function cleanText(value: unknown) {
  return String(value ?? '').trim();
}

function normalizeFolder(value?: string | null) {
  const normalized = cleanText(value);
  if (!normalized || normalized === '/') return '/';
  return normalized.startsWith('/') ? normalized : `/${normalized}`;
}

function normalizeTags(value: unknown) {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value.map((item) => cleanText(item)).filter(Boolean).slice(0, 20);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      return normalizeTags(JSON.parse(trimmed));
    } catch {
      return trimmed.split(',').map((item) => item.trim()).filter(Boolean).slice(0, 20);
    }
  }

  return [];
}

function normalizeDoc(value: DocumentRowLike): Document {
  const matter = pickRelation(value.matter);
  const client = pickRelation(value.client);

  return {
    ...value,
    is_archived: Boolean(value.is_archived ?? false),
    matter,
    client,
  };
}

function normalizeDisplayFileName(value: string) {
  const cleaned = cleanText(value);
  if (!cleaned) return 'file';
  return cleaned.replaceAll('\u0000', '').slice(0, 180);
}

function toSafeFileName(value: string) {
  const cleaned = String(value ?? '')
    .replaceAll('\\', '_')
    .replaceAll('/', '_')
    .replaceAll('\u0000', '')
    .trim();

  const parts = cleaned.split('.').filter(Boolean);
  const ext = parts.length > 1 ? parts[parts.length - 1] : '';
  const base = parts.length > 1 ? parts.slice(0, -1).join('.') : cleaned;
  const safeBase = base.replace(/[^A-Za-z0-9 _-]/g, '_').replace(/\s+/g, ' ').trim().slice(0, 80) || 'file';
  const safeExt = ext.replace(/[^A-Za-z0-9]/g, '').slice(0, 12);

  return safeExt ? `${safeBase}.${safeExt}` : safeBase;
}

function buildStoragePath(orgId: string, documentId: string, versionNo: number, fileName: string) {
  return `org/${orgId}/doc/${documentId}/v${versionNo}/${fileName}`;
}

async function ensureClientExists(db: MobileAppSessionContext['db'], orgId: string, clientId: string) {
  const { data, error } = await db.from('clients').select('id').eq('org_id', orgId).eq('id', clientId).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('client_not_found');
}

async function ensureMatterExists(db: MobileAppSessionContext['db'], orgId: string, matterId: string) {
  const { data, error } = await db.from('matters').select('id').eq('org_id', orgId).eq('id', matterId).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('matter_not_found');
}

async function getDocumentById(db: MobileAppSessionContext['db'], orgId: string, id: string) {
  let { data, error } = await db
    .from('documents')
    .select(DOCUMENT_SELECT)
    .eq('org_id', orgId)
    .eq('id', id)
    .maybeSingle();

  if (error && isMissingColumnError(error, 'documents', 'is_archived')) {
    ({ data, error } = await db
      .from('documents')
      .select(DOCUMENT_SELECT_LEGACY)
      .eq('org_id', orgId)
      .eq('id', id)
      .maybeSingle());
  }

  if (error) throw error;
  if (!data) return null;
  return normalizeDoc(data as DocumentRowLike);
}

async function getLatestVersion(db: MobileAppSessionContext['db'], orgId: string, documentId: string) {
  const { data, error } = await db
    .from('document_versions')
    .select(DOCUMENT_VERSION_SELECT)
    .eq('org_id', orgId)
    .eq('document_id', documentId)
    .order('version_no', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const version = data as DocumentVersion;
  return {
    version_no: Number(version.version_no),
    file_name: String(version.file_name),
    file_size: Number(version.file_size),
    mime_type: version.mime_type ? String(version.mime_type) : null,
    created_at: String(version.created_at),
    storage_path: String(version.storage_path),
  };
}

async function listVersions(db: MobileAppSessionContext['db'], orgId: string, documentId: string) {
  const { data, error } = await db
    .from('document_versions')
    .select(DOCUMENT_VERSION_SELECT)
    .eq('org_id', orgId)
    .eq('document_id', documentId)
    .order('version_no', { ascending: false });

  if (error) throw error;
  return (data as DocumentVersion[] | null) ?? [];
}

async function createDocumentCore(
  context: MobileAppSessionContext,
  payload: {
    title: string;
    description?: string | null;
    matter_id?: string | null;
    client_id?: string | null;
    folder?: string | null;
    tags?: unknown;
  },
) {
  const orgId = context.org?.id;
  if (!orgId) throw new Error('missing_org');

  if (!cleanText(payload.title)) {
    throw new Error('العنوان مطلوب.');
  }

  if (payload.client_id) await ensureClientExists(context.db, orgId, payload.client_id);
  if (payload.matter_id) await ensureMatterExists(context.db, orgId, payload.matter_id);

  const { data, error } = await context.db
    .from('documents')
    .insert({
      org_id: orgId,
      title: cleanText(payload.title).slice(0, 200),
      description: cleanText(payload.description) || null,
      matter_id: cleanText(payload.matter_id) || null,
      client_id: cleanText(payload.client_id) || null,
      folder: normalizeFolder(payload.folder),
      tags: normalizeTags(payload.tags),
    })
    .select(DOCUMENT_SELECT)
    .single();

  if (error || !data) {
    throw error ?? new Error('تعذر إنشاء المستند.');
  }

  return normalizeDoc(data as DocumentRowLike);
}

async function updateDocumentCore(
  context: MobileAppSessionContext,
  id: string,
  payload: {
    title: string;
    description?: string | null;
    matter_id?: string | null;
    client_id?: string | null;
    folder?: string | null;
    tags?: unknown;
  },
) {
  const orgId = context.org?.id;
  if (!orgId) throw new Error('missing_org');

  const existing = await getDocumentById(context.db, orgId, id);
  if (!existing) throw new Error('not_found');

  if (payload.client_id) await ensureClientExists(context.db, orgId, payload.client_id);
  if (payload.matter_id) await ensureMatterExists(context.db, orgId, payload.matter_id);

  const { data, error } = await context.db
    .from('documents')
    .update({
      title: cleanText(payload.title).slice(0, 200),
      description: cleanText(payload.description) || null,
      matter_id: cleanText(payload.matter_id) || null,
      client_id: cleanText(payload.client_id) || null,
      folder: normalizeFolder(payload.folder),
      tags: normalizeTags(payload.tags),
    })
    .eq('org_id', orgId)
    .eq('id', id)
    .select(DOCUMENT_SELECT)
    .maybeSingle();

  if (error && isMissingColumnError(error, 'documents', 'is_archived')) {
    const legacy = await context.db
      .from('documents')
      .update({
        title: cleanText(payload.title).slice(0, 200),
        description: cleanText(payload.description) || null,
        matter_id: cleanText(payload.matter_id) || null,
        client_id: cleanText(payload.client_id) || null,
        folder: normalizeFolder(payload.folder),
        tags: normalizeTags(payload.tags),
      })
      .eq('org_id', orgId)
      .eq('id', id)
      .select(DOCUMENT_SELECT_LEGACY)
      .maybeSingle();

    if (legacy.error) throw legacy.error;
    if (!legacy.data) throw new Error('not_found');
    return normalizeDoc(legacy.data as DocumentRowLike);
  }

  if (error) throw error;
  if (!data) throw new Error('not_found');

  return normalizeDoc(data as DocumentRowLike);
}

async function setDocumentArchivedCore(context: MobileAppSessionContext, id: string, archived: boolean) {
  const orgId = context.org?.id;
  if (!orgId) throw new Error('missing_org');

  const { data, error } = await context.db
    .from('documents')
    .update({ is_archived: archived })
    .eq('org_id', orgId)
    .eq('id', id)
    .select(DOCUMENT_SELECT)
    .maybeSingle();

  if (error && isMissingColumnError(error, 'documents', 'is_archived')) {
    throw new Error('archive_not_supported');
  }

  if (error) throw error;
  if (!data) throw new Error('not_found');

  return normalizeDoc(data as DocumentRowLike);
}

async function deleteDocumentCore(context: MobileAppSessionContext, id: string) {
  const orgId = context.org?.id;
  if (!orgId) throw new Error('missing_org');

  const { data, error } = await context.db.rpc('delete_document_cascade', {
    p_org_id: orgId,
    p_actor_id: context.user.id,
    p_document_id: id,
  });

  if (error) {
    const message = String(error.message ?? '').toLowerCase();
    if (message.includes('not_found')) throw new Error('not_found');
    if (message.includes('not_allowed')) throw new Error('لا تملك صلاحية لهذا الإجراء.');
    throw error;
  }

  const storagePaths = normalizeStoragePaths(data as { storage_paths?: string[] | null } | null);
  if (storagePaths.length) {
    const { error: removeError } = await context.db.storage.from('documents').remove(storagePaths);
    if (removeError) {
      console.warn('document storage cleanup failed', removeError.message);
    }
  }
}

async function createDocumentVersionCore(
  context: MobileAppSessionContext,
  documentId: string,
  file: File,
) {
  const orgId = context.org?.id;
  if (!orgId) throw new Error('missing_org');

  const document = await getDocumentById(context.db, orgId, documentId);
  if (!document) throw new Error('not_found');

  const latestVersion = await getLatestVersion(context.db, orgId, documentId);
  const nextVersionNo = (latestVersion?.version_no ?? 0) + 1;
  const safeFileName = toSafeFileName(file.name);
  const storagePath = buildStoragePath(orgId, documentId, nextVersionNo, safeFileName);

  const { error: uploadError } = await context.db.storage.from('documents').upload(storagePath, file, {
    upsert: false,
    contentType: file.type || undefined,
  });

  if (uploadError) {
    throw uploadError;
  }

  const { data: version, error: versionError } = await context.db
    .from('document_versions')
    .insert({
      org_id: orgId,
      document_id: documentId,
      version_no: nextVersionNo,
      storage_path: storagePath,
      file_name: normalizeDisplayFileName(file.name),
      file_size: file.size,
      mime_type: file.type ? file.type.trim() : null,
      uploaded_by: context.user.id,
    })
    .select(DOCUMENT_VERSION_SELECT)
    .single();

  if (versionError || !version) {
    await context.db.storage.from('documents').remove([storagePath]);
    throw versionError ?? new Error('تعذر حفظ النسخة.');
  }

  return {
    version: version as DocumentVersion,
    storage_path: storagePath,
  };
}

async function createDocumentWithVersionCore(
  context: MobileAppSessionContext,
  payload: {
    title: string;
    description?: string | null;
    matter_id?: string | null;
    client_id?: string | null;
    folder?: string | null;
    tags?: unknown;
  },
  file: File,
) {
  const document = await createDocumentCore(context, payload);
  try {
    const { version, storage_path } = await createDocumentVersionCore(context, document.id, file);
    return { document, version, storage_path };
  } catch (error) {
    const orgId = context.org?.id;
    if (orgId) {
      await context.db.from('documents').delete().eq('org_id', orgId).eq('id', document.id);
    }
    throw error;
  }
}

async function createDocumentDownloadUrlCore(
  context: MobileAppSessionContext,
  documentId: string,
  params: { storage_path?: string | null; version_id?: string | null; version_no?: number | null } = {},
) {
  const orgId = context.org?.id;
  if (!orgId) throw new Error('missing_org');

  const document = await getDocumentById(context.db, orgId, documentId);
  if (!document) throw new Error('not_found');

  let storagePath = cleanText(params.storage_path) || null;
  let fileName: string | null = null;

  if (params.version_id) {
    const { data, error } = await context.db
      .from('document_versions')
      .select('id, document_id, storage_path, file_name')
      .eq('org_id', orgId)
      .eq('document_id', documentId)
      .eq('id', params.version_id)
      .maybeSingle();

    if (error || !data) throw new Error('not_found');
    storagePath = String((data as { storage_path: string }).storage_path);
    fileName = String((data as { file_name: string }).file_name);
  } else if (params.version_no) {
    const { data, error } = await context.db
      .from('document_versions')
      .select('id, document_id, storage_path, file_name, version_no')
      .eq('org_id', orgId)
      .eq('document_id', documentId)
      .eq('version_no', params.version_no)
      .maybeSingle();

    if (error || !data) throw new Error('not_found');
    storagePath = String((data as { storage_path: string }).storage_path);
    fileName = String((data as { file_name: string }).file_name);
  } else if (storagePath) {
    const { data, error } = await context.db
      .from('document_versions')
      .select('id, document_id, storage_path, file_name')
      .eq('org_id', orgId)
      .eq('document_id', documentId)
      .eq('storage_path', storagePath)
      .maybeSingle();

    if (error || !data) throw new Error('not_found');
    fileName = String((data as { file_name: string }).file_name);
  } else {
    const latest = await getLatestVersion(context.db, orgId, documentId);
    if (!latest) throw new Error('not_found');
    storagePath = latest.storage_path;
    fileName = latest.file_name;
  }

  const service = createSupabaseServerClient();
  let signedUrl: string | null = null;
  let signError: { message?: string } | null = null;

  try {
    const result = (await withCircuitBreaker(
      'mobile.storage.office_document_download_url',
      { failureThreshold: 3, cooldownMs: 30_000 },
      () =>
        withTimeout(
          service.storage.from('documents').createSignedUrl(storagePath, 300, {
            download: sanitizeDownloadFileName(fileName) || 'document',
          }),
          6_000,
          'الخدمة غير متاحة مؤقتًا. حاول مرة أخرى بعد قليل.',
        ),
    )) as { data: { signedUrl: string } | null; error: { message?: string } | null };

    signedUrl = result.data?.signedUrl ?? null;
    signError = result.error;
  } catch (error) {
    if (error instanceof TimeoutError || error instanceof CircuitOpenError) {
      throw new Error('الخدمة غير متاحة مؤقتًا. حاول مرة أخرى بعد قليل.');
    }
    throw error;
  }

  if (signError || !signedUrl) {
    throw signError ?? new Error('تعذر تجهيز رابط التنزيل.');
  }

  return { signedDownloadUrl: signedUrl, storage_path: storagePath };
}

function sanitizeDownloadFileName(value: string | null | undefined) {
  const normalized = cleanText(value).replaceAll('\u0000', '').replace(/[\r\n]+/g, ' ').trim();
  if (!normalized) return '';
  return normalized.replace(/[\\/]/g, '_').replace(/\s+/g, ' ').slice(0, 180);
}

function normalizeStoragePaths(result: { storage_paths?: string[] | null } | null) {
  if (!result?.storage_paths || !Array.isArray(result.storage_paths)) return [];
  return result.storage_paths.map((value) => cleanText(value)).filter(Boolean);
}

export async function createOfficeDocument(
  context: MobileAppSessionContext,
  payload: {
    title: string;
    description?: string | null;
    matter_id?: string | null;
    client_id?: string | null;
    folder?: string | null;
    tags?: unknown;
  },
) {
  return createDocumentCore(context, payload);
}

export async function updateOfficeDocument(
  context: MobileAppSessionContext,
  id: string,
  payload: {
    title: string;
    description?: string | null;
    matter_id?: string | null;
    client_id?: string | null;
    folder?: string | null;
    tags?: unknown;
  },
) {
  return updateDocumentCore(context, id, payload);
}

export async function setOfficeDocumentArchived(context: MobileAppSessionContext, id: string, archived: boolean) {
  return setDocumentArchivedCore(context, id, archived);
}

export async function deleteOfficeDocument(context: MobileAppSessionContext, id: string) {
  await deleteDocumentCore(context, id);
  return { deleted: true as const };
}

export async function getOfficeDocumentDetails(context: MobileAppSessionContext, id: string) {
  const orgId = context.org?.id;
  if (!orgId) throw new Error('missing_org');

  const document = await getDocumentById(context.db, orgId, id);
  if (!document) return null;

  const latestVersion = await getLatestVersion(context.db, orgId, id);
  return { document, latestVersion };
}

export async function listOfficeDocumentVersions(context: MobileAppSessionContext, id: string) {
  const orgId = context.org?.id;
  if (!orgId) throw new Error('missing_org');

  const document = await getDocumentById(context.db, orgId, id);
  if (!document) throw new Error('not_found');

  return listVersions(context.db, orgId, id);
}

export async function createOfficeDocumentUpload(
  context: MobileAppSessionContext,
  payload: {
    title: string;
    description?: string | null;
    matter_id?: string | null;
    client_id?: string | null;
    folder?: string | null;
    tags?: unknown;
  },
  file: File,
) {
  return createDocumentWithVersionCore(context, payload, file);
}

export async function addOfficeDocumentVersion(context: MobileAppSessionContext, id: string, file: File) {
  return createDocumentVersionCore(context, id, file);
}

export async function createOfficeDocumentDownloadUrl(
  context: MobileAppSessionContext,
  id: string,
  params?: { storage_path?: string | null; version_id?: string | null; version_no?: number | null },
) {
  return createDocumentDownloadUrlCore(context, id, params);
}
