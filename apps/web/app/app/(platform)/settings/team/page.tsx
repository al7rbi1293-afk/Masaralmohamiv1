import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { TeamManagementClient, type TeamInvitationItem, type TeamMemberItem } from '@/components/team/team-management-client';
import { requireOrgIdForUser } from '@/lib/org';
import { getPublicSiteUrl } from '@/lib/env';
import { getCurrentAuthUser } from '@/lib/supabase/auth-session';
import { createSupabaseServerClient, createSupabaseServerRlsClient } from '@/lib/supabase/server';

export default async function TeamSettingsPage() {
  const user = await getCurrentAuthUser();
  if (!user) {
    return (
      <Card className="p-6">
        <p className="text-sm text-slate-700 dark:text-slate-200">يرجى تسجيل الدخول.</p>
      </Card>
    );
  }

  const orgId = await requireOrgIdForUser();
  const supabase = createSupabaseServerRlsClient();

  const { data: membership, error: membershipError } = await supabase
    .from('memberships')
    .select('role')
    .eq('org_id', orgId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (membershipError || !membership || membership.role !== 'owner') {
    return (
      <Card className="p-6">
        <h1 className="text-xl font-bold text-brand-navy dark:text-slate-100">الفريق</h1>
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          لا تملك صلاحية الوصول.
        </p>
        <div className="mt-4">
          <Link href="/app/settings" className={buttonVariants('outline', 'sm')}>
            العودة إلى الإعدادات
          </Link>
        </div>
      </Card>
    );
  }

  const service = createSupabaseServerClient();

  const { data: memberRows, error: membersError } = await service
    .from('memberships')
    .select('user_id, role, created_at')
    .eq('org_id', orgId)
    .order('created_at', { ascending: true });

  if (membersError) {
    throw membersError;
  }

  const memberIds = (memberRows as any[] | null)?.map((row) => String(row.user_id)) ?? [];

  const [authUsers, profiles, invitations] = await Promise.all([
    memberIds.length
      ? service
          .schema('auth')
          .from('users')
          .select('id, email')
          .in('id', memberIds)
      : Promise.resolve({ data: [], error: null } as any),
    memberIds.length
      ? service.from('profiles').select('user_id, full_name').in('user_id', memberIds)
      : Promise.resolve({ data: [], error: null } as any),
    service
      .from('org_invitations')
      .select('id, email, role, token, expires_at, accepted_at, created_at')
      .eq('org_id', orgId)
      .is('accepted_at', null)
      .order('created_at', { ascending: false })
      .limit(50),
  ]);

  if (authUsers.error) {
    throw authUsers.error;
  }
  if (profiles.error) {
    throw profiles.error;
  }
  if (invitations.error) {
    throw invitations.error;
  }

  const emailById = new Map<string, string>();
  for (const row of (authUsers.data as any[] | null) ?? []) {
    if (row?.id && row?.email) {
      emailById.set(String(row.id), String(row.email));
    }
  }

  const nameById = new Map<string, string>();
  for (const row of (profiles.data as any[] | null) ?? []) {
    if (row?.user_id) {
      nameById.set(String(row.user_id), String(row.full_name ?? ''));
    }
  }

  const members: TeamMemberItem[] = (memberRows as any[] | null)?.map((row) => {
    const userId = String(row.user_id);
    return {
      user_id: userId,
      email: emailById.get(userId) ?? null,
      full_name: nameById.get(userId) ?? '',
      role: row.role as TeamMemberItem['role'],
      created_at: String(row.created_at),
      is_current_user: userId === user.id,
    };
  }) ?? [];

  const invites: TeamInvitationItem[] = ((invitations.data as any[] | null) ?? []).map((row) => ({
    id: String(row.id),
    email: String(row.email),
    role: row.role as TeamInvitationItem['role'],
    token: String(row.token),
    expires_at: String(row.expires_at),
    accepted_at: row.accepted_at ? String(row.accepted_at) : null,
    created_at: String(row.created_at),
  }));

  return (
    <Card className="p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-brand-navy dark:text-slate-100">إدارة الفريق</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            دعوة أعضاء جدد وإدارة الأدوار (للمالك فقط).
          </p>
        </div>
        <Link href="/app/settings" className={buttonVariants('outline', 'sm')}>
          رجوع
        </Link>
      </div>

      <TeamManagementClient
        publicSiteUrl={getPublicSiteUrl()}
        currentUserId={user.id}
        members={members}
        invitations={invites}
      />
    </Card>
  );
}
