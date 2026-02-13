import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { StripeCheckoutClient } from '@/components/subscription/stripe-checkout-client';
import { ensureSubscriptionRowExists, listPlans } from '@/lib/subscriptions';

export default async function SubscriptionPricingPage() {
  let plans: Awaited<ReturnType<typeof listPlans>> = [];
  let errorMessage = '';

  try {
    // Owner-only (ensure subscription row exists) and also warms RLS context.
    await ensureSubscriptionRowExists();
    plans = await listPlans();
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
            اختر الخطة المناسبة وابدأ الاشتراك عبر الدفع الإلكتروني.
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

      {!plans.length ? (
        <p className="text-sm text-slate-600 dark:text-slate-300">لا توجد خطط حالياً.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => {
            const isContactSales = !plan.price_monthly;
            const isStripeEligible = !isContactSales && ['SOLO', 'TEAM'].includes(plan.code);
            return (
              <div
                key={plan.code}
                className="rounded-lg border border-brand-border bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-brand-navy dark:text-slate-100">
                      {plan.name_ar}
                    </h2>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{plan.code}</p>
                  </div>
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                    {plan.price_monthly ? `${plan.price_monthly} ${plan.currency}` : 'تواصل معنا'}
                  </p>
                </div>

                <p className="mt-3 text-xs text-slate-600 dark:text-slate-300">
                  {plan.seat_limit ? `حد المقاعد: ${plan.seat_limit}` : 'حد المقاعد: حسب الاتفاق'}
                </p>

                <div className="mt-4">
                  {isStripeEligible ? (
                    <StripeCheckoutClient planCode={plan.code} />
                  ) : (
                    <a
                      className={buttonVariants('outline', 'sm')}
                      href={`mailto:masar.almohami@outlook.sa?subject=${encodeURIComponent(
                        `طلب اشتراك - ${plan.code}`,
                      )}`}
                    >
                      تواصل معنا
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-xs text-slate-500 dark:text-slate-400">
        ملاحظة: إذا كانت التجربة منتهية، يمكنك ترقية الخطة ثم سيُفتح الوصول تلقائيًا بعد نجاح الدفع.
      </p>
    </Card>
  );
}

