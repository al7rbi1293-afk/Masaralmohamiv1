export type PartnerApplication = {
  id: string;
  full_name: string;
  whatsapp_number: string;
  email: string;
  city: string;
  marketing_experience: string;
  audience_notes: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'needs_review';
  admin_notes: string | null;
  created_at: string;
};

export type PartnerRow = {
  id: string;
  full_name: string;
  whatsapp_number: string;
  email: string;
  partner_code: string;
  referral_link: string;
  is_active: boolean;
  stats: {
    clicksCount: number;
    signupsCount: number;
    subscribedCount: number;
    totalCommissionAmount: number;
  };
};

export type CommissionRow = {
  id: string;
  partner_id: string;
  payment_id: string;
  currency: string;
  base_amount: number;
  partner_amount: number;
  marketing_amount: number;
  status: 'pending' | 'approved' | 'payable' | 'paid' | 'reversed';
  created_at: string;
  notes: string | null;
  partner: {
    id: string;
    full_name: string;
    partner_code: string;
    email: string;
  } | null;
};

export type PayoutRow = {
  id: string;
  partner_id: string;
  partner_name: string;
  period_start: string;
  period_end: string;
  total_amount: number;
  payout_method: string | null;
  reference_number: string | null;
  status: 'pending' | 'processing' | 'paid' | 'failed' | 'cancelled';
  pending_amount_for_partner: number;
  created_at: string;
};

export type AuditRow = {
  id: string;
  action: string;
  target_type: string;
  target_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
};

export type PartnersView = 'applications' | 'partners' | 'commissions' | 'payouts' | 'audit';

export const APPLICATION_STATUS_OPTIONS = ['all', 'pending', 'approved', 'rejected', 'needs_review'] as const;
export const COMMISSION_STATUS_OPTIONS = ['all', 'pending', 'approved', 'payable', 'paid', 'reversed'] as const;
export const PAYOUT_STATUS_OPTIONS = ['all', 'pending', 'processing', 'paid', 'failed', 'cancelled'] as const;

export type ApplicationStatusFilter = (typeof APPLICATION_STATUS_OPTIONS)[number];
