import 'server-only';

import { createSupabaseServerRlsClient } from '@/lib/supabase/server';
import { requireOrgIdForUser } from '@/lib/org';

export type Document = {
  id: string;
  org_id: string;
  matter_id: string | null;
  client_id: string | null;
  title: string;
  description: string | null;
  folder: string;
  tags: unknown;
  created_at: string;
  matter: { id: string; title: string } | null;
  client: { id: string; name: string } | null;
};

type DocumentRow = Omit<Document, 'matter' | 'client'> & {
  matter: Document['matter'] | Document['matter'][] | null;
  client: Document['client'] | Document['client'][] | null;
};

export type DocumentVersion = {
  id: string;
  org_id: string;
  document_id: string;
  version_no: number;
  storage_path: string;
  file_name: string;
  file_size: number;
  mime_type: string | null;
  checksum: string | null;
  uploaded_by: string;
  created_at: string;
};

export type DocumentWithLatest = Document & {
  latestVersion: Pick<
    DocumentVersion,
    'version_no' | 'file_name' | 'created_at' | 'storage_path' | 'file_size' | 'mime_type' | 'uploaded_by'
  > | null;
};

export type ListDocumentsParams = {
  q?: string;
  matterId?: string;
  page?: number;
  limit?: number;
};

export type PaginatedResult<T> = {
  data: T[];
  page: number;
  limit: number;
  total: number;
};

const DOCUMENT_SELECT =
  'id, org_id, title, description, folder, tags, created_at, matter_id, client_id, matter:matters(id, title), client:clients(id, name)';

export async function listDocuments(params: ListDocumentsParams = {}): Promise<PaginatedResult<DocumentWithLatest>> {
  const orgId = await requireOrgIdForUser();
  const supabase = createSupabaseServerRlsClient();

  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(50, Math.max(5, params.limit ?? 10));
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const q = cleanQuery(params.q);
  const matterId = params.matterId?.trim();

  let query = supabase
    .from('documents')
    .select(DOCUMENT_SELECT, { count: 'exact' })
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (matterId) {
    query = query.eq('matter_id', matterId);
  }

  if (q) {
    const pattern = `%${q}%`;
    query = query.ilike('title', pattern);
  }

  const { data, error, count } = await query;
  if (error) {
    throw error;
  }

  const docs = (data as DocumentRow[] | null) ?? [];
  if (!docs.length) {
    return {
      data: [],
      page,
      limit,
      total: count ?? 0,
    };
  }

  const ids = docs.map((doc) => doc.id);
  const { data: versions, error: versionsError } = await supabase
    .from('document_versions')
    .select('document_id, version_no, file_name, created_at, storage_path, file_size, mime_type, uploaded_by')
    .eq('org_id', orgId)
    .in('document_id', ids)
    .order('version_no', { ascending: false });

  if (versionsError) {
    throw versionsError;
  }

  const latestByDoc = new Map<string, DocumentWithLatest['latestVersion']>();
  for (const row of (versions as any[] | null) ?? []) {
    const documentId = String(row.document_id);
    if (latestByDoc.has(documentId)) continue;
    latestByDoc.set(documentId, {
      version_no: Number(row.version_no),
      file_name: String(row.file_name),
      created_at: String(row.created_at),
      storage_path: String(row.storage_path),
      file_size: Number(row.file_size),
      mime_type: row.mime_type ? String(row.mime_type) : null,
      uploaded_by: String(row.uploaded_by),
    });
  }

  return {
    data: docs.map((doc) => ({
      ...normalizeDoc(doc),
      latestVersion: latestByDoc.get(doc.id) ?? null,
    })),
    page,
    limit,
    total: count ?? 0,
  };
}

export async function getDocumentById(id: string): Promise<Document | null> {
  const orgId = await requireOrgIdForUser();
  const supabase = createSupabaseServerRlsClient();

  const { data, error } = await supabase
    .from('documents')
    .select(DOCUMENT_SELECT)
    .eq('org_id', orgId)
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? normalizeDoc(data as DocumentRow) : null;
}

export async function listDocumentVersions(documentId: string): Promise<DocumentVersion[]> {
  const orgId = await requireOrgIdForUser();
  const supabase = createSupabaseServerRlsClient();

  const { data, error } = await supabase
    .from('document_versions')
    .select(
      'id, org_id, document_id, version_no, storage_path, file_name, file_size, mime_type, checksum, uploaded_by, created_at',
    )
    .eq('org_id', orgId)
    .eq('document_id', documentId)
    .order('version_no', { ascending: false });

  if (error) {
    throw error;
  }

  return (data as DocumentVersion[] | null) ?? [];
}

function normalizeDoc(value: DocumentRow): Document {
  const rawMatter = value.matter;
  const rawClient = value.client;

  const matter = Array.isArray(rawMatter) ? rawMatter[0] ?? null : rawMatter ?? null;
  const client = Array.isArray(rawClient) ? rawClient[0] ?? null : rawClient ?? null;

  return {
    ...value,
    matter,
    client,
  };
}

function cleanQuery(value?: string) {
  if (!value) return '';
  return value.replaceAll(',', ' ').trim().slice(0, 120);
}
