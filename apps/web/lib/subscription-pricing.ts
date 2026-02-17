export type PricingPlanCard = {
  code: string;
  title: string;
  priceMonthly: number | null;
  priceLabel: string;
  periodLabel: string;
  description: string;
  seatsLabel: string;
  action: 'subscribe' | 'contact';
};

export const SUBSCRIPTION_PRICING_CARDS: PricingPlanCard[] = [
  {
    code: 'SOLO',
    title: 'محامي مستقل',
    priceMonthly: 250,
    priceLabel: '250 ريال',
    periodLabel: 'شهرياً',
    description: 'انطلاقة قوية لممارستك المستقلة. نظّم قضاياك وعملائك في مكان واحد بمهنية عالية.',
    seatsLabel: 'حد المقاعد: 1',
    action: 'subscribe',
  },
  {
    code: 'SMALL_OFFICE',
    title: 'مكتب صغير (1-5)',
    priceMonthly: 500,
    priceLabel: '500 ريال',
    periodLabel: 'شهرياً',
    description: 'أسس مكتبك على قواعد صحيحة. تعاون مع فريقك وتابع المهام بدقة وسلاسة.',
    seatsLabel: 'حد المقاعد: 5',
    action: 'subscribe',
  },
  {
    code: 'MEDIUM_OFFICE',
    title: 'مكتب متوسط (6-25)',
    priceMonthly: 750,
    priceLabel: '750 ريال',
    periodLabel: 'شهرياً',
    description: 'تحكم كامل في النمو. صلاحيات متقدمة وتقارير أداء لضبط سير العمل.',
    seatsLabel: 'حد المقاعد: 25',
    action: 'subscribe',
  },
  {
    code: 'ENTERPRISE',
    title: 'مكتب كبير أو شركة محاماة',
    priceMonthly: null,
    priceLabel: 'تواصل معنا',
    periodLabel: '',
    description: 'حلول مخصصة للمؤسسات الكبرى. دعم خاص وتكاملات متقدمة.',
    seatsLabel: 'حد المقاعد: حسب الاتفاق',
    action: 'contact',
  },
];

export function getPricingPlanCardByCode(rawCode: string | null | undefined) {
  const code = String(rawCode ?? '').trim().toUpperCase();

  if (!code) {
    return null;
  }

  const aliases: Record<string, string> = {
    SOLO: 'SOLO',
    TEAM: 'SMALL_OFFICE',
    SMALL_OFFICE: 'SMALL_OFFICE',
    BUSINESS: 'MEDIUM_OFFICE',
    MEDIUM: 'MEDIUM_OFFICE',
    MEDIUM_OFFICE: 'MEDIUM_OFFICE',
    PRO: 'ENTERPRISE',
    ENTERPRISE: 'ENTERPRISE',
  };

  const normalizedCode = aliases[code] ?? code;

  return SUBSCRIPTION_PRICING_CARDS.find((plan) => plan.code === normalizedCode) ?? null;
}
