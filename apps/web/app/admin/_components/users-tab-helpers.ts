import type { PendingUser, User } from './users-tab-types';

export function isConfirmedUser(u: User | PendingUser): u is User {
  return 'status' in u;
}

export function isOrganizationExpired(org: User['memberships'][number]['organizations']) {
  if (!org) return false;

  const now = new Date();

  if (org.subscription?.status === 'active' || org.subscription?.status === 'past_due') {
    if (org.subscription.current_period_end) {
      return new Date(org.subscription.current_period_end) < now;
    }
    return false;
  }

  if (org.trial?.ends_at) {
    return org.trial.status === 'expired' || new Date(org.trial.ends_at) < now;
  }

  return false;
}

export function isUserExpired(u: User) {
  const m = Array.isArray(u.memberships) ? u.memberships[0] : null;
  return isOrganizationExpired(m?.organizations ?? null);
}
