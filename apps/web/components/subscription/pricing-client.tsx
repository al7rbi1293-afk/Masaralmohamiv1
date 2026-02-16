'use client';

import { Users } from 'lucide-react';
import { Plan } from '@/lib/subscriptions';
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
  const supportEmail = 'masar.almohami@outlook.sa';

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {plans.length === 0 ? (
        <div className="rounded-xl2 border border-brand-border bg-white p-6 text-center text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
          لا توجد خطط متاحة حالياً.
        </div>
      ) : null}

      {plans.map((plan) => {
        const isContactSales = !plan.price_monthly;
        const basePrice = plan.price_monthly ? Number(plan.price_monthly) : 0;
        const cardTitle = getPlanDisplayTitle(plan);
        const description = getPlanDescription(plan);
        const cardBody = (
          <article
            className={`h-full rounded-xl2 border border-brand-border bg-white p-6 text-center shadow-sm transition-all hover:shadow-md dark:border-slate-700 dark:bg-slate-900 ${
              isContactSales ? '' : 'cursor-pointer hover:border-brand-emerald/50'
            }`}
          >
            <Users className="mx-auto text-brand-emerald" size={20} />
            <h3 className="mt-3 text-lg font-semibold text-brand-navy dark:text-slate-100">{cardTitle}</h3>

            <div className="mt-4 flex items-end justify-center gap-1">
              <span
                className={`text-2xl font-bold ${isContactSales ? 'text-lg' : 'text-brand-navy dark:text-slate-100'}`}
              >
                {isContactSales ? 'تواصل معنا' : `${basePrice} ريال`}
              </span>
              {!isContactSales ? <span className="mb-1 text-sm text-slate-500">شهرياً</span> : null}
            </div>

            <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{description}</p>

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
                aria-label={`الاشتراك في ${cardTitle}`}
              >
                {cardBody}
              </button>
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
                period="monthly"
              />
            </DialogContent>
          </Dialog>
        );
      })}
    </div>
  );
}

function getPlanDisplayTitle(plan: Plan) {
  const code = String(plan.code || '').toUpperCase();

  if (code === 'SOLO') return 'محامي مستقل';
  if (code === 'TEAM') return 'مكتب صغير (1-5)';
  if (code === 'MEDIUM' || code === 'MEDIUM_OFFICE') return 'مكتب متوسط (6-25)';
  if (code === 'PRO' || code === 'ENTERPRISE') return 'مكتب كبير أو شركة محاماة';

  return plan.name_ar;
}

function getPlanDescription(plan: Plan) {
  const code = String(plan.code || '').toUpperCase();

  if (code === 'SOLO') {
    return 'انطلاقة قوية لممارستك المستقلة. نظّم قضاياك وعملائك في مكان واحد بمهنية عالية.';
  }

  if (code === 'TEAM' || code === 'SMALL_OFFICE') {
    return 'أسس مكتبك على قواعد صحيحة. تعاون مع فريقك وتابع المهام بدقة وسلاسة.';
  }

  if (code === 'MEDIUM' || code === 'MEDIUM_OFFICE') {
    return 'تحكم كامل في النمو. صلاحيات متقدمة وتقارير أداء لضبط سير العمل.';
  }

  if (code === 'PRO' || code === 'ENTERPRISE') {
    return 'حلول مخصصة للمؤسسات الكبرى. دعم خاص وتكاملات متقدمة.';
  }

  if (plan.seat_limit) {
    return `حد المقاعد: ${plan.seat_limit}.`;
  }

  return 'خطة مرنة تناسب احتياج مكتبك.';
}
