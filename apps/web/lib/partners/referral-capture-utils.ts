import { normalizePartnerCode } from '@/lib/partners/utils';

export const REFERRAL_CAPTURE_GUARD_TTL_MS = 15_000;
export const REFERRAL_DUPLICATE_WINDOW_MS = 15_000;

export function buildReferralCaptureKey(params: {
  code: string;
  landingPage: string;
}) {
  const code = normalizePartnerCode(params.code) || 'UNKNOWN';
  const landingPage = String(params.landingPage || '/').trim().slice(0, 1000) || '/';
  return `${code}::${landingPage}`;
}

export function isRecentReferralTimestamp(
  value: string | null | undefined,
  nowMs = Date.now(),
  ttlMs = REFERRAL_CAPTURE_GUARD_TTL_MS,
) {
  if (!value) {
    return false;
  }

  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp) || timestamp > nowMs) {
    return false;
  }

  return nowMs - timestamp <= ttlMs;
}

export function getRecentReferralWindowStart(
  windowMs = REFERRAL_DUPLICATE_WINDOW_MS,
  nowMs = Date.now(),
) {
  return new Date(nowMs - windowMs).toISOString();
}
