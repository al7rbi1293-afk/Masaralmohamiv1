import { getDefaultSeatLimit, normalizePlanCode } from '@/lib/billing/plans';
import { SUBSCRIPTION_PRICING_CARDS } from '@/lib/subscription-pricing';

export type BillingPeriod = 'monthly' | 'yearly';

export type ResolvedPlan = {
  requestedCode: string;
  normalizedCode: string;
  title: string;
  amount: number;
  seats: number | null;
  period: BillingPeriod;
};

export function resolveBillingPlan(params: {
  planCode: string;
  period: BillingPeriod;
}): ResolvedPlan {
  const requestedCode = String(params.planCode || '').trim().toUpperCase();
  const normalizedCode = normalizePlanCode(requestedCode, 'TRIAL');

  const card =
    normalizedCode === 'TRIAL'
      ? null
      : SUBSCRIPTION_PRICING_CARDS.find((item) => item.code === normalizedCode);
  if (!card || card.action === 'contact' || card.priceMonthly === null) {
    throw new Error('هذه الخطة غير متاحة للدفع الإلكتروني حالياً.');
  }

  const amount = params.period === 'yearly' ? card.priceAnnual ?? 0 : card.priceMonthly;

  return {
    requestedCode,
    normalizedCode,
    title: card.title,
    amount,
    seats: getDefaultSeatLimit(normalizedCode),
    period: params.period,
  };
}

export function toSubscriptionPlanCode(normalizedCode: string) {
  const planCode = normalizePlanCode(normalizedCode, 'SOLO');
  return planCode === 'TRIAL' ? 'SOLO' : planCode;
}
