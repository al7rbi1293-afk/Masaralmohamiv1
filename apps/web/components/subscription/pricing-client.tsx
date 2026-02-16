'use client';

import { useState } from 'react';
import { Plan } from '@/lib/subscriptions';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { BankTransferForm } from './bank-transfer-form';

export function PricingClient({ plans }: { plans: Plan[] }) {
  const [period, setPeriod] = useState<'monthly' | 'yearly'>('yearly');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-brand-border bg-white p-1 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <button
            type="button"
            onClick={() => setPeriod('monthly')}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
              period === 'monthly'
                ? 'bg-brand-emerald text-white'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
          >
            شهري
          </button>
          <button
            type="button"
            onClick={() => setPeriod('yearly')}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
              period === 'yearly'
                ? 'bg-brand-emerald text-white'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
          >
            سنوي <span className="text-xs opacity-90">(خصم شهرين)</span>
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {plans.map((plan) => {
          const isContactSales = !plan.price_monthly;
          const basePrice = plan.price_monthly ? Number(plan.price_monthly) : 0;

          const displayedPrice = period === 'yearly' ? Math.round((basePrice * 10) / 12) : basePrice;
          const totalBilled = period === 'yearly' ? basePrice * 10 : basePrice;

          return (
            <div
              key={plan.code}
              className="flex flex-col rounded-lg border border-brand-border bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900"
            >
              <div className="mb-4">
                <h2 className="text-base font-semibold text-brand-navy dark:text-slate-100">
                  {plan.name_ar}
                </h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{plan.code}</p>
              </div>

              <div className="mb-4">
                <p className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-brand-navy dark:text-slate-100">
                    {isContactSales ? 'تواصل معنا' : displayedPrice}
                  </span>
                  {!isContactSales && (
                    <span className="text-sm text-slate-500 dark:text-slate-400">
                      {plan.currency} / شهرياً
                    </span>
                  )}
                </p>
                {period === 'yearly' && !isContactSales && (
                  <p className="mt-1 text-xs text-brand-emerald">
                    يُفوتر {totalBilled} {plan.currency} سنوياً
                  </p>
                )}
              </div>

              <ul className="mb-6 flex-1 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                <li>{plan.seat_limit ? `حد المقاعد: ${plan.seat_limit}` : 'مستخدمين غير محدود'}</li>
              </ul>

              <div className="mt-auto">
                {isContactSales ? (
                  <a
                    className={buttonVariants('outline', 'md') + ' w-full'}
                    href={`mailto:masar.almohami@outlook.sa?subject=${encodeURIComponent(
                      `طلب اشتراك - ${plan.code}`,
                    )}`}
                  >
                    تواصل معنا
                  </a>
                ) : (
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button className="w-full">اشترك الآن</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>الاشتراك في خطة {plan.name_ar}</DialogTitle>
                        <DialogDescription>
                          أكمل عملية الدفع عبر التحويل البنكي لتفعيل اشتراكك.
                        </DialogDescription>
                      </DialogHeader>
                      <BankTransferForm
                        planCode={plan.code}
                        planName={plan.name_ar}
                        price={basePrice}
                        period={period}
                      />
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
