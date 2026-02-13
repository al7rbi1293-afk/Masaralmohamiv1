import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { getTrialStatusForCurrentUser } from '@/lib/trial';

const supportEmail = 'masar.almohami@outlook.sa';

function formatDate(value: string | null) {
  if (!value) {
    return '—';
  }

  return new Date(value).toLocaleDateString('ar-SA');
}

function trialLabel(status: 'active' | 'expired' | 'none') {
  if (status === 'active') return { text: 'نشطة', variant: 'success' as const };
  if (status === 'expired') return { text: 'منتهية', variant: 'danger' as const };
  return { text: 'غير مبدوءة', variant: 'warning' as const };
}

export default async function DashboardPage() {
  const trial = await getTrialStatusForCurrentUser();
  const label = trialLabel(trial.status);

  return (
    <div className="space-y-5">
      {trial.status === 'none' ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-200">
          <p>حسابك جاهز — فعّل التجربة عبر التسجيل من الصفحة الرئيسية أو تواصل معنا.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/#trial" className={buttonVariants('outline', 'sm')}>
              ابدأ التجربة
            </Link>
            <a href={`mailto:${supportEmail}`} className={buttonVariants('outline', 'sm')}>
              راسلنا
            </a>
          </div>
        </div>
      ) : null}

      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-brand-navy dark:text-slate-100">لوحة التحكم</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              أساسيات المنصة تحت <code>/app</code>.
            </p>
          </div>
          <Badge variant={label.variant}>{label.text}</Badge>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-brand-border p-4 dark:border-slate-700">
            <h3 className="text-sm font-semibold text-brand-navy dark:text-slate-100">حالة التجربة</h3>
            <dl className="mt-3 space-y-2 text-sm text-slate-700 dark:text-slate-300">
              <div className="flex justify-between gap-4">
                <dt>الحالة</dt>
                <dd className="font-medium">{label.text}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>تاريخ الانتهاء</dt>
                <dd className="font-medium">{formatDate(trial.endsAt)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>الأيام المتبقية</dt>
                <dd className="font-medium">{trial.daysLeft ?? '—'}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-lg border border-brand-border p-4 dark:border-slate-700">
            <h3 className="text-sm font-semibold text-brand-navy dark:text-slate-100">الخطوات التالية</h3>
            <ul className="mt-3 space-y-2 text-sm text-slate-700 dark:text-slate-300">
              <li>جهّز الإعدادات الأساسية.</li>
              <li>ابدأ بإضافة بيانات المكتب عند إطلاق المزايا.</li>
            </ul>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/app/settings" className={buttonVariants('primary', 'md')}>
            الإعدادات
          </Link>
          <Link href="/contact?topic=demo" className={buttonVariants('outline', 'md')}>
            حجز عرض سريع
          </Link>
        </div>
      </Card>
    </div>
  );
}
