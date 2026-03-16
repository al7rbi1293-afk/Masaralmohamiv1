'use client';

import { useState } from 'react';
import { Users } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { BankTransferForm } from './bank-transfer-form';
import { SUBSCRIPTION_PRICING_CARDS } from '@/lib/subscription-pricing';
import { TapCheckoutButton } from './tap-checkout-button';

type PricingClientProps = {
  isCardPaymentEnabled: boolean;
};

export function PricingClient({ isCardPaymentEnabled }: PricingClientProps) {
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const supportEmail = 'masar.almohami@outlook.sa';

  return (
    <div className="space-y-10">
      <div className="flex flex-col items-center justify-center space-y-4">
        <div className="flex items-center rounded-full border border-brand-border bg-white p-1 dark:border-slate-700 dark:bg-slate-900">
          <button
            onClick={() => setBillingPeriod('monthly')}
            className={`rounded-full px-6 py-1.5 text-sm font-medium transition-all ${
              billingPeriod === 'monthly'
                ? 'bg-brand-navy text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            شهري
          </button>
          <button
            onClick={() => setBillingPeriod('yearly')}
            className={`rounded-full px-6 py-1.5 text-sm font-medium transition-all ${
              billingPeriod === 'yearly'
                ? 'bg-brand-navy text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            سنوي
          </button>
        </div>
        {billingPeriod === 'yearly' && (
          <p className="text-xs font-medium text-brand-emerald animate-in fade-in slide-in-from-top-1">
            وفر أكثر مع الاشتراك السنوي!
          </p>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {SUBSCRIPTION_PRICING_CARDS.map((plan) => {
          const isContactSales = plan.action === 'contact';
          const price = billingPeriod === 'monthly' ? plan.priceMonthly : plan.priceAnnual;
          const label = isContactSales ? 'تواصل معنا' : `${price} ريال`;
          const periodLabel = isContactSales ? '' : billingPeriod === 'monthly' ? 'شهرياً' : 'سنوياً';

          const cardBody = (
            <article
              className={`h-full rounded-xl2 border border-brand-border bg-white p-6 text-center shadow-sm transition-all hover:shadow-md dark:border-slate-700 dark:bg-slate-900 ${
                isContactSales ? '' : 'cursor-pointer hover:border-brand-emerald/50'
              }`}
            >
              <Users className="mx-auto text-brand-emerald" size={20} />
              <h3 className="mt-3 text-lg font-semibold text-brand-navy dark:text-slate-100">{plan.title}</h3>

              <div className="mt-4 flex items-end justify-center gap-1">
                <span
                  className={`text-2xl font-bold ${isContactSales ? 'text-lg' : 'text-brand-navy dark:text-slate-100'}`}
                >
                  {label}
                </span>
                {periodLabel ? <span className="mb-1 text-sm text-slate-500">{periodLabel}</span> : null}
              </div>

              <p className="mt-3 text-xs leading-5 text-brand-emerald font-medium">{plan.seatsLabel}</p>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{plan.description}</p>

              {isContactSales ? (
                <span
                  dir="ltr"
                  className="mt-4 block w-full max-full break-all text-center text-sm font-medium text-brand-emerald hover:underline"
                >
                  {supportEmail}
                </span>
              ) : null}
            </article>
          );

          if (isContactSales) {
            return (
              <a
                key={plan.code}
                href={`mailto:${supportEmail}?subject=${encodeURIComponent(`طلب اشتراك - ${plan.code}`)}`}
                className="block h-full"
              >
                {cardBody}
              </a>
            );
          }

          return (
            <Dialog key={plan.code}>
              <DialogTrigger asChild>
                <button
                  type="button"
                  className="block h-full w-full text-start"
                  aria-label={`الاشتراك في ${plan.title}`}
                >
                  {cardBody}
                </button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>الاشتراك في خطة {plan.title}</DialogTitle>
                  <DialogDescription>
                    {isCardPaymentEnabled
                      ? 'يمكنك الدفع مباشرة عبر Tap أو استخدام التحويل البنكي كخيار بديل.'
                      : 'التحويل البنكي هو وسيلة الدفع المتاحة حاليًا. سيتم تفعيل الدفع بالبطاقة والتجديد التلقائي قريبًا.'}
                  </DialogDescription>
                </DialogHeader>
                {isCardPaymentEnabled ? (
                  <div className="space-y-5">
                    <div className="rounded-lg border border-brand-border bg-brand-background/40 p-4 dark:border-slate-700 dark:bg-slate-800/30">
                      <h4 className="text-sm font-semibold text-brand-navy dark:text-slate-100">الخيار الأسرع: Tap</h4>
                      <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                        التفعيل النهائي يتم بعد تأكيد Webhook من بوابة Tap.
                      </p>
                      <div className="mt-3">
                        <TapCheckoutButton planCode={plan.code} period={billingPeriod} />
                      </div>
                    </div>
                    <div className="relative">
                      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 border-t border-brand-border/70 dark:border-slate-700" />
                      <span className="relative mx-auto block w-fit bg-white px-3 text-xs text-slate-500 dark:bg-slate-900 dark:text-slate-400">أو</span>
                    </div>
                  </div>
                ) : null}
                <BankTransferForm
                  planCode={plan.code}
                  planName={plan.title}
                  price={price ?? 0}
                  period={billingPeriod}
                />
              </DialogContent>
            </Dialog>
          );
        })}
      </div>
    </div>
  );
}
