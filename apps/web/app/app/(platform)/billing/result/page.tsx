import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { getCurrentAuthUser } from '@/lib/supabase/auth-session';
import { createSupabaseServerClient } from '@/lib/supabase/server';

type BillingResultPageProps = {
  searchParams?: {
    charge_id?: string;
    tap_id?: string;
    provider?: string;
    status?: string;
  };
};

function statusConfig(status: string) {
  switch (status) {
    case 'captured':
      return {
        title: 'تمت عملية الدفع بنجاح',
        message: 'تم استلام الدفع وتفعيل اشتراكك. في حال التأخر، سيكتمل التفعيل تلقائيًا بعد التحقق النهائي.',
        tone: 'success',
      };
    case 'failed':
    case 'cancelled':
    case 'refunded':
      return {
        title: 'تعذر إتمام عملية الدفع',
        message: 'لم يتم تأكيد الدفع. يمكنك المحاولة مرة أخرى أو اختيار طريقة دفع أخرى.',
        tone: 'error',
      };
    default:
      return {
        title: 'جاري التحقق من الدفع',
        message: 'جاري التحقق النهائي من بوابة الدفع. سيتم تحديث الحالة تلقائيًا بعد وصول إشعار Tap.',
        tone: 'pending',
      };
  }
}

export default async function BillingResultPage({ searchParams }: BillingResultPageProps) {
  const user = await getCurrentAuthUser();
  const chargeId = searchParams?.charge_id || searchParams?.tap_id || null;

  let status = 'pending';
  let paymentReference: string | null = null;

  if (user && chargeId) {
    const db = createSupabaseServerClient();
    const { data } = await db
      .from('tap_payments')
      .select('status, tap_reference')
      .eq('tap_charge_id', chargeId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (data) {
      status = String((data as any).status || 'pending');
      paymentReference = String((data as any).tap_reference || '') || null;
    }
  }

  const view = statusConfig(status);

  return (
    <Card className="space-y-5 p-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-navy dark:text-slate-100">{view.title}</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{view.message}</p>
      </div>

      <div
        className={`rounded-lg border px-4 py-3 text-sm ${
          view.tone === 'success'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-200'
            : view.tone === 'error'
              ? 'border-red-200 bg-red-50 text-red-800 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-200'
              : 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200'
        }`}
      >
        الحالة الحالية: <strong>{status}</strong>
        {paymentReference ? <span> • المرجع: {paymentReference}</span> : null}
      </div>

      <p className="text-xs text-slate-500 dark:text-slate-400">
        تنبيه: هذه الصفحة للإرشاد فقط، والحالة النهائية تعتمد على Webhook الموثّق من Tap.
      </p>

      <div className="flex flex-wrap gap-3">
        <Link href="/app/settings/subscription" className={buttonVariants('primary', 'md')}>
          العودة إلى الاشتراك
        </Link>
        <Link href="/app/settings/subscription/pricing" className={buttonVariants('outline', 'md')}>
          محاولة دفع جديدة
        </Link>
      </div>
    </Card>
  );
}
