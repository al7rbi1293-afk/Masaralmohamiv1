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

  // Avoid over-fetching: fetch only the latest version for each document (bounded by page size).
  const latestEntries = await mapWithConcurrency(docs, 6, async (doc) => {
    const { data: latest, error: versionsError } = await supabase
      .from('document_versions')
      .select('version_no, file_name, created_at, storage_path, file_size, mime_type, uploaded_by')
      .eq('org_id', orgId)
      .eq('document_id', doc.id)
      .order('version_no', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (versionsError) {
      throw versionsError;
    }

    const normalized = latest
      ? {
          version_no: Number((latest as any).version_no),
          file_name: String((latest as any).file_name),
          created_at: String((latest as any).created_at),
          storage_path: String((latest as any).storage_path),
          file_size: Number((latest as any).file_size),
          mime_type: (latest as any).mime_type ? String((latest as any).mime_type) : null,
          uploaded_by: String((latest as any).uploaded_by),
        }
      : null;

    return [doc.id, normalized] as const;
  });

  const latestByDoc = new Map<string, DocumentWithLatest['latestVersion']>(latestEntries);

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

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  const limit = Math.max(1, Math.min(concurrency, items.length));
  let cursor = 0;

  const workers = Array.from({ length: limit }, async () => {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      results[index] = await mapper(items[index]);
    }
  });

  await Promise.all(workers);
  return results;
}
