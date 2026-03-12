import 'server-only';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { addPartnerAuditLog } from '@/lib/partners/service';
import { getEligibleAttributionForUser, updateLeadStatusForUser } from '@/lib/partners/referral';
import { DEFAULT_MARKETING_COMMISSION_RATE, DEFAULT_PARTNER_COMMISSION_RATE } from '@/lib/partners/constants';
import { isSelfReferral } from '@/lib/partners/rules';
import { calculateCommissionAmounts } from '@/lib/partners/math';

function isPotentialFraud(params: {
  userStatus: string | null;
}) {
  // Placeholder rule-set: any suspended account is ineligible.
  return params.userStatus === 'suspended';
}

export async function createCommissionForTapPayment(params: {
  tapChargeId: string;
  userId: string;
  subscriptionId?: string | null;
  amount: number;
  currency: string;
}) {
  const db = createSupabaseServerClient();

  const { data: user, error: userError } = await db
    .from('app_users')
    .select('id, email, status')
    .eq('id', params.userId)
    .maybeSingle();

  if (userError || !user) {
    return { created: false, reason: 'user_not_found' as const };
  }

  if (isPotentialFraud({ userStatus: user.status })) {
    return { created: false, reason: 'fraud_blocked' as const };
  }

  const attribution = await getEligibleAttributionForUser({
    userId: params.userId,
    email: user.email,
  });

  if (!attribution) {
    return { created: false, reason: 'no_attribution' as const };
  }

  const partner = attribution.partner as {
    id: string;
    email: string;
    user_id: string | null;
    commission_rate_partner: number | null;
    commission_rate_marketing: number | null;
  } | null;

  if (!partner?.id) {
    return { created: false, reason: 'partner_not_found' as const };
  }

  const partnerEmail = String(partner.email || '').toLowerCase();
  const userEmail = String(user.email || '').toLowerCase();

  // Self-referral safeguard.
  if (isSelfReferral({
    partnerEmail,
    partnerUserId: partner.user_id,
    customerEmail: userEmail,
    customerUserId: params.userId,
  })) {
    return { created: false, reason: 'self_referral' as const };
  }

  const { data: existingCommission, error: existingError } = await db
    .from('partner_commissions')
    .select('id')
    .eq('payment_id', params.tapChargeId)
    .eq('partner_id', partner.id)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }

  if (existingCommission) {
    return { created: false, reason: 'duplicate' as const };
  }

  const calculated = calculateCommissionAmounts({
    baseAmount: params.amount,
    partnerRate: partner.commission_rate_partner ?? DEFAULT_PARTNER_COMMISSION_RATE,
    marketingRate: partner.commission_rate_marketing ?? DEFAULT_MARKETING_COMMISSION_RATE,
  });

  const { data: commission, error: commissionError } = await db
    .from('partner_commissions')
    .insert({
      partner_id: partner.id,
      customer_user_id: params.userId,
      lead_id: attribution.id,
      subscription_id: params.subscriptionId || null,
      payment_id: params.tapChargeId,
      base_amount: calculated.baseAmount,
      partner_rate: calculated.partnerRate,
      partner_amount: calculated.partnerAmount,
      marketing_rate: calculated.marketingRate,
      marketing_amount: calculated.marketingAmount,
      currency: params.currency || 'SAR',
      status: 'pending',
      eligible_at: new Date().toISOString(),
    })
    .select('*')
    .single();

  if (commissionError || !commission) {
    throw new Error(commissionError?.message || 'تعذر إنشاء سجل العمولة.');
  }

  await updateLeadStatusForUser({
    userId: params.userId,
    status: 'subscribed',
  });

  await addPartnerAuditLog({
    actorUserId: null,
    action: 'commission_created_from_tap_payment',
    targetType: 'partner_commission',
    targetId: commission.id,
    details: {
      tap_charge_id: params.tapChargeId,
      payment_amount: params.amount,
      currency: params.currency,
      partner_id: partner.id,
      user_id: params.userId,
    },
  });

  return {
    created: true,
    commission,
  };
}

export async function reverseCommissionByPaymentId(params: {
  tapChargeId: string;
  reason: string;
}) {
  const db = createSupabaseServerClient();

  const { data: commissions, error } = await db
    .from('partner_commissions')
    .select('id, status')
    .eq('payment_id', params.tapChargeId)
    .neq('status', 'reversed');

  if (error) throw new Error(error.message);

  if (!commissions?.length) {
    return { reversed: 0 };
  }

  const ids = commissions.map((item: any) => item.id);

  const { error: updateError } = await db
    .from('partner_commissions')
    .update({
      status: 'reversed',
      notes: params.reason,
      updated_at: new Date().toISOString(),
    })
    .in('id', ids);

  if (updateError) throw new Error(updateError.message);

  for (const commission of commissions) {
    await addPartnerAuditLog({
      actorUserId: null,
      action: 'commission_reversed_due_to_payment_event',
      targetType: 'partner_commission',
      targetId: String((commission as any).id),
      details: {
        tap_charge_id: params.tapChargeId,
        reason: params.reason,
      },
    });
  }

  return { reversed: ids.length };
}
