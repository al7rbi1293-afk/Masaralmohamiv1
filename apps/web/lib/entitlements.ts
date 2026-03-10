export type SubscriptionSnapshot = {
  status: 'trial' | 'active' | 'past_due' | 'canceled' | 'expired' | string;
  currentPeriodEnd: string | null;
} | null;

export type TrialSnapshot = {
  endsAt: string | null;
  status: 'active' | 'expired' | string;
} | null;

export type EntitlementsResult = {
  access: 'full' | 'locked';
  reason: 'subscription_active' | 'trial_active' | 'subscription_expired' | 'trial_expired' | 'none';
  subscriptionActive: boolean;
  trialActive: boolean;
};

function parseDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

export function computeEntitlements(input: {
  now?: Date;
  trial: TrialSnapshot;
  subscription: SubscriptionSnapshot;
}): EntitlementsResult {
  const now = input.now ?? new Date();

  const subscriptionStatus = input.subscription?.status ?? null;
  const subscriptionPeriodEnd = parseDate(input.subscription?.currentPeriodEnd ?? null);
  const subscriptionHasFuturePeriod =
    Boolean(subscriptionPeriodEnd) && subscriptionPeriodEnd!.getTime() > now.getTime();
  const subscriptionHasEndedByDate =
    Boolean(subscriptionPeriodEnd) && subscriptionPeriodEnd!.getTime() <= now.getTime();
  const subscriptionActiveStatus =
    subscriptionStatus === 'active' || subscriptionStatus === 'past_due' || subscriptionStatus === 'canceled';

  const subscriptionActive =
    subscriptionActiveStatus && subscriptionHasFuturePeriod;

  if (subscriptionActive) {
    return {
      access: 'full',
      reason: 'subscription_active',
      subscriptionActive: true,
      trialActive: false,
    };
  }

  const subscriptionExpired =
    Boolean(input.subscription) &&
    (
      subscriptionStatus === 'expired' ||
      (subscriptionStatus === 'canceled' && !subscriptionPeriodEnd) ||
      (subscriptionActiveStatus && subscriptionHasEndedByDate)
    );

  const trialEndsAt = parseDate(input.trial?.endsAt ?? null);
  const trialStoredStatus = input.trial?.status ?? null;
  const trialExpired =
    (trialEndsAt ? now.getTime() >= trialEndsAt.getTime() : false) || trialStoredStatus === 'expired';
  const trialActive = Boolean(trialEndsAt) && !trialExpired;

  if (trialActive) {
    return {
      access: 'full',
      reason: 'trial_active',
      subscriptionActive: false,
      trialActive: true,
    };
  }

  if (subscriptionExpired) {
    return {
      access: 'locked',
      reason: 'subscription_expired',
      subscriptionActive: false,
      trialActive: false,
    };
  }

  if (trialEndsAt && trialExpired) {
    return {
      access: 'locked',
      reason: 'trial_expired',
      subscriptionActive: false,
      trialActive: false,
    };
  }

  return {
    access: 'full',
    reason: 'none',
    subscriptionActive: false,
    trialActive: false,
  };
}
