import {
  createSupabaseServerClient,
} from '@/lib/supabase/server';
import { getCurrentAuthUser } from '@/lib/supabase/auth-session';

export type TrialStatus = {
  orgId: string | null;
  endsAt: string | null;
  daysLeft: number | null;
  isExpired: boolean;
  status: 'active' | 'expired' | 'none';
};

type MembershipRow = {
  org_id: string;
  created_at: string;
};

type TrialRow = {
  ends_at: string;
  status: 'active' | 'expired';
};

const EMPTY_TRIAL_STATUS: TrialStatus = {
  orgId: null,
  endsAt: null,
  daysLeft: null,
  isExpired: false,
  status: 'none',
};

export async function getTrialStatusForCurrentUser(): Promise<TrialStatus> {
  const currentUser = await getCurrentAuthUser();
  if (!currentUser) {
    return EMPTY_TRIAL_STATUS;
  }

  const supabase = createSupabaseServerClient();

  const { data: membershipData, error: membershipError } = await supabase
    .from('memberships')
    .select('org_id, created_at')
    .eq('user_id', currentUser.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    throw membershipError;
  }

  const membership = membershipData as MembershipRow | null;

  if (!membership) {
    return EMPTY_TRIAL_STATUS;
  }

  const orgId = membership.org_id;

  const { data: trialData, error: trialError } = await supabase
    .from('trial_subscriptions')
    .select('ends_at, status')
    .eq('org_id', orgId)
    .maybeSingle();

  if (trialError) {
    throw trialError;
  }

  const trial = trialData as TrialRow | null;

  if (!trial) {
    return {
      orgId,
      endsAt: null,
      daysLeft: null,
      isExpired: false,
      status: 'none',
    };
  }

  const now = Date.now();
  const endsAtTime = new Date(trial.ends_at).getTime();
  const msInDay = 24 * 60 * 60 * 1000;
  const daysLeft = Math.max(0, Math.ceil((endsAtTime - now) / msInDay));
  const isExpired = now >= endsAtTime || trial.status === 'expired';

  return {
    orgId,
    endsAt: trial.ends_at,
    daysLeft,
    isExpired,
    status: isExpired ? 'expired' : 'active',
  };
}
