import 'server-only';

import { createSupabaseServerRlsClient } from '@/lib/supabase/server';
import { requireOrgIdForUser } from '@/lib/org';

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

function cleanQuery(value?: string) {
  if (!value) return '';
  return value.replaceAll(',', ' ').trim().slice(0, 120);
}
