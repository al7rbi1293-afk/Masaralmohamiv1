import 'server-only';

import { removeDocumentStorageObjects, runCascadeDelete } from '@/lib/entity-admin';
import { logWarn } from '@/lib/logger';
import { requireOrgIdForUser, requireOwner } from '@/lib/org';
import { createSupabaseServerClient, createSupabaseServerRlsClient } from '@/lib/supabase/server';

export type ClientType = 'person' | 'company';
export type ClientStatus = 'active' | 'archived';

export type Client = {
  id: string;
  org_id: string;
  type: ClientType;
  name: string;
  identity_no: string | null;
  commercial_no: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  agency_number: string | null;
  agency_file_name: string | null;
  agency_storage_path: string | null;
  agency_file_size: number | null;
  agency_file_mime_type: string | null;
  status: ClientStatus;
  created_at: string;
  updated_at: string;
};

export type ListClientsParams = {
  q?: string;
  status?: ClientStatus | 'all';
  page?: number;
  limit?: number;
};

export type PaginatedResult<T> = {
  data: T[];
  page: number;
  limit: number;
  total: number;
};

type IdRow = {
  id: string;
};

type StoragePathRow = {
  storage_path: string | null;
};

type ClientAgencyAttachmentMetaRow = {
  agency_storage_path: string | null;
  agency_file_name: string | null;
};

const CLIENT_SELECT_COLUMNS = [
  'id',
  'org_id',
  'type',
  'name',
  'identity_no',
  'commercial_no',
  'email',
  'phone',
  'notes',
  'agency_number',
  'agency_file_name',
  'agency_storage_path',
  'agency_file_size',
  'agency_file_mime_type',
  'status',
  'created_at',
  'updated_at',
].join(', ');

const CLIENT_AGENCY_BUCKET = 'documents';
const MAX_CLIENT_AGENCY_FILE_SIZE = 20 * 1024 * 1024;

export async function listClients(params: ListClientsParams = {}): Promise<PaginatedResult<Client>> {
  const orgId = await requireOrgIdForUser();
  const supabase = createSupabaseServerRlsClient();

  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(50, Math.max(5, params.limit ?? 20));
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const status = params.status ?? 'active';
  const q = cleanQuery(params.q);

  let query = supabase
    .from('clients')
    .select(CLIENT_SELECT_COLUMNS, { count: 'exact' })
    .eq('org_id', orgId)
    .order('updated_at', { ascending: false })
    .range(from, to);

  if (status !== 'all') {
    query = query.eq('status', status);
  }

  if (q) {
    const pattern = `%${q}%`;
    query = query.or(`name.ilike.${pattern},email.ilike.${pattern},phone.ilike.${pattern}`);
  }

  const { data, error, count } = await query;

  if (error) {
    throw error;
  }

  return {
    data: normalizeClients((data as unknown as Client[] | null) ?? []),
    page,
    limit,
    total: count ?? 0,
  };
}

export async function getClientById(id: string): Promise<Client | null> {
  const orgId = await requireOrgIdForUser();
  const supabase = createSupabaseServerRlsClient();

  const { data, error } = await supabase
    .from('clients')
    .select(CLIENT_SELECT_COLUMNS)
    .eq('org_id', orgId)
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return normalizeClient((data as unknown as Client | null) ?? null);
}

export type CreateClientPayload = {
  id?: string;
  type: ClientType;
  name: string;
  identity_no?: string | null;
  commercial_no?: string | null;
  email: string;
  phone?: string | null;
  notes?: string | null;
  agency_number?: string | null;
  agency_file_name?: string | null;
  agency_storage_path?: string | null;
  agency_file_size?: number | null;
  agency_file_mime_type?: string | null;
};

export async function createClient(payload: CreateClientPayload): Promise<Client> {
  const orgId = await requireOrgIdForUser();
  const supabase = createSupabaseServerRlsClient();
  const normalizedEmail = String(payload.email ?? '').trim().toLowerCase();
  if (!normalizedEmail) {
    throw new Error('البريد الإلكتروني مطلوب.');
  }

  const { data, error } = await supabase
    .from('clients')
    .insert({
      id: payload.id,
      org_id: orgId,
      type: payload.type,
      name: payload.name,
      identity_no: payload.identity_no ?? null,
      commercial_no: payload.commercial_no ?? null,
      email: normalizedEmail,
      phone: payload.phone ?? null,
      notes: payload.notes ?? null,
      agency_number: payload.agency_number ?? null,
      agency_file_name: payload.agency_file_name ?? null,
      agency_storage_path: payload.agency_storage_path ?? null,
      agency_file_size: payload.agency_file_size ?? null,
      agency_file_mime_type: payload.agency_file_mime_type ?? null,
      status: 'active',
    })
    .select(CLIENT_SELECT_COLUMNS)
    .single();

  if (error || !data) {
    throw error ?? new Error('تعذر إنشاء العميل.');
  }

  return normalizeClient(data as unknown as Client) as Client;
}

export type UpdateClientPayload = Partial<CreateClientPayload> & {
  status?: ClientStatus;
};

export async function updateClient(id: string, payload: UpdateClientPayload): Promise<Client> {
  const orgId = await requireOrgIdForUser();
  const supabase = createSupabaseServerRlsClient();

  const update: Record<string, unknown> = {};
  if (payload.type) update.type = payload.type;
  if (payload.name !== undefined) update.name = payload.name;
  if (payload.identity_no !== undefined) update.identity_no = payload.identity_no;
  if (payload.commercial_no !== undefined) update.commercial_no = payload.commercial_no;
  if (payload.email !== undefined) {
    const normalizedEmail = String(payload.email ?? '').trim().toLowerCase();
    if (!normalizedEmail) {
      throw new Error('البريد الإلكتروني مطلوب.');
    }
    update.email = normalizedEmail;
  }
  if (payload.phone !== undefined) update.phone = payload.phone;
  if (payload.notes !== undefined) update.notes = payload.notes;
  if (payload.agency_number !== undefined) update.agency_number = payload.agency_number;
  if (payload.agency_file_name !== undefined) update.agency_file_name = payload.agency_file_name;
  if (payload.agency_storage_path !== undefined) update.agency_storage_path = payload.agency_storage_path;
  if (payload.agency_file_size !== undefined) update.agency_file_size = payload.agency_file_size;
  if (payload.agency_file_mime_type !== undefined) update.agency_file_mime_type = payload.agency_file_mime_type;
  if (payload.status) update.status = payload.status;

  const { data, error } = await supabase
    .from('clients')
    .update(update)
    .eq('org_id', orgId)
    .eq('id', id)
    .select(CLIENT_SELECT_COLUMNS)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error('not_found');
  }

  return normalizeClient(data as unknown as Client) as Client;
}

export async function setClientStatus(id: string, status: ClientStatus): Promise<void> {
  await updateClient(id, { status });
}

export async function deleteClient(id: string): Promise<void> {
  const orgId = await requireOrgIdForUser();
  const agencyStoragePath = await getClientAgencyStoragePath(orgId, id);

  try {
    await runCascadeDelete('delete_client_cascade', { p_client_id: id });
  } catch (error) {
    if (!shouldFallbackToDirectDelete(error)) {
      throw error;
    }

    logWarn('client_delete_rpc_failed_falling_back', {
      clientId: id,
      message: error instanceof Error ? error.message : String(error ?? ''),
    });

    await deleteClientDirect(id);
  }

  if (agencyStoragePath) {
    await removeDocumentStorageObjects([agencyStoragePath]).catch((error) => {
      logWarn('client_agency_storage_cleanup_failed', {
        clientId: id,
        message: error instanceof Error ? error.message : String(error ?? ''),
      });
    });
  }
}

export function validateClientAgencyFile(file: File): string | null {
  if (file.size <= 0) {
    return 'ملف الوكالة غير صالح.';
  }

  if (file.size > MAX_CLIENT_AGENCY_FILE_SIZE) {
    return 'يجب ألا يتجاوز حجم مرفق الوكالة 20 ميجابايت.';
  }

  if (!file.name.trim()) {
    return 'اسم ملف الوكالة غير صالح.';
  }

  return null;
}

export type ClientAgencyUploadResult = {
  file_name: string;
  storage_path: string;
  file_size: number;
  mime_type: string | null;
};

export async function uploadClientAgencyAttachment(
  clientId: string,
  file: File,
): Promise<ClientAgencyUploadResult> {
  const orgId = await requireOrgIdForUser();
  const supabase = createSupabaseServerClient();
  const safeFileName = toSafeFileName(file.name);
  const storagePath = buildClientAgencyStoragePath(orgId, clientId, safeFileName);

  const { error } = await supabase.storage.from(CLIENT_AGENCY_BUCKET).upload(storagePath, file, {
    upsert: true,
    contentType: file.type || undefined,
  });

  if (error) {
    throw new Error('تعذر رفع مرفق الوكالة.');
  }

  const originalFileName = normalizeClientAgencyFileName(file.name);

  return {
    file_name: originalFileName,
    storage_path: storagePath,
    file_size: file.size,
    mime_type: file.type ? file.type.trim() : null,
  };
}

export async function removeClientAgencyAttachment(storagePath: string | null | undefined): Promise<void> {
  const normalized = String(storagePath ?? '').trim();
  if (!normalized) {
    return;
  }

  await removeDocumentStorageObjects([normalized]);
}

export async function getClientAgencySignedDownloadUrl(clientId: string): Promise<string> {
  const orgId = await requireOrgIdForUser();
  const attachmentMeta = await getClientAgencyAttachmentMeta(orgId, clientId);
  const storagePath = attachmentMeta?.storagePath ?? null;

  if (!storagePath) {
    throw new Error('not_found');
  }

  const downloadFileName =
    sanitizeDownloadFileName(attachmentMeta?.fileName || null) ||
    sanitizeDownloadFileName(storagePath.split('/').pop() ?? '') ||
    'agency-attachment';

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.storage.from(CLIENT_AGENCY_BUCKET).createSignedUrl(storagePath, 300, {
    download: downloadFileName,
  });

  if (error || !data?.signedUrl) {
    throw error ?? new Error('تعذر تجهيز رابط التنزيل.');
  }

  return data.signedUrl;
}

function cleanQuery(value?: string) {
  if (!value) return '';
  return value.replaceAll(',', ' ').trim().slice(0, 120);
}

function shouldFallbackToDirectDelete(error: unknown) {
  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error ?? '').toLowerCase();

  if (!message) {
    return true;
  }

  return (
    !message.includes('not_found') &&
    !message.includes('not_allowed') &&
    !message.includes('لا تملك صلاحية')
  );
}

async function deleteClientDirect(id: string): Promise<void> {
  const { orgId } = await requireOwner();
  const supabase = createSupabaseServerClient();

  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('id')
    .eq('org_id', orgId)
    .eq('id', id)
    .maybeSingle();

  if (clientError) {
    throw clientError;
  }

  if (!client) {
    throw new Error('not_found');
  }

  const matterIds = await listMatterIdsForClient(orgId, id);
  const documentIds = await listDocumentIdsForClient(orgId, id, matterIds);
  const storagePaths = await listDocumentStoragePaths(orgId, documentIds);

  if (matterIds.length) {
    await deleteByIds('invoices', orgId, 'matter_id', matterIds);
    await deleteByIds('quotes', orgId, 'matter_id', matterIds);
    await deleteByIds('tasks', orgId, 'matter_id', matterIds);
    await deleteByIds('documents', orgId, 'matter_id', matterIds);
  }

  await deleteByField('invoices', orgId, 'client_id', id);
  await deleteByField('quotes', orgId, 'client_id', id);
  await deleteByField('documents', orgId, 'client_id', id);
  await deleteByField('matters', orgId, 'client_id', id);
  await deleteByField('clients', orgId, 'id', id);

  if (storagePaths.length) {
    await removeDocumentStorageObjects(storagePaths);
  }
}

async function listMatterIdsForClient(orgId: string, clientId: string): Promise<string[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('matters')
    .select('id')
    .eq('org_id', orgId)
    .eq('client_id', clientId);

  if (error) {
    throw error;
  }

  return uniqueIds((data as IdRow[] | null) ?? []);
}

async function listDocumentIdsForClient(
  orgId: string,
  clientId: string,
  matterIds: string[],
): Promise<string[]> {
  const supabase = createSupabaseServerClient();
  const documentIds = new Set<string>();

  const { data: directDocs, error: directDocsError } = await supabase
    .from('documents')
    .select('id')
    .eq('org_id', orgId)
    .eq('client_id', clientId);

  if (directDocsError) {
    throw directDocsError;
  }

  for (const row of (directDocs as IdRow[] | null) ?? []) {
    documentIds.add(String(row.id));
  }

  if (matterIds.length) {
    for (const batch of chunk(matterIds, 100)) {
      const { data: matterDocs, error: matterDocsError } = await supabase
        .from('documents')
        .select('id')
        .eq('org_id', orgId)
        .in('matter_id', batch);

      if (matterDocsError) {
        throw matterDocsError;
      }

      for (const row of (matterDocs as IdRow[] | null) ?? []) {
        documentIds.add(String(row.id));
      }
    }
  }

  return Array.from(documentIds);
}

async function listDocumentStoragePaths(orgId: string, documentIds: string[]): Promise<string[]> {
  if (!documentIds.length) {
    return [];
  }

  const supabase = createSupabaseServerClient();
  const paths = new Set<string>();

  for (const batch of chunk(documentIds, 100)) {
    const { data, error } = await supabase
      .from('document_versions')
      .select('storage_path')
      .eq('org_id', orgId)
      .in('document_id', batch);

    if (error) {
      throw error;
    }

    for (const row of (data as StoragePathRow[] | null) ?? []) {
      const path = String(row.storage_path ?? '').trim();
      if (path) {
        paths.add(path);
      }
    }
  }

  return Array.from(paths);
}

async function getClientAgencyStoragePath(orgId: string, clientId: string): Promise<string | null> {
  const meta = await getClientAgencyAttachmentMeta(orgId, clientId);
  return meta?.storagePath ?? null;
}

async function getClientAgencyAttachmentMeta(
  orgId: string,
  clientId: string,
): Promise<{ storagePath: string; fileName: string | null } | null> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('clients')
    .select('agency_storage_path, agency_file_name')
    .eq('org_id', orgId)
    .eq('id', clientId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const row = data as ClientAgencyAttachmentMetaRow | null;
  const storagePath = String(row?.agency_storage_path ?? '').trim();
  if (!storagePath) {
    return null;
  }

  const fileName = normalizeClientAgencyFileName(row?.agency_file_name) || null;
  return {
    storagePath,
    fileName,
  };
}

function normalizeClients(clients: Client[]): Client[] {
  return clients.map((client) => normalizeClient(client) as Client);
}

function normalizeClient(client: Client | null): Client | null {
  if (!client) {
    return null;
  }

  return {
    ...client,
    agency_file_name: normalizeClientAgencyFileName(client.agency_file_name) || null,
  };
}

async function deleteByIds(
  table: 'tasks' | 'invoices' | 'quotes' | 'documents',
  orgId: string,
  field: 'matter_id',
  ids: string[],
): Promise<void> {
  if (!ids.length) {
    return;
  }

  const supabase = createSupabaseServerClient();

  for (const batch of chunk(ids, 100)) {
    const { error } = await supabase.from(table).delete().eq('org_id', orgId).in(field, batch);
    if (error) {
      throw error;
    }
  }
}

async function deleteByField(
  table: 'clients' | 'matters' | 'documents' | 'quotes' | 'invoices',
  orgId: string,
  field: 'id' | 'client_id',
  value: string,
): Promise<void> {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from(table).delete().eq('org_id', orgId).eq(field, value);

  if (error) {
    throw error;
  }
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  const step = Math.max(1, size);

  for (let index = 0; index < items.length; index += step) {
    chunks.push(items.slice(index, index + step));
  }

  return chunks;
}

function uniqueIds(rows: IdRow[]): string[] {
  return Array.from(new Set(rows.map((row) => String(row.id))));
}

function buildClientAgencyStoragePath(orgId: string, clientId: string, fileName: string) {
  return `org/${orgId}/client/${clientId}/agency/${Date.now()}-${fileName}`;
}

function toSafeFileName(value: string) {
  const cleaned = value
    .replaceAll('\\', '_')
    .replaceAll('/', '_')
    .replaceAll('\u0000', '')
    .trim();

  const parts = cleaned.split('.').filter(Boolean);
  const ext = parts.length > 1 ? parts[parts.length - 1] : '';
  const base = parts.length > 1 ? parts.slice(0, -1).join('.') : cleaned;

  const safeBase = base
    .replace(/[^A-Za-z0-9 _-]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80) || 'file';

  const safeExt = ext
    .replace(/[^A-Za-z0-9]/g, '')
    .slice(0, 12);

  return safeExt ? `${safeBase}.${safeExt}` : safeBase;
}

function sanitizeDownloadFileName(value: string | null | undefined) {
  const normalized = String(value ?? '')
    .replaceAll('\u0000', '')
    .replace(/[\r\n]+/g, ' ')
    .trim();

  if (!normalized) {
    return '';
  }

  return normalized
    .replace(/[\\/]/g, '_')
    .replace(/\s+/g, ' ')
    .slice(0, 180);
}

function normalizeClientAgencyFileName(value: string | null | undefined) {
  const sanitized = sanitizeDownloadFileName(value);
  if (!sanitized) {
    return '';
  }

  const decoded = decodeLatin1MojibakeUtf8(sanitized);
  return sanitizeDownloadFileName(decoded) || sanitized;
}

function decodeLatin1MojibakeUtf8(value: string) {
  if (!/[^\u0000-\u007F]/.test(value)) {
    return value;
  }

  try {
    const decoded = Buffer.from(value, 'latin1').toString('utf8');

    if (!decoded || decoded.includes('\uFFFD')) {
      return value;
    }

    if (Buffer.from(decoded, 'utf8').toString('latin1') !== value) {
      return value;
    }

    if (/^[\u0000-\u00FF]*$/.test(decoded)) {
      return value;
    }

    return decoded;
  } catch {
    return value;
  }
}
