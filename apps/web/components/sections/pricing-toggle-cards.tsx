'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Users } from 'lucide-react';
import { SUBSCRIPTION_PRICING_CARDS } from '@/lib/subscription-pricing';

export function PricingToggleCards() {
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');

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
        {SUBSCRIPTION_PRICING_CARDS.map((item) => {
          const isContactSales = item.action === 'contact';
          const price = billingPeriod === 'monthly' ? item.priceMonthly : item.priceAnnual;
          const label = isContactSales ? 'تواصل معنا' : `${price} ريال`;
          const periodLabel = isContactSales ? '' : billingPeriod === 'monthly' ? 'شهرياً' : 'سنوياً';

          const CardContent = (
            <article
              className={`h-full rounded-xl2 border border-brand-border bg-white p-6 text-center shadow-sm transition-all hover:shadow-md dark:border-slate-700 dark:bg-slate-900 ${
                !isContactSales ? 'cursor-pointer hover:border-brand-emerald/50' : ''
              }`}
            >
              <Users className="mx-auto text-brand-emerald" size={20} />
              <h3 className="mt-3 text-lg font-semibold text-brand-navy dark:text-slate-100">{item.title}</h3>

              <div className="mt-4 flex items-end justify-center gap-1">
                <span
                  className={`text-2xl font-bold ${
                    isContactSales ? 'text-lg' : 'text-brand-navy dark:text-slate-100'
                  }`}
                >
                  {label}
                </span>
                {periodLabel && <span className="mb-1 text-sm text-slate-500">{periodLabel}</span>}
              </div>

              <p className="mt-3 text-xs leading-5 text-brand-emerald font-medium">{item.seatsLabel}</p>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                {item.description}
              </p>

              {isContactSales && (
                <span
                  dir="ltr"
                  className="mt-4 block w-full max-w-full break-all text-center text-sm font-medium text-brand-emerald hover:underline"
                >
                  masar.almohami@outlook.sa
                </span>
              )}
            </article>
          );

          if (isContactSales) {
            return (
              <a key={item.title} href="mailto:masar.almohami@outlook.sa" className="block h-full">
                {CardContent}
              </a>
            );
          }

          return (
            <Link
              key={item.title}
              href={`/app/settings/subscription/pricing?plan=${item.code}&period=${billingPeriod}`}
              className="block h-full"
            >
              {CardContent}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
