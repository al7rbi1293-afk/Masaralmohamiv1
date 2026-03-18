import 'server-only';

import { createSupabaseServerClient } from '@/lib/supabase/server';

type MembershipRow = {
  org_id: string;
};

type OrgRow = {
  id: string;
};

type TrialRow = {
  ends_at: string;
  status: 'active' | 'expired';
};

type SubscriptionRow = {
  status: string | null;
  current_period_end: string | null;
};

type EnsureTrialProvisionParams = {
  userId: string;
  firmName?: string | null;
};

type EnsureTrialProvisionResult = {
  orgId: string;
  isExpired: boolean;
};

export async function ensureTrialProvisionForUser(
  params: EnsureTrialProvisionParams,
): Promise<EnsureTrialProvisionResult> {
  const { userId } = params;
  const firmName = params.firmName?.trim() || null;
  const adminClient = createSupabaseServerClient();

  const { data: membershipData, error: membershipError } = await adminClient
    .from('memberships')
    .select('org_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    throw membershipError;
  }

  let orgId = (membershipData as MembershipRow | null)?.org_id ?? null;

  if (!orgId) {
    const { data: organizationData, error: organizationError } = await adminClient
      .from('organizations')
      .insert({
        name: firmName ?? 'مكتب جديد',
      })
      .select('id')
      .single();

    if (organizationError) {
      throw organizationError;
    }

    orgId = (organizationData as OrgRow).id;

    const { error: membershipInsertError } = await adminClient.from('memberships').insert({
      org_id: orgId,
      user_id: userId,
      role: 'owner',
    });

    if (membershipInsertError) {
      throw membershipInsertError;
    }
  }

  const [subscriptionData, legacySubscriptionData] = await Promise.all([
    adminClient
      .from('subscriptions')
      .select('status, current_period_end')
      .eq('org_id', orgId)
      .maybeSingle(),
    adminClient
      .from('org_subscriptions')
      .select('status, current_period_end')
      .eq('org_id', orgId)
      .maybeSingle(),
  ]);

  if (subscriptionData.error) {
    throw subscriptionData.error;
  }

  if (legacySubscriptionData.error) {
    throw legacySubscriptionData.error;
  }

  const now = new Date();
  const modernSubscription = (subscriptionData.data as SubscriptionRow | null) ?? null;
  const legacySubscription = (legacySubscriptionData.data as SubscriptionRow | null) ?? null;

  if (
    subscriptionGrantsAccess(modernSubscription, now) ||
    subscriptionGrantsAccess(legacySubscription, now)
  ) {
    return {
      orgId,
      isExpired: false,
    };
  }

  const { data: trialData, error: trialError } = await adminClient
    .from('trial_subscriptions')
    .select('ends_at, status')
    .eq('org_id', orgId)
    .maybeSingle();

  if (trialError) {
    throw trialError;
  }

  const trial = trialData as TrialRow | null;

  if (!trial) {
    const nowMs = now.getTime();
    const { error: trialInsertError } = await adminClient.from('trial_subscriptions').insert({
      org_id: orgId,
      started_at: new Date(nowMs).toISOString(),
      ends_at: new Date(nowMs + 14 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'active',
    });

    if (trialInsertError) {
      throw trialInsertError;
    }

    return {
      orgId,
      isExpired: false,
    };
  }

  const isExpired = trial.status === 'expired' || now.getTime() >= new Date(trial.ends_at).getTime();

  return {
    orgId,
    isExpired,
  };
}

function subscriptionGrantsAccess(subscription: SubscriptionRow | null, now: Date) {
  if (!subscription) {
    return false;
  }

  const status = String(subscription.status || '').trim().toLowerCase();
  const activeStatus =
    status === 'active' ||
    status === 'past_due' ||
    status === 'canceled' ||
    status === 'cancelled';

  if (!activeStatus) {
    return false;
  }

  if (!subscription.current_period_end) {
    return true;
  }

  const periodEnd = new Date(subscription.current_period_end);
  if (Number.isNaN(periodEnd.getTime())) {
    return false;
  }

  return periodEnd.getTime() > now.getTime();
}
