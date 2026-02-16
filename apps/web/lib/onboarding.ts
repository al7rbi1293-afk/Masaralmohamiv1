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
    const now = Date.now();
    const { error: trialInsertError } = await adminClient.from('trial_subscriptions').insert({
      org_id: orgId,
      started_at: new Date(now).toISOString(),
      ends_at: new Date(now + 14 * 24 * 60 * 60 * 1000).toISOString(),
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

  const isExpired = trial.status === 'expired' || Date.now() >= new Date(trial.ends_at).getTime();

  return {
    orgId,
    isExpired,
  };
}
