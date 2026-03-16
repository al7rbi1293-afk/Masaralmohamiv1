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

const PLAN_ALIAS_MAP: Record<string, string> = {
  SOLO: 'SOLO',
  TEAM: 'SMALL_OFFICE',
  SMALL_OFFICE: 'SMALL_OFFICE',
  BUSINESS: 'MEDIUM_OFFICE',
  MEDIUM: 'MEDIUM_OFFICE',
  MEDIUM_OFFICE: 'MEDIUM_OFFICE',
  PRO: 'ENTERPRISE',
  ENTERPRISE: 'ENTERPRISE',
};

const PLAN_SEATS: Record<string, number | null> = {
  SOLO: 1,
  SMALL_OFFICE: 5,
  MEDIUM_OFFICE: 10,
  ENTERPRISE: 30,
};

export function resolveBillingPlan(params: {
  planCode: string;
  period: BillingPeriod;
}): ResolvedPlan {
  const requestedCode = String(params.planCode || '').trim().toUpperCase();
  const normalizedCode = PLAN_ALIAS_MAP[requestedCode] || requestedCode;

  const card = SUBSCRIPTION_PRICING_CARDS.find((item) => item.code === normalizedCode);
  if (!card || card.action === 'contact' || card.priceMonthly === null) {
    throw new Error('هذه الخطة غير متاحة للدفع الإلكتروني حالياً.');
  }

  const amount = params.period === 'yearly' ? card.priceAnnual ?? 0 : card.priceMonthly;

  return {
    requestedCode,
    normalizedCode,
    title: card.title,
    amount,
    seats: PLAN_SEATS[normalizedCode] ?? null,
    period: params.period,
  };
}

export function toSubscriptionPlanCode(normalizedCode: string) {
  // Current DB supports these codes via migration 20260312193000.
  return normalizedCode;
}
