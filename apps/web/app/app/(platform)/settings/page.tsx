import { redirect } from 'next/navigation';
import { signOutAction } from '@/app/app/actions';
import { buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import Link from 'next/link';
import { createSupabaseServerRlsClient } from '@/lib/supabase/server';
import { getCurrentAuthUser } from '@/lib/supabase/auth-session';
import { getTrialStatusForCurrentUser } from '@/lib/trial';

const supportEmail = 'masar.almohami@outlook.sa';

type ProfileRow = {
  full_name: string;
};

function statusLabel(status: 'active' | 'expired' | 'none') {
  if (status === 'active') return 'نشطة';
  if (status === 'expired') return 'منتهية';
  return 'غير مبدوءة';
}

export default async function SettingsPage() {
  const [user, trial] = await Promise.all([
    getCurrentAuthUser(),
    getTrialStatusForCurrentUser(),
  ]);

  if (!user) {
    redirect('/signin');
  }

  const supabase = createSupabaseServerRlsClient();
  const { data: profileData } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('user_id', user.id)
    .maybeSingle();

  const profile = profileData as ProfileRow | null;
  const orgId = trial.orgId ?? null;

  const { data: membership } = orgId
    ? await supabase
        .from('memberships')
        .select('role')
        .eq('org_id', orgId)
        .eq('user_id', user.id)
        .maybeSingle()
    : { data: null };

  const isOwner = Boolean((membership as any)?.role === 'owner');

  return (
    <Card className="p-6">
      <h2 className="text-xl font-bold text-brand-navy dark:text-slate-100">الإعدادات</h2>

      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div className="rounded-lg border border-brand-border p-3 dark:border-slate-700">
          <dt className="text-slate-500 dark:text-slate-400">البريد الإلكتروني</dt>
          <dd className="mt-1 font-medium text-slate-800 dark:text-slate-100">{user.email}</dd>
        </div>

        <div className="rounded-lg border border-brand-border p-3 dark:border-slate-700">
          <dt className="text-slate-500 dark:text-slate-400">اسم الملف الشخصي</dt>
          <dd className="mt-1 font-medium text-slate-800 dark:text-slate-100">{profile?.full_name ?? ''}</dd>
        </div>

        <div className="rounded-lg border border-brand-border p-3 dark:border-slate-700">
          <dt className="text-slate-500 dark:text-slate-400">حالة المنظمة</dt>
          <dd className="mt-1 font-medium text-slate-800 dark:text-slate-100">
            {trial.orgId ?? 'غير مفعّل'}
          </dd>
        </div>

        <div className="rounded-lg border border-brand-border p-3 dark:border-slate-700">
          <dt className="text-slate-500 dark:text-slate-400">ملخص التجربة</dt>
          <dd className="mt-1 font-medium text-slate-800 dark:text-slate-100">
            {statusLabel(trial.status)}
            {trial.daysLeft !== null ? ` — ${trial.daysLeft} يوم` : ''}
          </dd>
        </div>
      </dl>

      <div className="flex flex-wrap gap-3">
        <Link href="/app/settings/team" className={buttonVariants('outline', 'md')}>
          إدارة الفريق
        </Link>
        {isOwner ? (
          <Link href="/app/settings/email" className={buttonVariants('outline', 'md')}>
            البريد
          </Link>
        ) : null}
        <Link href="/app/settings/subscription" className={buttonVariants('outline', 'md')}>
          الاشتراك
        </Link>
        <Link href="/app/settings/privacy" className={buttonVariants('outline', 'md')}>
          الخصوصية
        </Link>
        {isOwner ? (
          <Link href="/app/settings/diagnostics" className={buttonVariants('outline', 'md')}>
            التشخيص
          </Link>
        ) : null}
        <form action={signOutAction}>
          <button type="submit" className={buttonVariants('outline', 'md')}>
            تسجيل الخروج
          </button>
        </form>

        <a href={`mailto:${supportEmail}`} className={buttonVariants('primary', 'md')}>
          تواصل معنا
        </a>
      </div>
    </Card>
  );
}
