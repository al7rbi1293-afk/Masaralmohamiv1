import { getPricingPlanCardByCode } from '@/lib/subscription-pricing';

export type ActivationDurationMode = 'month' | 'year' | 'custom_months' | 'custom_years' | 'lifetime';

const roleLabelMap: Record<string, string> = {
  owner: 'مالك',
  admin: 'مدير',
  member: 'عضو',
  lawyer: 'محامي',
};

export const PLAN_OPTIONS = [
  { value: 'SOLO', label: 'المحامي المستقل (1 مستخدم)' },
  { value: 'SMALL_OFFICE', label: 'مكتب صغير (من 2 إلى 5 مستخدمين)' },
  { value: 'MEDIUM_OFFICE', label: 'مكتب متوسط (من 6 إلى 10 مستخدمين)' },
  { value: 'ENTERPRISE', label: 'نسخة الشركات (تكاملات ناجز)' },
] as const;

export const DURATION_OPTIONS: Array<{ value: ActivationDurationMode; label: string }> = [
  { value: 'month', label: 'شهر واحد' },
  { value: 'year', label: 'سنة واحدة' },
  { value: 'custom_months', label: 'مدة مخصصة بالشهور' },
  { value: 'custom_years', label: 'مدة مخصصة بالسنوات' },
];

export function getRoleLabel(role: string | null | undefined) {
  if (!role) return 'غير محدد';
  return roleLabelMap[role] ?? role;
}

export function getPlanLabel(planCode: string | null | undefined) {
  if (!planCode) return 'تجريبي';
  const card = getPricingPlanCardByCode(planCode);
  if (card) {
    return `${card.title}${card.seatsLabel ? ` (${card.seatsLabel.replace('حد المقاعد: ', '')})` : ''}`;
  }
  return planCode;
}

export function formatArabicDate(value: string | null | undefined) {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleDateString('ar-SA');
}

export function parseValidDate(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

export function clampPositiveNumber(value: string | number, fallback: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.min(max, Math.floor(parsed));
}

export function buildNextExpiryLabel(mode: ActivationDurationMode, value: string) {
  const now = new Date();
  const next = new Date(now);

  switch (mode) {
    case 'year':
      next.setFullYear(next.getFullYear() + 1);
      break;
    case 'custom_months': {
      const months = clampPositiveNumber(value, 1, 240);
      next.setMonth(next.getMonth() + months);
      break;
    }
    case 'custom_years': {
      const years = clampPositiveNumber(value, 1, 20);
      next.setFullYear(next.getFullYear() + years);
      break;
    }
    case 'lifetime':
      next.setFullYear(next.getFullYear() + 100);
      break;
    case 'month':
    default:
      next.setMonth(next.getMonth() + 1);
      break;
  }

  return formatArabicDate(next.toISOString());
}

export function getCustomDurationLabel(mode: ActivationDurationMode) {
  return mode === 'custom_years' ? 'عدد السنوات' : 'عدد الشهور';
}
