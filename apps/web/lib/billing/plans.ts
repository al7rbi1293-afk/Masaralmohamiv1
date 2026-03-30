export const CANONICAL_PLAN_CODES = ['TRIAL', 'SOLO', 'SMALL_OFFICE', 'MEDIUM_OFFICE', 'ENTERPRISE'] as const;

export type CanonicalPlanCode = (typeof CANONICAL_PLAN_CODES)[number];

export type PaidPlanCode = Exclude<CanonicalPlanCode, 'TRIAL'>;

export type SelfServePlanCode = Exclude<PaidPlanCode, 'ENTERPRISE'>;

export type ProductEdition = 'standard' | 'enterprise';

const PLAN_CODE_ALIASES: Record<string, CanonicalPlanCode> = {
  TRIAL: 'TRIAL',
  SOLO: 'SOLO',
  TEAM: 'SMALL_OFFICE',
  SMALL_OFFICE: 'SMALL_OFFICE',
  BUSINESS: 'MEDIUM_OFFICE',
  MEDIUM: 'MEDIUM_OFFICE',
  MEDIUM_OFFICE: 'MEDIUM_OFFICE',
  PRO: 'ENTERPRISE',
  ENTERPRISE: 'ENTERPRISE',
};

const DEFAULT_SEAT_LIMITS: Record<CanonicalPlanCode, number> = {
  TRIAL: 2,
  SOLO: 1,
  SMALL_OFFICE: 5,
  MEDIUM_OFFICE: 10,
  ENTERPRISE: 999,
};

const PLAN_DISPLAY_LABELS: Record<CanonicalPlanCode, string> = {
  TRIAL: 'تجربة',
  SOLO: 'المحامي المستقل (1 مستخدم)',
  SMALL_OFFICE: 'مكتب صغير (حتى 5 مستخدمين)',
  MEDIUM_OFFICE: 'مكتب متوسط (حتى 10 مستخدمين)',
  ENTERPRISE: 'نسخة الشركات (تكاملات ناجز)',
};

function normalizeSubscriptionStatus(status: unknown) {
  return String(status ?? '').trim().toLowerCase();
}

export function normalizePlanCode(rawPlan: unknown, fallback: CanonicalPlanCode = 'TRIAL'): CanonicalPlanCode {
  const normalized = String(rawPlan ?? '').trim().toUpperCase();
  if (!normalized) {
    return fallback;
  }

  return PLAN_CODE_ALIASES[normalized] ?? fallback;
}

export function isPaidPlanCode(planCode: unknown): planCode is PaidPlanCode {
  return normalizePlanCode(planCode, 'TRIAL') !== 'TRIAL';
}

export function isSelfServePlanCode(planCode: unknown): planCode is SelfServePlanCode {
  const normalized = normalizePlanCode(planCode, 'TRIAL');
  return normalized === 'SOLO' || normalized === 'SMALL_OFFICE' || normalized === 'MEDIUM_OFFICE';
}

export function getProductEdition(planCode: unknown): ProductEdition {
  return normalizePlanCode(planCode, 'TRIAL') === 'ENTERPRISE' ? 'enterprise' : 'standard';
}

export function planSupportsNajizIntegration(planCode: unknown) {
  return getProductEdition(planCode) === 'enterprise';
}

export function isTrialSubscriptionStatus(status: unknown) {
  return normalizeSubscriptionStatus(status) === 'trial';
}

export function resolveEffectivePlanCode(params: {
  subscriptionPlan?: unknown;
  subscriptionStatus?: unknown;
  legacyPlan?: unknown;
  legacyStatus?: unknown;
  hasActiveTrial?: boolean;
}): CanonicalPlanCode | null {
  if (isTrialSubscriptionStatus(params.subscriptionStatus)) {
    return 'TRIAL';
  }

  const normalizedSubscriptionPlan = normalizePlanCode(params.subscriptionPlan, 'TRIAL');
  if (normalizedSubscriptionPlan !== 'TRIAL') {
    return normalizedSubscriptionPlan;
  }

  if (isTrialSubscriptionStatus(params.legacyStatus)) {
    return 'TRIAL';
  }

  const normalizedLegacyPlan = normalizePlanCode(params.legacyPlan, 'TRIAL');
  if (normalizedLegacyPlan !== 'TRIAL') {
    return normalizedLegacyPlan;
  }

  return params.hasActiveTrial ? 'TRIAL' : null;
}

export function getDefaultSeatLimit(planCode: unknown) {
  return DEFAULT_SEAT_LIMITS[normalizePlanCode(planCode, 'SOLO')] ?? DEFAULT_SEAT_LIMITS.SOLO;
}

export function getPlanDisplayLabel(planCode: unknown) {
  const normalized = normalizePlanCode(planCode, 'TRIAL');
  return PLAN_DISPLAY_LABELS[normalized] ?? normalized;
}
