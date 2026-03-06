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
    .select(
      'id, org_id, type, name, identity_no, commercial_no, email, phone, notes, status, created_at, updated_at',
      { count: 'exact' },
    )
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
    data: (data as Client[] | null) ?? [],
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
    .select(
      'id, org_id, type, name, identity_no, commercial_no, email, phone, notes, status, created_at, updated_at',
    )
    .eq('org_id', orgId)
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as Client | null) ?? null;
}

export type CreateClientPayload = {
  type: ClientType;
  name: string;
  identity_no?: string | null;
  commercial_no?: string | null;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
};

export async function createClient(payload: CreateClientPayload): Promise<Client> {
  const orgId = await requireOrgIdForUser();
  const supabase = createSupabaseServerRlsClient();

  const { data, error } = await supabase
    .from('clients')
    .insert({
      org_id: orgId,
      type: payload.type,
      name: payload.name,
      identity_no: payload.identity_no ?? null,
      commercial_no: payload.commercial_no ?? null,
      email: payload.email ?? null,
      phone: payload.phone ?? null,
      notes: payload.notes ?? null,
      status: 'active',
    })
    .select(
      'id, org_id, type, name, identity_no, commercial_no, email, phone, notes, status, created_at, updated_at',
    )
    .single();

  if (error || !data) {
    throw error ?? new Error('تعذر إنشاء العميل.');
  }

  return data as Client;
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
  if (payload.email !== undefined) update.email = payload.email;
  if (payload.phone !== undefined) update.phone = payload.phone;
  if (payload.notes !== undefined) update.notes = payload.notes;
  if (payload.status) update.status = payload.status;

  const { data, error } = await supabase
    .from('clients')
    .update(update)
    .eq('org_id', orgId)
    .eq('id', id)
    .select(
      'id, org_id, type, name, identity_no, commercial_no, email, phone, notes, status, created_at, updated_at',
    )
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error('not_found');
  }

  return data as Client;
}

export async function setClientStatus(id: string, status: ClientStatus): Promise<void> {
  await updateClient(id, { status });
}

export async function deleteClient(id: string): Promise<void> {
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
