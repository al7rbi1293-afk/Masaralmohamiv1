import 'server-only';

import { createSupabaseServerRlsClient } from '@/lib/supabase/server';
import { getCurrentAuthUser } from '@/lib/supabase/auth-session';

export type MembershipRole = 'owner' | 'lawyer' | 'assistant';

export type CurrentOrgContext = {
  orgId: string | null;
  orgName: string | null;
  role: MembershipRole | null;
};

type MembershipRow = {
  org_id: string;
  role: MembershipRole;
  created_at: string;
};

export async function getCurrentOrgIdForUser(): Promise<string | null> {
  const currentUser = await getCurrentAuthUser();
  if (!currentUser) {
    return null;
  }

  const supabase = createSupabaseServerRlsClient();
  const { data, error } = await supabase
    .from('memberships')
    .select('org_id, role, created_at')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as MembershipRow | null)?.org_id ?? null;
}

export async function getCurrentOrgContextForUser(): Promise<CurrentOrgContext> {
  const currentUser = await getCurrentAuthUser();
  if (!currentUser) {
    return { orgId: null, orgName: null, role: null };
  }

  const supabase = createSupabaseServerRlsClient();
  const { data: membershipData, error: membershipError } = await supabase
    .from('memberships')
    .select('org_id, role, created_at')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    throw membershipError;
  }

  const membership = membershipData as MembershipRow | null;
  if (!membership) {
    return { orgId: null, orgName: null, role: null };
  }

  const { data: orgData, error: orgError } = await supabase
    .from('organizations')
    .select('name')
    .eq('id', membership.org_id)
    .maybeSingle();

  if (orgError) {
    throw orgError;
  }

  return {
    orgId: membership.org_id,
    orgName: (orgData as { name: string } | null)?.name ?? null,
    role: membership.role,
  };
}

