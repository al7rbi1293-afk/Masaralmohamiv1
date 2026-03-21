export type PartnerLeadStatus = 'visited' | 'signed_up' | 'trial_started' | 'subscribed' | 'cancelled';
export type PartnerCommissionStatus = 'pending' | 'approved' | 'payable' | 'paid' | 'reversed';
export type PartnerPayoutStatus = 'pending' | 'processing' | 'paid' | 'failed' | 'cancelled';

export type PartnerOverview = {
  user: {
    id: string;
    full_name: string | null;
    email: string | null;
    phone: string | null;
  };
  partner: {
    id: string;
    full_name: string | null;
    email: string | null;
    whatsapp_number: string | null;
    partner_code: string;
    referral_link: string;
    is_active: boolean;
    commission_rate_partner: number;
    commission_rate_marketing: number;
    created_at: string | null;
    approved_at: string | null;
  };
  kpis: {
    clicks: number;
    leads: number;
    signed_up: number;
    trial_started: number;
    subscribed: number;
    total_commission: number;
    paid_commission: number;
    payable_commission: number;
    pending_commission: number;
    payout_total: number;
    pending_payout_total: number;
    commission_currency: string;
    conversion_rate: number;
  };
  funnel: Array<{
    status: PartnerLeadStatus;
    label: string;
    count: number;
  }>;
  recent_clicks: Array<{
    id: string;
    created_at: string | null;
    landing_page: string | null;
    ref_code: string | null;
    session_id: string | null;
    utm_source: string | null;
    utm_medium: string | null;
    utm_campaign: string | null;
  }>;
  recent_leads: Array<{
    id: string;
    status: PartnerLeadStatus;
    signup_source: string | null;
    lead_email: string | null;
    lead_phone: string | null;
    attributed_at: string | null;
    created_at: string | null;
    updated_at: string | null;
    click_id: string | null;
    user_id: string | null;
  }>;
  recent_commissions: Array<{
    id: string;
    payment_id: string | null;
    base_amount: number;
    partner_amount: number;
    marketing_amount: number;
    currency: string;
    status: PartnerCommissionStatus;
    notes: string | null;
    paid_at: string | null;
    created_at: string | null;
    updated_at: string | null;
  }>;
  recent_payouts: Array<{
    id: string;
    total_amount: number;
    status: PartnerPayoutStatus;
    reference_number: string | null;
    payout_method: string | null;
    period_start: string | null;
    period_end: string | null;
    pending_amount_for_partner: number;
    notes: string | null;
    created_at: string | null;
    updated_at: string | null;
  }>;
  activity: Array<{
    id: string;
    type: 'click' | 'lead' | 'commission' | 'payout';
    title: string;
    subtitle: string;
    created_at: string | null;
    tone: 'default' | 'success' | 'warning' | 'gold' | 'danger';
  }>;
};
