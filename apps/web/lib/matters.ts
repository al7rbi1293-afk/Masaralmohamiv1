import 'server-only';

import { createSupabaseServerRlsClient } from '@/lib/supabase/server';
import { getCurrentAuthUser } from '@/lib/supabase/auth-session';
import { requireOrgIdForUser, type OrgRole } from '@/lib/org';

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
  client_id: string | null;
  title: string;
  status: MatterStatus;
  summary: string | null;
  case_type: string | null;
  claims: string | null;
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
  'id, org_id, client_id, title, status, summary, case_type, claims, assigned_user_id, is_private, created_at, updated_at, client:clients(id, name, email, phone)';

export async function listMatters(params: ListMattersParams = {}): Promise<PaginatedResult<Matter>> {
  const orgId = await requireOrgIdForUser();
  const currentUser = await getCurrentAuthUser();
  if (!currentUser) {
    throw new Error('not_authenticated');
  }
  const supabase = createSupabaseServerRlsClient();
  const currentRole = await getOrgRole(supabase, orgId, currentUser.id);

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

  if (currentRole !== 'owner') {
    const memberMatterIds = await listMatterMemberIdsForUser(supabase, currentUser.id);
    const visibilityClauses = buildMatterVisibilityClauses(currentUser.id, memberMatterIds);
    if (q) {
      const pattern = `%${q}%`;
      query = query.or(buildSearchVisibilityFilter(pattern, visibilityClauses));
    } else {
      query = query.or(visibilityClauses.join(','));
    }
  } else if (q) {
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
  const currentUser = await getCurrentAuthUser();
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

  const matter = normalizeMatter(data as MatterRow);
  if (!matter.is_private) {
    return matter;
  }

  if (!currentUser) {
    return null;
  }

  const currentRole = await getOrgRole(supabase, orgId, currentUser.id);
  if (currentRole === 'owner') {
    return matter;
  }

  if (String(matter.assigned_user_id ?? '') === currentUser.id) {
    return matter;
  }

  const member = await isMatterMember(supabase, matter.id, currentUser.id);
  if (member) {
    return matter;
  }

  return null;
}

export type CreateMatterPayload = {
  client_id?: string | null;
  title: string;
  status?: MatterStatus;
  summary?: string | null;
  case_type?: string | null;
  claims?: string | null;
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
  const currentRole = await getOrgRole(supabase, orgId, currentUser.id);
  if (payload.client_id) {
    await assertClientInOrg(supabase, orgId, payload.client_id);
  }
  if (payload.assigned_user_id) {
    await assertAssignableUserInOrg(supabase, orgId, payload.assigned_user_id);
  }
  if (
    payload.is_private &&
    payload.assigned_user_id &&
    payload.assigned_user_id !== currentUser.id &&
    currentRole !== 'owner'
  ) {
    throw new Error('not_allowed');
  }

  const matterId = crypto.randomUUID();
  const baseInsertPayload = {
    id: matterId,
    org_id: orgId,
    client_id: payload.client_id ?? null,
    title: payload.title,
    status: payload.status ?? 'new',
    summary: payload.summary ?? null,
    assigned_user_id: payload.assigned_user_id ?? currentUser.id,
    is_private: payload.is_private ?? false,
  };
  const extendedInsertPayload = {
    ...baseInsertPayload,
    case_type: payload.case_type ?? null,
    claims: payload.claims ?? null,
  };

  // Avoid INSERT ... SELECT under RLS because private matters are not selectable
  // until the creator is added to matter_members.
  let insertError: unknown = null;
  let usingLegacySchema = false;
  {
    const { error } = await supabase.from('matters').insert(extendedInsertPayload);
    insertError = error;
  }

  if (insertError && supportsLegacyMattersSchema(insertError)) {
    usingLegacySchema = true;
    const { error } = await supabase.from('matters').insert(baseInsertPayload);
    insertError = error;
  }

  if (insertError && isAssignedUserForeignKeyViolation(insertError)) {
    const retryPayload = usingLegacySchema
      ? { ...baseInsertPayload, assigned_user_id: null }
      : { ...extendedInsertPayload, assigned_user_id: null };
    const { error } = await supabase.from('matters').insert(retryPayload);
    insertError = error;
  }

  if (insertError) {
    if ((payload.client_id ?? null) === null && isClientRequiredViolation(insertError)) {
      throw new Error('client_required');
    }
    throw insertError as Error;
  }

  const created = await getMatterByIdUnsafe(supabase, orgId, matterId);
  if (!created) {
    throw new Error('not_found_after_insert');
  }

  if (created.is_private) {
    const memberIds = collectPrivateMatterMemberIds(currentUser.id, created.assigned_user_id);
    const memberError = await upsertMatterMembers(supabase, created.id, memberIds);
    if (memberError) {
      if (isMatterMemberUserForeignKeyViolation(memberError)) {
        return created;
      }
      throw memberError;
    }

    const visibleAfterMemberInsert = await getMatterById(matterId);
    return visibleAfterMemberInsert ?? created;
  }

  return created;
}

export type UpdateMatterPayload = Partial<CreateMatterPayload>;

export async function updateMatter(id: string, payload: UpdateMatterPayload): Promise<Matter> {
  const orgId = await requireOrgIdForUser();
  const currentUser = await getCurrentAuthUser();
  if (!currentUser) {
    throw new Error('not_authenticated');
  }
  const supabase = createSupabaseServerRlsClient();

  if (payload.client_id) {
    await assertClientInOrg(supabase, orgId, payload.client_id);
  }
  if (payload.assigned_user_id) {
    await assertAssignableUserInOrg(supabase, orgId, payload.assigned_user_id);
  }

  const { data: existingMatter, error: existingMatterError } = await supabase
    .from('matters')
    .select('id, assigned_user_id')
    .eq('org_id', orgId)
    .eq('id', id)
    .maybeSingle();

  if (existingMatterError) {
    throw existingMatterError;
  }

  if (!existingMatter) {
    throw new Error('not_found');
  }

  const currentRole = await getOrgRole(supabase, orgId, currentUser.id);
  const canUpdate = currentRole === 'owner' || String((existingMatter as any).assigned_user_id ?? '') === currentUser.id;
  if (!canUpdate) {
    throw new Error('not_allowed');
  }

  if (
    currentRole !== 'owner' &&
    payload.assigned_user_id !== undefined &&
    payload.assigned_user_id !== String((existingMatter as any).assigned_user_id ?? '')
  ) {
    throw new Error('not_allowed');
  }

  const effectiveAssigneeId =
    payload.assigned_user_id !== undefined
      ? payload.assigned_user_id
      : String((existingMatter as any).assigned_user_id ?? '') || null;
  if (payload.is_private && effectiveAssigneeId && effectiveAssigneeId !== currentUser.id && currentRole !== 'owner') {
    throw new Error('not_allowed');
  }

  const update: Record<string, unknown> = {};
  if (payload.client_id !== undefined) update.client_id = payload.client_id;
  if (payload.title !== undefined) update.title = payload.title;
  if (payload.status !== undefined) update.status = payload.status;
  if (payload.summary !== undefined) update.summary = payload.summary;
  if (payload.case_type !== undefined) update.case_type = payload.case_type;
  if (payload.claims !== undefined) update.claims = payload.claims;
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

  if (updated.is_private) {
    const memberIds = collectPrivateMatterMemberIds(currentUser.id, updated.assigned_user_id);
    const memberError = await upsertMatterMembers(supabase, updated.id, memberIds);
    if (memberError && !isMatterMemberUserForeignKeyViolation(memberError)) {
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

async function getMatterByIdUnsafe(
  supabase: ReturnType<typeof createSupabaseServerRlsClient>,
  orgId: string,
  id: string,
) {
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

async function assertAssignableUserInOrg(
  supabase: ReturnType<typeof createSupabaseServerRlsClient>,
  orgId: string,
  userId: string,
) {
  const { data, error } = await supabase
    .from('memberships')
    .select('role')
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const role = (data as { role?: OrgRole } | null)?.role;
  if (!data || (role !== 'owner' && role !== 'lawyer')) {
    throw new Error('assignee_not_found');
  }
}

async function getOrgRole(
  supabase: ReturnType<typeof createSupabaseServerRlsClient>,
  orgId: string,
  userId: string,
): Promise<OrgRole | null> {
  const { data, error } = await supabase
    .from('memberships')
    .select('role')
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as { role?: OrgRole } | null)?.role ?? null;
}

async function listMatterMemberIdsForUser(
  supabase: ReturnType<typeof createSupabaseServerRlsClient>,
  userId: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from('matter_members')
    .select('matter_id')
    .eq('user_id', userId);

  if (error) {
    throw error;
  }

  return ((data as Array<{ matter_id?: string | null }> | null) ?? [])
    .map((row) => String(row.matter_id ?? '').trim())
    .filter(isUuidLike);
}

function buildMatterVisibilityClauses(userId: string, memberMatterIds: string[]) {
  const safeMemberMatterIds = Array.from(new Set(memberMatterIds.filter(isUuidLike)));
  return [`is_private.eq.false`, `assigned_user_id.eq.${userId}`, ...safeMemberMatterIds.map((id) => `id.eq.${id}`)];
}

function buildSearchVisibilityFilter(pattern: string, visibilityClauses: string[]) {
  const searchClauses = [`title.ilike.${pattern}`, `summary.ilike.${pattern}`];
  const combined: string[] = [];
  for (const visibility of visibilityClauses) {
    for (const search of searchClauses) {
      combined.push(`and(${visibility},${search})`);
    }
  }
  return combined.join(',');
}

async function isMatterMember(
  supabase: ReturnType<typeof createSupabaseServerRlsClient>,
  matterId: string,
  userId: string,
) {
  const { data, error } = await supabase
    .from('matter_members')
    .select('matter_id')
    .eq('matter_id', matterId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data);
}

function collectPrivateMatterMemberIds(...userIds: Array<string | null | undefined>) {
  const unique = new Set<string>();
  for (const userId of userIds) {
    const normalized = String(userId ?? '').trim();
    if (isUuidLike(normalized)) {
      unique.add(normalized);
    }
  }
  return [...unique];
}

async function upsertMatterMembers(
  supabase: ReturnType<typeof createSupabaseServerRlsClient>,
  matterId: string,
  userIds: string[],
) {
  if (!userIds.length) {
    return null;
  }

  const { error } = await supabase.from('matter_members').upsert(
    userIds.map((userId) => ({
      matter_id: matterId,
      user_id: userId,
    })),
    {
      onConflict: 'matter_id,user_id',
      ignoreDuplicates: true,
    },
  );

  return error;
}

function cleanQuery(value?: string) {
  if (!value) return '';
  return value.replaceAll(',', ' ').trim().slice(0, 120);
}

function isUuidLike(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function supportsLegacyMattersSchema(error: unknown) {
  const text = getErrorText(error);
  return text.includes('column "case_type" of relation "matters" does not exist') ||
    text.includes('column "claims" of relation "matters" does not exist') ||
    text.includes("Could not find the 'case_type' column of 'matters' in the schema cache") ||
    text.includes("Could not find the 'claims' column of 'matters' in the schema cache");
}

function isClientRequiredViolation(error: unknown) {
  const text = getErrorText(error);
  return text.includes('null value in column "client_id" of relation "matters" violates not-null constraint');
}

function isAssignedUserForeignKeyViolation(error: unknown) {
  const text = getErrorText(error);
  return (
    text.includes('matters_assigned_user_id_fkey') ||
    (text.includes('assigned_user_id') && text.includes('foreign key'))
  );
}

function isMatterMemberUserForeignKeyViolation(error: unknown) {
  const text = getErrorText(error);
  return (
    text.includes('matter_members_user_id_fkey') ||
    (text.includes('matter_members') && text.includes('user_id') && text.includes('foreign key'))
  );
}

function getErrorText(error: unknown) {
  if (!error || typeof error !== 'object') {
    return '';
  }

  const maybeError = error as { message?: string; details?: string; hint?: string };
  return `${maybeError.message ?? ''} ${maybeError.details ?? ''} ${maybeError.hint ?? ''}`;
}
