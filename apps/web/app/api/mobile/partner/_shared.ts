import { MobileAppSessionContext } from '@/lib/mobile/auth';

type PartnerLeadStatus = 'visited' | 'signed_up' | 'trial_started' | 'subscribed' | 'cancelled';
type PartnerCommissionStatus = 'pending' | 'approved' | 'payable' | 'paid' | 'reversed';
type PartnerPayoutStatus = 'pending' | 'processing' | 'paid' | 'failed' | 'cancelled';

export type PartnerOverviewResponse = {
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

function asString(value: unknown) {
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}

function asNullableString(value: unknown) {
  const normalized = asString(value).trim();
  return normalized || null;
}

function asNumber(value: unknown) {
  const parsed = typeof value === 'number' ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function toneForLeadStatus(status: PartnerLeadStatus) {
  if (status === 'subscribed') return 'gold' as const;
  if (status === 'trial_started') return 'warning' as const;
  if (status === 'signed_up') return 'success' as const;
  if (status === 'cancelled') return 'danger' as const;
  return 'default' as const;
}

function toneForCommissionStatus(status: PartnerCommissionStatus) {
  if (status === 'paid') return 'success' as const;
  if (status === 'approved' || status === 'payable') return 'warning' as const;
  if (status === 'reversed') return 'danger' as const;
  return 'default' as const;
}

function toneForPayoutStatus(status: PartnerPayoutStatus) {
  if (status === 'paid') return 'success' as const;
  if (status === 'processing') return 'warning' as const;
  if (status === 'pending') return 'gold' as const;
  if (status === 'failed' || status === 'cancelled') return 'danger' as const;
  return 'default' as const;
}

function parseLeadStatus(value: unknown): PartnerLeadStatus {
  const status = asString(value) as PartnerLeadStatus;
  if (['visited', 'signed_up', 'trial_started', 'subscribed', 'cancelled'].includes(status)) {
    return status;
  }
  return 'visited';
}

function parseCommissionStatus(value: unknown): PartnerCommissionStatus {
  const status = asString(value) as PartnerCommissionStatus;
  if (['pending', 'approved', 'payable', 'paid', 'reversed'].includes(status)) {
    return status;
  }
  return 'pending';
}

function parsePayoutStatus(value: unknown): PartnerPayoutStatus {
  const status = asString(value) as PartnerPayoutStatus;
  if (['pending', 'processing', 'paid', 'failed', 'cancelled'].includes(status)) {
    return status;
  }
  return 'pending';
}

function leadStatusLabel(status: PartnerLeadStatus) {
  switch (status) {
    case 'visited':
      return 'زيارة';
    case 'signed_up':
      return 'تسجيل';
    case 'trial_started':
      return 'تجربة';
    case 'subscribed':
      return 'اشتراك';
    case 'cancelled':
      return 'ملغاة';
    default:
      return status;
  }
}

function commissionStatusLabel(status: PartnerCommissionStatus) {
  switch (status) {
    case 'pending':
      return 'قيد المراجعة';
    case 'approved':
      return 'معتمدة';
    case 'payable':
      return 'مستحقة';
    case 'paid':
      return 'مدفوعة';
    case 'reversed':
      return 'مسترجعة';
    default:
      return status;
  }
}

function payoutStatusLabel(status: PartnerPayoutStatus) {
  switch (status) {
    case 'pending':
      return 'بانتظار الصرف';
    case 'processing':
      return 'جاري الصرف';
    case 'paid':
      return 'تم الصرف';
    case 'failed':
      return 'فشل';
    case 'cancelled':
      return 'ملغاة';
    default:
      return status;
  }
}

function latestDate(...values: Array<string | null | undefined>) {
  const filtered = values
    .map((value) => (value ? new Date(value).getTime() : Number.NaN))
    .filter((value) => Number.isFinite(value) && value > 0);

  if (!filtered.length) {
    return null;
  }

  return new Date(Math.max(...filtered)).toISOString();
}

function buildActivityItems(params: {
  clicks: Array<Record<string, unknown>>;
  leads: Array<Record<string, unknown>>;
  commissions: Array<Record<string, unknown>>;
  payouts: Array<Record<string, unknown>>;
}) {
  const items: PartnerOverviewResponse['activity'] = [];

  for (const click of params.clicks.slice(0, 12)) {
    const createdAt = asNullableString(click.created_at);
    items.push({
      id: `click-${asString(click.id)}`,
      type: 'click',
      title: 'نقرة إحالة جديدة',
      subtitle: [click.landing_page, click.utm_source, click.utm_medium].map(asNullableString).filter(Boolean).join(' · ') || 'تم تسجيل زيارة من رابط الإحالة',
      created_at: createdAt,
      tone: 'default',
    });
  }

  for (const lead of params.leads.slice(0, 12)) {
    const status = parseLeadStatus(lead.status);
    const statusTone = toneForLeadStatus(status);
    items.push({
      id: `lead-${asString(lead.id)}`,
      type: 'lead',
      title:
        status === 'subscribed'
          ? 'اشتراك مؤهل من الإحالة'
          : status === 'trial_started'
            ? 'بدء تجربة مرتبطة بالإحالة'
            : status === 'signed_up'
              ? 'تسجيل جديد من الإحالة'
              : status === 'cancelled'
                ? 'إحالة ملغاة'
                : 'زيارة إحالة',
      subtitle: [lead.signup_source, lead.lead_email, lead.lead_phone].map(asNullableString).filter(Boolean).join(' · ') || 'سجل إحالة مرتبط بالشريك',
      created_at: asNullableString(lead.created_at) || asNullableString(lead.attributed_at),
      tone: statusTone,
    });
  }

  for (const commission of params.commissions.slice(0, 12)) {
    const status = parseCommissionStatus(commission.status);
    items.push({
      id: `commission-${asString(commission.id)}`,
      type: 'commission',
      title:
        status === 'paid'
          ? 'عمولة مدفوعة'
          : status === 'payable'
            ? 'عمولة مستحقة للصرف'
            : status === 'approved'
              ? 'عمولة معتمدة'
              : status === 'reversed'
                ? 'عمولة مسترجعة'
                : 'عمولة قيد المراجعة',
      subtitle: [commission.payment_id, commission.notes].map(asNullableString).filter(Boolean).join(' · ') || 'تفاصيل العمولة',
      created_at: asNullableString(commission.created_at) || asNullableString(commission.updated_at) || asNullableString(commission.paid_at),
      tone: toneForCommissionStatus(status),
    });
  }

  for (const payout of params.payouts.slice(0, 12)) {
    const status = parsePayoutStatus(payout.status);
    items.push({
      id: `payout-${asString(payout.id)}`,
      type: 'payout',
      title:
        status === 'paid'
          ? 'دفعة تم صرفها'
          : status === 'processing'
            ? 'دفعة قيد الصرف'
            : status === 'failed'
              ? 'فشل صرف الدفعة'
              : status === 'cancelled'
                ? 'دفعة ملغاة'
                : 'دفعة بانتظار الصرف',
      subtitle: [payout.reference_number, payout.payout_method].map(asNullableString).filter(Boolean).join(' · ') || 'سجل دفعة الشريك',
      created_at: asNullableString(payout.created_at) || asNullableString(payout.updated_at),
      tone: toneForPayoutStatus(status),
    });
  }

  return items
    .sort((left, right) => {
      const leftTime = left.created_at ? new Date(left.created_at).getTime() : 0;
      const rightTime = right.created_at ? new Date(right.created_at).getTime() : 0;
      return rightTime - leftTime;
    })
    .slice(0, 24);
}

export async function buildPartnerOverview(context: MobileAppSessionContext): Promise<PartnerOverviewResponse> {
  if (!context.partner) {
    throw new Error('missing_partner');
  }

  const partnerId = context.partner.id;
  const db = context.db;

  const [
    appUserRes,
    partnerRes,
    clicksCountRes,
    recentClicksRes,
    leadsRes,
    commissionsRes,
    payoutsRes,
  ] = await Promise.all([
    db
      .from('app_users')
      .select('id, full_name, email, phone')
      .eq('id', context.user.id)
      .maybeSingle(),
    db
      .from('partners')
      .select('id, full_name, email, whatsapp_number, partner_code, referral_link, is_active, commission_rate_partner, commission_rate_marketing, created_at, approved_at')
      .eq('id', partnerId)
      .maybeSingle(),
    db
      .from('partner_clicks')
      .select('id', { count: 'exact', head: true })
      .eq('partner_id', partnerId),
    db
      .from('partner_clicks')
      .select('id, created_at, landing_page, ref_code, session_id, utm_source, utm_medium, utm_campaign')
      .eq('partner_id', partnerId)
      .order('created_at', { ascending: false })
      .limit(12),
    db
      .from('partner_leads')
      .select('id, status, signup_source, lead_email, lead_phone, attributed_at, created_at, updated_at, click_id, user_id', { count: 'exact' })
      .eq('partner_id', partnerId)
      .order('created_at', { ascending: false })
      .limit(500),
    db
      .from('partner_commissions')
      .select('id, payment_id, base_amount, partner_amount, marketing_amount, currency, status, notes, paid_at, created_at, updated_at', { count: 'exact' })
      .eq('partner_id', partnerId)
      .order('created_at', { ascending: false })
      .limit(500),
    db
      .from('partner_payouts')
      .select('id, total_amount, status, reference_number, payout_method, period_start, period_end, pending_amount_for_partner, notes, created_at, updated_at', { count: 'exact' })
      .eq('partner_id', partnerId)
      .order('created_at', { ascending: false })
      .limit(120),
  ]);

  if (partnerRes.error) {
    throw new Error(partnerRes.error.message);
  }
  if (appUserRes.error) {
    throw new Error(appUserRes.error.message);
  }

  const partner = partnerRes.data;
  if (!partner) {
    throw new Error('تعذر العثور على حساب الشريك.');
  }

  const leadRows = (leadsRes.data as Array<Record<string, unknown>> | null) ?? [];
  const commissionRows = (commissionsRes.data as Array<Record<string, unknown>> | null) ?? [];
  const payoutRows = (payoutsRes.data as Array<Record<string, unknown>> | null) ?? [];
  const recentClickRows = (recentClicksRes.data as Array<Record<string, unknown>> | null) ?? [];

  const leadTotals = {
    visited: 0,
    signed_up: 0,
    trial_started: 0,
    subscribed: 0,
    cancelled: 0,
  } as Record<PartnerLeadStatus, number>;

  for (const row of leadRows) {
    const status = parseLeadStatus(row.status);
    leadTotals[status] += 1;
  }

  const commissionTotals = {
    total_commission: 0,
    paid_commission: 0,
    payable_commission: 0,
    pending_commission: 0,
  };

  let commissionCurrency = 'SAR';
  for (const row of commissionRows) {
    const status = parseCommissionStatus(row.status);
    const amount = asNumber(row.partner_amount);
    commissionCurrency = asString(row.currency) || commissionCurrency;

    if (status !== 'reversed') {
      commissionTotals.total_commission += amount;
    }
    if (status === 'paid') {
      commissionTotals.paid_commission += amount;
    }
    if (status === 'payable') {
      commissionTotals.payable_commission += amount;
    }
    if (status === 'pending' || status === 'approved') {
      commissionTotals.pending_commission += amount;
    }
  }

  let payoutTotal = 0;
  let pendingPayoutTotal = 0;
  for (const row of payoutRows) {
    const status = parsePayoutStatus(row.status);
    const amount = asNumber(row.total_amount);
    if (status === 'paid') {
      payoutTotal += amount;
    }
    if (status === 'pending' || status === 'processing') {
      pendingPayoutTotal += asNumber(row.pending_amount_for_partner || amount);
    }
  }

  const clicksCount = clicksCountRes.count ?? recentClickRows.length;
  const leadCount = leadsRes.count ?? leadRows.length;
  const subscribedCount = leadTotals.subscribed;
  const conversionRate = clicksCount > 0 ? round2((subscribedCount / clicksCount) * 100) : 0;

  return {
    user: {
      id: asString((appUserRes.data as any)?.id || context.user.id),
      full_name: asNullableString((appUserRes.data as any)?.full_name) || context.user.full_name,
      email: asNullableString((appUserRes.data as any)?.email) || context.user.email,
      phone: asNullableString((appUserRes.data as any)?.phone) || asNullableString(context.partner.whatsapp_number),
    },
    partner: {
      id: asString(partner.id),
      full_name: asNullableString(partner.full_name),
      email: asNullableString(partner.email),
      whatsapp_number: asNullableString(partner.whatsapp_number),
      partner_code: asString(partner.partner_code),
      referral_link: asString(partner.referral_link),
      is_active: Boolean(partner.is_active),
      commission_rate_partner: asNumber(partner.commission_rate_partner),
      commission_rate_marketing: asNumber(partner.commission_rate_marketing),
      created_at: asNullableString(partner.created_at),
      approved_at: asNullableString(partner.approved_at),
    },
    kpis: {
      clicks: clicksCount,
      leads: leadCount,
      signed_up: leadTotals.signed_up + leadTotals.trial_started + leadTotals.subscribed,
      trial_started: leadTotals.trial_started,
      subscribed: leadTotals.subscribed,
      total_commission: round2(commissionTotals.total_commission),
      paid_commission: round2(commissionTotals.paid_commission),
      payable_commission: round2(commissionTotals.payable_commission),
      pending_commission: round2(commissionTotals.pending_commission),
      payout_total: round2(payoutTotal),
      pending_payout_total: round2(pendingPayoutTotal),
      commission_currency: commissionCurrency || 'SAR',
      conversion_rate: conversionRate,
    },
    funnel: [
      { status: 'visited', label: leadStatusLabel('visited'), count: leadTotals.visited },
      { status: 'signed_up', label: leadStatusLabel('signed_up'), count: leadTotals.signed_up },
      { status: 'trial_started', label: leadStatusLabel('trial_started'), count: leadTotals.trial_started },
      { status: 'subscribed', label: leadStatusLabel('subscribed'), count: leadTotals.subscribed },
      { status: 'cancelled', label: leadStatusLabel('cancelled'), count: leadTotals.cancelled },
    ],
    recent_clicks: recentClickRows.map((row) => ({
      id: asString(row.id),
      created_at: asNullableString(row.created_at),
      landing_page: asNullableString(row.landing_page),
      ref_code: asNullableString(row.ref_code),
      session_id: asNullableString(row.session_id),
      utm_source: asNullableString(row.utm_source),
      utm_medium: asNullableString(row.utm_medium),
      utm_campaign: asNullableString(row.utm_campaign),
    })),
    recent_leads: leadRows.map((row) => ({
      id: asString(row.id),
      status: parseLeadStatus(row.status),
      signup_source: asNullableString(row.signup_source),
      lead_email: asNullableString(row.lead_email),
      lead_phone: asNullableString(row.lead_phone),
      attributed_at: asNullableString(row.attributed_at),
      created_at: asNullableString(row.created_at),
      updated_at: asNullableString(row.updated_at),
      click_id: asNullableString(row.click_id),
      user_id: asNullableString(row.user_id),
    })),
    recent_commissions: commissionRows.map((row) => ({
      id: asString(row.id),
      payment_id: asNullableString(row.payment_id),
      base_amount: round2(asNumber(row.base_amount)),
      partner_amount: round2(asNumber(row.partner_amount)),
      marketing_amount: round2(asNumber(row.marketing_amount)),
      currency: asString(row.currency) || commissionCurrency || 'SAR',
      status: parseCommissionStatus(row.status),
      notes: asNullableString(row.notes),
      paid_at: asNullableString(row.paid_at),
      created_at: asNullableString(row.created_at),
      updated_at: asNullableString(row.updated_at),
    })),
    recent_payouts: payoutRows.map((row) => ({
      id: asString(row.id),
      total_amount: round2(asNumber(row.total_amount)),
      status: parsePayoutStatus(row.status),
      reference_number: asNullableString(row.reference_number),
      payout_method: asNullableString(row.payout_method),
      period_start: asNullableString(row.period_start),
      period_end: asNullableString(row.period_end),
      pending_amount_for_partner: round2(asNumber(row.pending_amount_for_partner)),
      notes: asNullableString(row.notes),
      created_at: asNullableString(row.created_at),
      updated_at: asNullableString(row.updated_at),
    })),
    activity: buildActivityItems({
      clicks: recentClickRows,
      leads: leadRows,
      commissions: commissionRows,
      payouts: payoutRows,
    }),
  };
}

export function getPartnerActivityTone(status: string) {
  const normalized = status.trim().toLowerCase();
  if (normalized === 'subscribed' || normalized === 'paid' || normalized === 'paid_payout') {
    return 'success' as const;
  }
  if (normalized === 'trial_started' || normalized === 'processing' || normalized === 'approved') {
    return 'warning' as const;
  }
  if (normalized === 'cancelled' || normalized === 'failed' || normalized === 'reversed') {
    return 'danger' as const;
  }
  if (normalized === 'payable') {
    return 'gold' as const;
  }
  return 'default' as const;
}

export function getPartnerCurrencyLabel(currency: string) {
  return currency || 'SAR';
}

export function getPartnerStatusTone(status: string) {
  const normalized = status.trim().toLowerCase();
  if (normalized === 'paid') return 'success' as const;
  if (normalized === 'approved' || normalized === 'payable' || normalized === 'processing') return 'warning' as const;
  if (normalized === 'reversed' || normalized === 'failed' || normalized === 'cancelled') return 'danger' as const;
  if (normalized === 'pending') return 'gold' as const;
  return 'default' as const;
}

export function getPartnerFunnelMeta() {
  return {
    leadStatusLabel,
    commissionStatusLabel,
    payoutStatusLabel,
    toneForLeadStatus,
    toneForCommissionStatus,
    toneForPayoutStatus,
  };
}
