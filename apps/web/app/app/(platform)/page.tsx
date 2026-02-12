import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { createSupabaseServerRlsClient } from '@/lib/supabase/server';
import { getCurrentOrgIdForUser } from '@/lib/org';
import { getTrialStatusForCurrentUser } from '@/lib/trial';

const supportEmail = 'masar.almohami@outlook.sa';

function formatDate(value: string | null) {
  if (!value) {
    return '—';
  }

  return new Date(value).toLocaleDateString('ar-SA');
}

function statusLabel(status: 'active' | 'expired' | 'none') {
  if (status === 'active') return 'نشطة';
  if (status === 'expired') return 'منتهية';
  return 'غير مبدوءة';
}

export default async function DashboardPage() {
  const [trial, orgId] = await Promise.all([getTrialStatusForCurrentUser(), getCurrentOrgIdForUser()]);
  const mailtoActivate = `mailto:${supportEmail}?subject=${encodeURIComponent('تفعيل النسخة الكاملة - مسار المحامي')}`;

  const supabase = createSupabaseServerRlsClient();

  const [{ count: clientsCount }, { count: mattersCount }, { count: overdueTasksCount }, { data: unpaidInvoices }] =
    orgId
      ? await Promise.all([
          supabase
            .from('clients')
            .select('id', { count: 'exact', head: true })
            .eq('org_id', orgId)
            .eq('status', 'active'),
          supabase
            .from('matters')
            .select('id', { count: 'exact', head: true })
            .eq('org_id', orgId)
            .neq('status', 'archived'),
          supabase
            .from('tasks')
            .select('id', { count: 'exact', head: true })
            .eq('org_id', orgId)
            .lt('due_at', new Date().toISOString())
            .in('status', ['todo', 'doing']),
          supabase
            .from('invoices')
            .select('total')
            .eq('org_id', orgId)
            .in('status', ['unpaid', 'partial'])
            .limit(500),
        ])
      : await Promise.all([
          Promise.resolve({ count: 0 }),
          Promise.resolve({ count: 0 }),
          Promise.resolve({ count: 0 }),
          Promise.resolve({ data: [] as any }),
        ]);

  const unpaidTotal =
    (unpaidInvoices as Array<{ total: string }> | null)?.reduce((sum, row) => {
      const value = Number(row.total);
      return sum + (Number.isFinite(value) ? value : 0);
    }, 0) ?? 0;

  return (
    <div className="space-y-5">
      {trial.status === 'none' ? (
        <section className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-200">
          <p>حسابك جاهز — فعّل التجربة عبر التسجيل من صفحة مسار المحامي أو تواصل معنا.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/contact" className={buttonVariants('outline', 'sm')}>
              صفحة التواصل
            </Link>
            <a href={`mailto:${supportEmail}`} className={buttonVariants('outline', 'sm')}>
              راسلنا مباشرة
            </a>
          </div>
        </section>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-lg border border-brand-border bg-brand-background p-4 dark:border-slate-700 dark:bg-slate-800">
          <p className="text-sm text-slate-600 dark:text-slate-300">العملاء</p>
          <p className="mt-2 text-3xl font-bold text-brand-navy dark:text-slate-100">
            {clientsCount ?? 0}
          </p>
          <Link href="/app/clients" className="mt-3 inline-block text-sm text-brand-emerald hover:underline">
            فتح العملاء
          </Link>
        </article>

        <article className="rounded-lg border border-brand-border bg-brand-background p-4 dark:border-slate-700 dark:bg-slate-800">
          <p className="text-sm text-slate-600 dark:text-slate-300">القضايا</p>
          <p className="mt-2 text-3xl font-bold text-brand-navy dark:text-slate-100">
            {mattersCount ?? 0}
          </p>
          <Link href="/app/matters" className="mt-3 inline-block text-sm text-brand-emerald hover:underline">
            فتح القضايا
          </Link>
        </article>

        <article className="rounded-lg border border-brand-border bg-brand-background p-4 dark:border-slate-700 dark:bg-slate-800">
          <p className="text-sm text-slate-600 dark:text-slate-300">مهام متأخرة</p>
          <p className="mt-2 text-3xl font-bold text-brand-navy dark:text-slate-100">
            {overdueTasksCount ?? 0}
          </p>
          <Link href="/app/tasks" className="mt-3 inline-block text-sm text-brand-emerald hover:underline">
            فتح المهام
          </Link>
        </article>

        <article className="rounded-lg border border-brand-border bg-brand-background p-4 dark:border-slate-700 dark:bg-slate-800">
          <p className="text-sm text-slate-600 dark:text-slate-300">فواتير غير مسددة</p>
          <p className="mt-2 text-3xl font-bold text-brand-navy dark:text-slate-100">
            {unpaidTotal.toFixed(2)}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">SAR</p>
          <Link href="/app/billing/invoices" className="mt-2 inline-block text-sm text-brand-emerald hover:underline">
            فتح الفواتير
          </Link>
        </article>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <article className="rounded-lg border border-brand-border p-4 dark:border-slate-700">
          <h2 className="text-base font-semibold text-brand-navy dark:text-slate-100">حالة التجربة</h2>
          <dl className="mt-3 space-y-2 text-sm text-slate-700 dark:text-slate-300">
            <div className="flex justify-between gap-4">
              <dt>الحالة</dt>
              <dd className="font-medium">{statusLabel(trial.status)}</dd>
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
        </article>

        <article className="rounded-lg border border-brand-border p-4 dark:border-slate-700">
          <h2 className="text-base font-semibold text-brand-navy dark:text-slate-100">الخطوات التالية</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-700 dark:text-slate-300">
            {trial.status === 'active' ? (
              <>
                <li>ابدأ بإعداد المكتب.</li>
                <li>أضف فريقك.</li>
              </>
            ) : (
              <li>ابدأ التجربة من صفحة مسار المحامي.</li>
            )}
          </ul>
        </article>
      </section>

      <section className="rounded-lg border border-brand-border bg-brand-background p-5 dark:border-slate-700 dark:bg-slate-800">
        <h2 className="text-lg font-bold text-brand-navy dark:text-slate-100">هل تحتاج تفعيل النسخة الكاملة؟</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          <a href={mailtoActivate} className={buttonVariants('primary', 'md')}>
            تواصل معنا لتفعيل النسخة الكاملة
          </a>
          <Link href="/app/expired#request-full-version" className={buttonVariants('outline', 'md')}>
            إرسال طلب التفعيل
          </Link>
          <Link href="/contact?topic=demo" className={buttonVariants('outline', 'md')}>
            حجز عرض سريع
          </Link>
        </div>
      </section>
    </div>
  );
}
