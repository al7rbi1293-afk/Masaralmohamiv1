'use client';

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

export function PricingClient() {
  const supportEmail = 'masar.almohami@outlook.sa';

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {SUBSCRIPTION_PRICING_CARDS.map((plan) => {
        const isContactSales = plan.action === 'contact';
        const basePrice = plan.priceMonthly ?? 0;

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
                {plan.priceLabel}
              </span>
              {plan.periodLabel ? <span className="mb-1 text-sm text-slate-500">{plan.periodLabel}</span> : null}
            </div>

            <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{plan.description}</p>

            {isContactSales ? (
              <span className="mt-4 inline-block text-sm font-medium text-brand-emerald hover:underline">
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
                  أكمل عملية الدفع عبر التحويل البنكي لتفعيل اشتراكك.
                </DialogDescription>
              </DialogHeader>
              <BankTransferForm
                planCode={plan.code}
                planName={plan.title}
                price={basePrice}
                period="monthly"
              />
            </DialogContent>
          </Dialog>
        );
      })}
    </div>
  );
}
