// This needs to be a Client Component to manage state (Monthly/Yearly toggle)
// But the current file is server component. We will make a wrapper.
import { PricingClient } from '@/components/subscription/pricing-client';
import { ensureSubscriptionRowExists } from '@/lib/subscriptions';
import { Card } from '@/components/ui/card';
import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';

export default async function SubscriptionPricingPage() {
  let errorMessage = '';

  try {
    // Owner-only (ensure subscription row exists) and also warms RLS context.
    await ensureSubscriptionRowExists();
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'لا تملك صلاحية تنفيذ هذا الإجراء.') {
      return (
        <Card className="p-6 space-y-4">
          <h1 className="text-xl font-bold text-brand-navy dark:text-slate-100">خطط الاشتراك</h1>
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
            لا تملك صلاحية الوصول.
          </p>
          <Link href="/app/settings/subscription" className={buttonVariants('outline', 'sm')}>
            رجوع
          </Link>
        </Card>
      );
    }
    errorMessage = message || 'تعذر تحميل الخطط.';
  }

  return (
    <Card className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-brand-navy dark:text-slate-100">خطط الاشتراك</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            اختر الخطة المناسبة حسب حجم المكتب وابدأ الاشتراك مباشرة.
          </p>
        </div>
        <Link href="/app/settings/subscription" className={buttonVariants('outline', 'sm')}>
          رجوع
        </Link>
      </div>

      {errorMessage ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          {errorMessage}
        </p>
      ) : null}

      <PricingClient />

      <p className="text-xs text-slate-500 dark:text-slate-400">
        ملاحظة: إذا كانت التجربة منتهية، يمكنك ترقية الخطة ثم سيُفتح الوصول تلقائيًا بعد مراجعة الدفع.
      </p>
    </Card>
  );
}
