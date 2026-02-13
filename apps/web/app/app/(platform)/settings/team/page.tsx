import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { TeamManagementClient, type TeamInvitationItem, type TeamMemberItem } from '@/components/team/team-management-client';
import { getPublicSiteUrl } from '@/lib/env';
import { getCurrentAuthUser } from '@/lib/supabase/auth-session';
import { listInvitations, listMembers, TeamHttpError } from '@/lib/team';

export default async function TeamSettingsPage() {
  const user = await getCurrentAuthUser();
  if (!user) {
    return (
      <Card className="p-6">
        <p className="text-sm text-slate-700 dark:text-slate-200">الرجاء تسجيل الدخول.</p>
      </Card>
    );
  }

  let members: TeamMemberItem[] = [];
  let invites: TeamInvitationItem[] = [];

  try {
    const [memberRows, invitationRows] = await Promise.all([listMembers(), listInvitations()]);
    members = memberRows;
    invites = invitationRows;
  } catch (error) {
    if (error instanceof TeamHttpError && error.status === 403) {
      return (
        <Card className="p-6">
          <h1 className="text-xl font-bold text-brand-navy dark:text-slate-100">الفريق</h1>
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
            لا تملك صلاحية الوصول.
          </p>
          <div className="mt-4">
            <Link href="/app" className={buttonVariants('outline', 'sm')}>
              العودة إلى المنصة
            </Link>
          </div>
        </Card>
      );
    }

    if (error instanceof TeamHttpError) {
      return (
        <Card className="p-6">
          <h1 className="text-xl font-bold text-brand-navy dark:text-slate-100">الفريق</h1>
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
            {error.message}
          </p>
          <div className="mt-4">
            <Link href="/app" className={buttonVariants('outline', 'sm')}>
              العودة إلى المنصة
            </Link>
          </div>
        </Card>
      );
    }

    throw error;
  }

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
