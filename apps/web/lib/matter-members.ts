import 'server-only';

import { createSupabaseServerClient } from '@/lib/supabase/server';

export type OrgMemberRole = 'owner' | 'lawyer' | 'assistant';

export type OrgMemberInfo = {
  user_id: string;
  full_name: string;
  email: string | null;
  role: OrgMemberRole;
};

export async function listOrgMembers(orgId: string): Promise<OrgMemberInfo[]> {
  const service = createSupabaseServerClient();

  const { data: memberships, error: membershipsError } = await service
    .from('memberships')
    .select('user_id, role, created_at')
    .eq('org_id', orgId)
    .order('created_at', { ascending: true });

  if (membershipsError) {
    throw membershipsError;
  }

  const membershipRows = (memberships as any[] | null) ?? [];
  const memberIds = membershipRows.map((row) => String(row.user_id));

  if (!memberIds.length) {
    return [];
  }

  const [profilesResult, appUsersResult] = await Promise.all([
    service.from('profiles').select('user_id, full_name').in('user_id', memberIds),
    service.from('app_users').select('id, email, full_name').in('id', memberIds),
  ]);

  if (profilesResult.error) {
    throw profilesResult.error;
  }

  const nameById = new Map<string, string>();
  for (const row of (profilesResult.data as any[] | null) ?? []) {
    if (row?.user_id) {
      nameById.set(String(row.user_id), String(row.full_name ?? ''));
    }
  }

  const emailById = new Map<string, string>();
  for (const row of (appUsersResult.data as any[] | null) ?? []) {
    if (row?.id) {
      const id = String(row.id);
      if ((row.full_name ?? '').toString().trim() && !nameById.get(id)?.trim()) {
        nameById.set(id, String(row.full_name));
      }
      if (row.email) {
        emailById.set(id, String(row.email));
      }
    }
  }

  return membershipRows.map((row) => {
    const id = String(row.user_id);
    return {
      user_id: id,
      full_name: nameById.get(id) ?? '',
      email: emailById.get(id) ?? null,
      role: row.role as OrgMemberRole,
    };
  });
}

export async function enrichOrgMembers(
  orgId: string,
  userIds: string[],
): Promise<OrgMemberInfo[]> {
  const ids = userIds.map((id) => id.trim()).filter(Boolean);
  if (!ids.length) return [];

  const service = createSupabaseServerClient();

  const [{ data: memberships, error: membershipsError }, profilesResult, appUsersResult] =
    await Promise.all([
      service
        .from('memberships')
        .select('user_id, role')
        .eq('org_id', orgId)
        .in('user_id', ids),
      service.from('profiles').select('user_id, full_name').in('user_id', ids),
      service.from('app_users').select('id, email, full_name').in('id', ids),
    ]);

  if (membershipsError) {
    throw membershipsError;
  }
  if (profilesResult.error) {
    throw profilesResult.error;
  }
  const roleById = new Map<string, OrgMemberRole>();
  for (const row of (memberships as any[] | null) ?? []) {
    if (row?.user_id && row?.role) {
      roleById.set(String(row.user_id), row.role as OrgMemberRole);
    }
  }

  const nameById = new Map<string, string>();
  for (const row of (profilesResult.data as any[] | null) ?? []) {
    if (row?.user_id) {
      nameById.set(String(row.user_id), String(row.full_name ?? ''));
    }
  }

  const emailById = new Map<string, string>();
  for (const row of (appUsersResult.data as any[] | null) ?? []) {
    if (row?.id) {
      const id = String(row.id);
      if ((row.full_name ?? '').toString().trim() && !nameById.get(id)?.trim()) {
        nameById.set(id, String(row.full_name));
      }
      if (row.email) {
        emailById.set(id, String(row.email));
      }
    }
  }

  return ids.map((id) => ({
    user_id: id,
    full_name: nameById.get(id) ?? '',
    email: emailById.get(id) ?? null,
    role: roleById.get(id) ?? 'lawyer',
  }));
}

export async function isUserMemberOfOrg(orgId: string, userId: string): Promise<boolean> {
  const service = createSupabaseServerClient();
  const { data, error } = await service
    .from('memberships')
    .select('user_id')
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data);
}
