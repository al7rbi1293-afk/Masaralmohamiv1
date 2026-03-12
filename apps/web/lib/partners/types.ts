export type PartnerApplicationStatus = 'pending' | 'approved' | 'rejected' | 'needs_review';

export type PartnerLeadStatus = 'visited' | 'signed_up' | 'trial_started' | 'subscribed' | 'cancelled';

export type PartnerCommissionStatus = 'pending' | 'approved' | 'payable' | 'paid' | 'reversed';

export type PartnerPayoutStatus = 'pending' | 'processing' | 'paid' | 'failed' | 'cancelled';

export type TapPaymentStatus =
  | 'initiated'
  | 'pending'
  | 'captured'
  | 'failed'
  | 'cancelled'
  | 'refunded'
  | 'authorized';

export type ReferralCaptureResult = {
  captured: boolean;
  partnerId: string | null;
  partnerCode: string | null;
  clickId: string | null;
  sessionId: string;
  reason?:
    | 'missing_ref'
    | 'invalid_ref'
    | 'inactive_partner'
    | 'expired'
    | 'already_captured'
    | 'self_referral'
    | 'ok';
};

export type AttributionResult = {
  attributed: boolean;
  leadId: string | null;
  partnerId: string | null;
  partnerCode: string | null;
  blockedReason?: 'missing_ref' | 'invalid_ref' | 'inactive_partner' | 'self_referral' | 'expired' | 'first_touch_locked';
};

export type PartnerSummaryStats = {
  clicksCount: number;
  signupsCount: number;
  subscribedCount: number;
  totalCommissionAmount: number;
};
