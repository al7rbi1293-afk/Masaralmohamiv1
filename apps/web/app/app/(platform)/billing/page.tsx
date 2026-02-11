import { buttonVariants } from '@/components/ui/button';
import { getTrialStatusForCurrentUser } from '@/lib/trial';

const supportEmail = 'masar.almohami@outlook.sa';

function statusLabel(status: 'active' | 'expired' | 'none') {
  if (status === 'active') return 'نشطة';
  if (status === 'expired') return 'منتهية';
  return 'غير مبدوءة';
}

export default async function BillingPage() {
  const trial = await getTrialStatusForCurrentUser();
  const message =
    trial.status === 'active'
      ? 'انتهت التجربة؟ تواصل معنا للنسخة الكاملة.'
      : 'الخطط والأسعار النهائية قريبًا.';

  return (
    <section className="space-y-5 rounded-lg border border-brand-border p-5 dark:border-slate-700">
      <h2 className="text-xl font-bold text-brand-navy dark:text-slate-100">التجربة والفوترة</h2>

      <article className="rounded-lg border border-brand-border p-4 dark:border-slate-700">
        <p className="text-sm text-slate-600 dark:text-slate-300">حالة التجربة</p>
        <p className="mt-1 text-lg font-semibold text-brand-navy dark:text-slate-100">
          {statusLabel(trial.status)}
        </p>
        <p className="mt-3 text-sm text-slate-700 dark:text-slate-300">{message}</p>
      </article>

      <a
        href={`mailto:${supportEmail}?subject=${encodeURIComponent('تفعيل النسخة الكاملة - مسار المحامي')}`}
        className={buttonVariants('primary', 'md')}
      >
        تواصل معنا
      </a>
    </section>
  );
}
