import { cookies } from 'next/headers';
import {
  ACCESS_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
} from '@/lib/supabase/constants';
import {
  createSupabaseServerAuthClient,
  createSupabaseServerClient,
} from '@/lib/supabase/server';

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
  const userId = await resolveCurrentUserId();
  if (!userId) {
    return EMPTY_TRIAL_STATUS;
  }

  const supabase = createSupabaseServerClient();

  const { data: membershipData, error: membershipError } = await supabase
    .from('memberships')
    .select('org_id, created_at')
    .eq('user_id', userId)
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

async function resolveCurrentUserId(): Promise<string | null> {
  const cookieStore = cookies();
  const accessToken = cookieStore.get(ACCESS_COOKIE_NAME)?.value;
  const refreshToken = cookieStore.get(REFRESH_COOKIE_NAME)?.value;

  if (!accessToken && !refreshToken) {
    return null;
  }

  const authClient = createSupabaseServerAuthClient();

  if (accessToken) {
    const { data, error } = await authClient.auth.getUser(accessToken);
    if (!error && data.user) {
      return data.user.id;
    }
  }

  if (!refreshToken) {
    return null;
  }

  const { data: refreshed, error: refreshError } = await authClient.auth.refreshSession({
    refresh_token: refreshToken,
  });

  if (refreshError || !refreshed.session) {
    return null;
  }

  const { data: refreshedUser, error: refreshedUserError } = await authClient.auth.getUser(
    refreshed.session.access_token,
  );

  if (refreshedUserError || !refreshedUser.user) {
    return null;
  }

  return refreshedUser.user.id;
}
