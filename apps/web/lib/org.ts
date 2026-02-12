import 'server-only';

import { createSupabaseServerRlsClient } from '@/lib/supabase/server';
import { getCurrentAuthUser } from '@/lib/supabase/auth-session';

type MembershipRow = {
  org_id: string;
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
    .select('org_id, created_at')
    .eq('user_id', currentUser.id)
    .order('created_at', { ascending: true })
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

