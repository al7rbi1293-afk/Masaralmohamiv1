import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { getTrialStatusForCurrentUser } from '@/lib/trial';

export default async function BillingIndexPage() {
  const trial = await getTrialStatusForCurrentUser();

  return (
    <section className="rounded-lg border border-brand-border bg-white p-6 shadow-panel dark:border-slate-700 dark:bg-slate-900">
      <h1 className="text-xl font-bold text-brand-navy dark:text-slate-100">الفوترة</h1>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
        عروض أسعار وفواتير وتصدير PDF (MVP).
      </p>

      {trial.status !== 'active' ? (
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
          ملاحظة: الفوترة متاحة أثناء التجربة النشطة.
        </p>
      ) : null}

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Link
          href="/app/billing/quotes"
          className="rounded-lg border border-brand-border bg-brand-background p-5 transition hover:border-brand-emerald dark:border-slate-700 dark:bg-slate-800"
        >
          <h2 className="text-base font-semibold text-brand-navy dark:text-slate-100">عروض الأسعار</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            إنشاء عرض سعر وإرساله للعميل.
          </p>
        </Link>

        <Link
          href="/app/billing/invoices"
          className="rounded-lg border border-brand-border bg-brand-background p-5 transition hover:border-brand-emerald dark:border-slate-700 dark:bg-slate-800"
        >
          <h2 className="text-base font-semibold text-brand-navy dark:text-slate-100">الفواتير</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            إنشاء فاتورة، تحديث الحالة، وتصدير PDF.
          </p>
        </Link>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/app/billing/quotes/new" className={buttonVariants('primary', 'md')}>
          عرض سعر جديد
        </Link>
        <Link href="/app/billing/invoices/new" className={buttonVariants('outline', 'md')}>
          فاتورة جديدة
        </Link>
      </div>
    </section>
  );
}

