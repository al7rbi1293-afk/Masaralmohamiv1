import 'server-only';
import { cookies } from 'next/headers';

import { createSupabaseServerRlsClient } from '@/lib/supabase/server';
import { getCurrentAuthUser } from '@/lib/supabase/auth-session';

type MembershipRow = {
  org_id: string;
  created_at: string;
};

export type OrgRole = 'owner' | 'lawyer' | 'assistant';

export async function getCurrentOrgIdForUser(): Promise<string | null> {
  const currentUser = await getCurrentAuthUser();
  if (!currentUser) {
    return null;
  }

  const supabase = createSupabaseServerRlsClient();

  // 1. Check if there's an active_org_id cookie
  const activeOrgId = cookies().get('active_org_id')?.value;
  if (activeOrgId) {
    const { data: cookieMembership } = await supabase
      .from('memberships')
      .select('org_id')
      .eq('user_id', currentUser.id)
      .eq('org_id', activeOrgId)
      .maybeSingle();

    if (cookieMembership) {
      return cookieMembership.org_id;
    }
  }

  // 2. Fall back to the most recent membership
  const { data, error } = await supabase
    .from('memberships')
    .select('org_id, created_at')
    .eq('user_id', currentUser.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as MembershipRow | null)?.org_id ?? null;
}

export async function requireOrgIdForUser(): Promise<string> {
  const orgId = await getCurrentOrgIdForUser();
  if (!orgId) {
    throw new Error(
      'لا يوجد مكتب مفعّل لهذا الحساب. ابدأ التجربة من الصفحة الرئيسية أو تواصل معنا.',
    );
  }
  return orgId;
}

export async function requireOwner(): Promise<{ orgId: string; userId: string }> {
  const currentUser = await getCurrentAuthUser();
  if (!currentUser) {
    throw new Error('الرجاء تسجيل الدخول.');
  }

  const orgId = await requireOrgIdForUser();
  const supabase = createSupabaseServerRlsClient();
  const { data, error } = await supabase
    .from('memberships')
    .select('role')
    .eq('org_id', orgId)
    .eq('user_id', currentUser.id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data || (data as any).role !== 'owner') {
    throw new Error('لا تملك صلاحية تنفيذ هذا الإجراء.');
  }

  return { orgId, userId: currentUser.id };
}
