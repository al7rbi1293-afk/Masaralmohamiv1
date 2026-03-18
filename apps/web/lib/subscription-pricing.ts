import type { PaidPlanCode } from '@/lib/billing/plans';
import { normalizePlanCode } from '@/lib/billing/plans';

export type PricingPlanCard = {
  code: PaidPlanCode;
  title: string;
  priceMonthly: number | null;
  priceAnnual: number | null;
  priceLabel: string;
  periodLabel: string;
  description: string;
  seatsLabel: string;
  action: 'subscribe' | 'contact';
};

export const SUBSCRIPTION_PRICING_CARDS: PricingPlanCard[] = [
  {
    code: 'SOLO',
    title: 'المحامي المستقل',
    priceMonthly: 250,
    priceAnnual: 3000,
    priceLabel: '250 ريال',
    periodLabel: 'شهرياً',
    description: 'انطلاقة قوية لممارستك المستقلة. نظّم قضاياك وعملائك في مكان واحد بمهنية عالية.',
    seatsLabel: 'حد المقاعد: 1',
    action: 'subscribe',
  },
  {
    code: 'SMALL_OFFICE',
    title: 'مكتب صغير',
    priceMonthly: 500,
    priceAnnual: 6000,
    priceLabel: '500 ريال',
    periodLabel: 'شهرياً',
    description: 'أسس مكتبك على قواعد صحيحة. تعاون مع فريقك وتابع المهام بدقة وسلاسة.',
    seatsLabel: 'حد المقاعد: من 2 إلى 5',
    action: 'subscribe',
  },
  {
    code: 'MEDIUM_OFFICE',
    title: 'مكتب متوسط',
    priceMonthly: 750,
    priceAnnual: 9000,
    priceLabel: '750 ريال',
    periodLabel: 'شهرياً',
    description: 'تحكم كامل في النمو. صلاحيات متقدمة وتقارير أداء لضبط سير العمل.',
    seatsLabel: 'حد المقاعد: من 6 إلى 10',
    action: 'subscribe',
  },
  {
    code: 'ENTERPRISE',
    title: 'نسخة الشركات',
    priceMonthly: null,
    priceAnnual: null,
    priceLabel: 'تواصل معنا',
    periodLabel: '',
    description: 'نسخة منفصلة للمؤسسات وباقات الشركات مع تكاملات حكومية ورحلات عمل مخصصة.',
    seatsLabel: 'حد المقاعد: 11 إلى 30',
    action: 'contact',
  },
];

export function getPricingPlanCardByCode(rawCode: string | null | undefined) {
  const normalizedCode = normalizePlanCode(rawCode, 'TRIAL');
  if (normalizedCode === 'TRIAL') {
    return null;
  }

  return SUBSCRIPTION_PRICING_CARDS.find((plan) => plan.code === normalizedCode) ?? null;
}
