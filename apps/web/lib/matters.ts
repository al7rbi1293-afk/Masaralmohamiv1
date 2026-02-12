import 'server-only';

import { createSupabaseServerRlsClient } from '@/lib/supabase/server';
import { getCurrentAuthUser } from '@/lib/supabase/auth-session';
import { requireOrgIdForUser } from '@/lib/org';

export type MatterStatus = 'new' | 'in_progress' | 'on_hold' | 'closed' | 'archived';

export type MatterClient = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
};

export type Matter = {
  id: string;
  org_id: string;
  client_id: string;
  title: string;
  status: MatterStatus;
  summary: string | null;
  assigned_user_id: string | null;
  is_private: boolean;
  created_at: string;
  updated_at: string;
  client: MatterClient | null;
};

type MatterRow = Omit<Matter, 'client'> & {
  client: MatterClient | MatterClient[] | null;
};

export type ListMattersParams = {
  q?: string;
  status?: MatterStatus | 'all';
  clientId?: string;
  page?: number;
  limit?: number;
};

export type PaginatedResult<T> = {
  data: T[];
  page: number;
  limit: number;
  total: number;
};

const MATTER_SELECT =
  'id, org_id, client_id, title, status, summary, assigned_user_id, is_private, created_at, updated_at, client:clients(id, name, email, phone)';

export async function listMatters(params: ListMattersParams = {}): Promise<PaginatedResult<Matter>> {
  const orgId = await requireOrgIdForUser();
  const supabase = createSupabaseServerRlsClient();

  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(50, Math.max(5, params.limit ?? 20));
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const status = params.status ?? 'all';
  const q = cleanQuery(params.q);
  const clientId = params.clientId?.trim();

  let query = supabase
    .from('matters')
    .select(MATTER_SELECT, { count: 'exact' })
    .eq('org_id', orgId)
    .order('updated_at', { ascending: false })
    .range(from, to);

  if (status !== 'all') {
    query = query.eq('status', status);
  }

  if (clientId) {
    query = query.eq('client_id', clientId);
  }

  if (q) {
    const pattern = `%${q}%`;
    query = query.or(`title.ilike.${pattern},summary.ilike.${pattern}`);
  }

  const { data, error, count } = await query;
  if (error) {
    throw error;
  }

  return {
    data: ((data as MatterRow[] | null) ?? []).map(normalizeMatter),
    page,
    limit,
    total: count ?? 0,
  };
}

export async function getMatterById(id: string): Promise<Matter | null> {
  const orgId = await requireOrgIdForUser();
  const supabase = createSupabaseServerRlsClient();

  const { data, error } = await supabase
    .from('matters')
    .select(MATTER_SELECT)
    .eq('org_id', orgId)
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return normalizeMatter(data as MatterRow);
}

export type CreateMatterPayload = {
  client_id: string;
  title: string;
  status?: MatterStatus;
  summary?: string | null;
  assigned_user_id?: string | null;
  is_private?: boolean;
};

export async function createMatter(payload: CreateMatterPayload): Promise<Matter> {
  const orgId = await requireOrgIdForUser();
  const currentUser = await getCurrentAuthUser();
  if (!currentUser) {
    throw new Error('not_authenticated');
  }

  const supabase = createSupabaseServerRlsClient();
  await assertClientInOrg(supabase, orgId, payload.client_id);

  const { data, error } = await supabase
    .from('matters')
    .insert({
      org_id: orgId,
      client_id: payload.client_id,
      title: payload.title,
      status: payload.status ?? 'new',
      summary: payload.summary ?? null,
      assigned_user_id: payload.assigned_user_id ?? currentUser.id,
      is_private: payload.is_private ?? false,
    })
    .select(MATTER_SELECT)
    .single();

  if (error || !data) {
    throw error ?? new Error('تعذر إنشاء القضية.');
  }

  const created = normalizeMatter(data as MatterRow);

  if (created.is_private) {
    const { error: memberError } = await supabase.from('matter_members').upsert(
      {
        matter_id: created.id,
        user_id: currentUser.id,
      },
      {
        onConflict: 'matter_id,user_id',
        ignoreDuplicates: true,
      },
    );

    if (memberError) {
      throw memberError;
    }
  }

  return created;
}

export type UpdateMatterPayload = Partial<CreateMatterPayload>;

export async function updateMatter(id: string, payload: UpdateMatterPayload): Promise<Matter> {
  const orgId = await requireOrgIdForUser();
  const currentUser = await getCurrentAuthUser();
  const supabase = createSupabaseServerRlsClient();

  if (payload.client_id) {
    await assertClientInOrg(supabase, orgId, payload.client_id);
  }

  const update: Record<string, unknown> = {};
  if (payload.client_id !== undefined) update.client_id = payload.client_id;
  if (payload.title !== undefined) update.title = payload.title;
  if (payload.status !== undefined) update.status = payload.status;
  if (payload.summary !== undefined) update.summary = payload.summary;
  if (payload.assigned_user_id !== undefined) update.assigned_user_id = payload.assigned_user_id;
  if (payload.is_private !== undefined) update.is_private = payload.is_private;

  const { data, error } = await supabase
    .from('matters')
    .update(update)
    .eq('org_id', orgId)
    .eq('id', id)
    .select(MATTER_SELECT)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error('not_found');
  }

  const updated = normalizeMatter(data as MatterRow);

  if (updated.is_private && currentUser) {
    const { error: memberError } = await supabase.from('matter_members').upsert(
      {
        matter_id: updated.id,
        user_id: currentUser.id,
      },
      {
        onConflict: 'matter_id,user_id',
        ignoreDuplicates: true,
      },
    );

    if (memberError) {
      throw memberError;
    }
  }

  return updated;
}

export async function archiveMatter(id: string): Promise<Matter> {
  return updateMatter(id, { status: 'archived' });
}

export async function restoreMatter(id: string): Promise<Matter> {
  return updateMatter(id, { status: 'new' });
}

function normalizeMatter(value: MatterRow): Matter {
  const rawClient = value.client;
  const client = Array.isArray(rawClient) ? rawClient[0] ?? null : rawClient ?? null;

  return {
    ...value,
    client,
  };
}

async function assertClientInOrg(
  supabase: ReturnType<typeof createSupabaseServerRlsClient>,
  orgId: string,
  clientId: string,
) {
  const { data, error } = await supabase
    .from('clients')
    .select('id')
    .eq('org_id', orgId)
    .eq('id', clientId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error('client_not_found');
  }
}

function cleanQuery(value?: string) {
  if (!value) return '';
  return value.replaceAll(',', ' ').trim().slice(0, 120);
}
