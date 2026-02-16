import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { CopyButton } from '@/components/ui/copy-button';
import { FullVersionRequestForm } from '@/components/sections/full-version-request-form';
import { getCurrentAuthUser } from '@/lib/supabase/auth-session';
import { ensureSubscriptionRowExists, listPlans } from '@/lib/subscriptions';

function statusLabel(status: string) {
  switch (status) {
    case 'trial':
      return 'تجربة';
    case 'active':
      return 'نشط';
    case 'past_due':
      return 'متأخر';
    case 'canceled':
      return 'ملغي';
    case 'expired':
      return 'منتهي';
    default:
      return status;
  }
}

function formatDate(value: string | null) {
  if (!value) return 'غير محدد';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'غير محدد';
  return date.toLocaleDateString('ar-SA');
}

export default async function SubscriptionSettingsPage() {
  const user = await getCurrentAuthUser();
  if (!user) {
    return (
      <Card className="p-6">
        <p className="text-sm text-slate-700 dark:text-slate-200">الرجاء تسجيل الدخول.</p>
      </Card>
    );
  }

  let subscription: Awaited<ReturnType<typeof ensureSubscriptionRowExists>> | null = null;
  let plans: Awaited<ReturnType<typeof listPlans>> = [];
  let errorMessage = '';

  try {
    subscription = await ensureSubscriptionRowExists();
    plans = await listPlans();
  } catch (error) {
    const message = error instanceof Error ? error.message : '';

    // Reuse messages we already use across the app.
    if (message === 'لا تملك صلاحية تنفيذ هذا الإجراء.') {
      return (
        <Card className="p-6 space-y-4">
          <h1 className="text-xl font-bold text-brand-navy dark:text-slate-100">الاشتراك</h1>
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
            لا تملك صلاحية الوصول.
          </p>
          <Link href="/app/settings" className={buttonVariants('outline', 'sm')}>
            رجوع
          </Link>
        </Card>
      );
    }

    errorMessage = message || 'تعذر تحميل بيانات الاشتراك.';
  }

  return (
    <Card className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-brand-navy dark:text-slate-100">الاشتراك</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            عرض حالة الاشتراك والخطط المتاحة (للمالك فقط).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/app/settings/subscription/pricing" className={buttonVariants('primary', 'md')}>
            ترقية عبر الدفع الإلكتروني
          </Link>
          <Link href="/app/settings" className={buttonVariants('outline', 'md')}>
            رجوع
          </Link>
        </div>
      </div>

      {errorMessage ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          {errorMessage}
        </p>
      ) : null}

      {subscription ? (
        <section className="rounded-lg border border-brand-border p-4 dark:border-slate-700">
          <h2 className="text-base font-semibold text-brand-navy dark:text-slate-100">الحالة الحالية</h2>
          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
            <div className="sm:col-span-2">
              <dt className="text-slate-500 dark:text-slate-400">معرّف المكتب</dt>
              <dd className="mt-1 flex flex-wrap items-center gap-2">
                <code className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-800 dark:bg-slate-800/60 dark:text-slate-100">
                  {subscription.org_id}
                </code>
                <CopyButton value={subscription.org_id} label="نسخ معرّف المكتب" />
              </dd>
            </div>
            <div>
              <dt className="text-slate-500 dark:text-slate-400">الخطة</dt>
              <dd className="mt-1 font-medium text-slate-800 dark:text-slate-100">
                {subscription.plan_code}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500 dark:text-slate-400">الحالة</dt>
              <dd className="mt-1 font-medium text-slate-800 dark:text-slate-100">
                {statusLabel(subscription.status)}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500 dark:text-slate-400">المقاعد</dt>
              <dd className="mt-1 font-medium text-slate-800 dark:text-slate-100">
                {subscription.seats}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500 dark:text-slate-400">نهاية الفترة</dt>
              <dd className="mt-1 font-medium text-slate-800 dark:text-slate-100">
                {formatDate(subscription.current_period_end)}
              </dd>
            </div>
          </dl>
        </section>
      ) : null}

      <section className="rounded-lg border border-brand-border p-4 dark:border-slate-700">
        <h2 className="text-base font-semibold text-brand-navy dark:text-slate-100">الخطط المتاحة</h2>
        {!plans.length ? (
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">لا توجد خطط حالياً.</p>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {plans.map((plan) => (
              <div
                key={plan.code}
                className="rounded-lg border border-brand-border p-4 dark:border-slate-700"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-brand-navy dark:text-slate-100">{plan.name_ar}</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{plan.code}</p>
                  </div>
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                    {plan.price_monthly ? `${plan.price_monthly} ${plan.currency}` : 'تواصل معنا'}
                  </p>
                </div>
                <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">
                  {plan.seat_limit ? `حد المقاعد: ${plan.seat_limit}` : 'حد المقاعد: حسب الاتفاق'}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-lg border border-brand-border p-4 dark:border-slate-700">
        <h2 className="text-base font-semibold text-brand-navy dark:text-slate-100">طلب تفعيل الاشتراك</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          ارسل طلب التفعيل وسيتم التواصل معك.
        </p>
        <div className="mt-4">
          <FullVersionRequestForm
            source="subscription"
            prefilledEmail={user.email}
            defaultMessage="أرغب بتفعيل الاشتراك"
          />
        </div>
      </section>
    </Card>
  );
}
