import type { PartnerLeadStatus } from '@/lib/partners/types';

export const REFERRAL_COOKIE_CODE = 'masar_ref_code';
export const REFERRAL_COOKIE_PARTNER_ID = 'masar_ref_partner_id';
export const REFERRAL_COOKIE_SESSION_ID = 'masar_ref_session_id';
export const REFERRAL_COOKIE_CLICK_ID = 'masar_ref_click_id';
export const REFERRAL_COOKIE_CAPTURED_AT = 'masar_ref_captured_at';

export const REFERRAL_LOCAL_STORAGE_KEY = 'masar_referral';

export const DEFAULT_REFERRAL_WINDOW_DAYS = 30;

export const DEFAULT_PARTNER_COMMISSION_RATE = 5;
export const DEFAULT_MARKETING_COMMISSION_RATE = 5;

export const REFERRAL_COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export const LEAD_STATUS_RANK: Record<PartnerLeadStatus, number> = {
  visited: 1,
  signed_up: 2,
  trial_started: 3,
  subscribed: 4,
  cancelled: 5,
};
