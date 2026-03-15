import 'server-only';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { parseTapChargePayload, resolvePeriodEnd } from '@/lib/partners/tap-utils';
import { createCommissionForTapPayment, reverseCommissionByPaymentId } from '@/lib/partners/commission';
import { addPartnerAuditLog } from '@/lib/partners/service';
import { toSubscriptionPlanCode } from '@/lib/partners/plan';
import { updateLeadStatusForUser } from '@/lib/partners/referral';
import { sendSubscriptionInvoiceEmail } from '@/lib/subscription-invoice-email';

type TapWebhookProcessResult = {
  eventId: string;
  status: 'processed' | 'ignored' | 'failed';
  message: string;
};

export function parseTapCharge(payload: Record<string, any>) {
  return parseTapChargePayload(payload);
}

function resolveSeats(planCode: string) {
  const normalized = String(planCode || '').trim().toUpperCase();
  if (normalized === 'SOLO') return 1;
  if (normalized === 'SMALL_OFFICE') return 5;
  if (normalized === 'MEDIUM_OFFICE') return 25;
  return 1;
}

async function upsertTapPaymentRecord(params: {
  charge: ReturnType<typeof parseTapCharge>;
  payload: Record<string, unknown>;
}) {
  const db = createSupabaseServerClient();
  const metadata = params.charge.metadata;

  const userId = String(metadata.user_id || '').trim();
  const orgId = String(metadata.org_id || '').trim() || null;
  const planId = String(metadata.plan_id || '').trim();

  if (!userId || !planId || !params.charge.chargeId) {
    throw new Error('Tap metadata is incomplete for upsert tap_payment.');
  }

  const existingRes = await db
    .from('tap_payments')
    .select('*')
    .eq('tap_charge_id', params.charge.chargeId)
    .maybeSingle();

  if (existingRes.error) {
    throw new Error(existingRes.error.message);
  }

  const payload = {
    tap_charge_id: params.charge.chargeId,
    tap_reference: params.charge.reference,
    user_id: userId,
    org_id: orgId,
    plan_id: planId,
    amount: params.charge.amount,
    currency: params.charge.currency,
    status: params.charge.status,
    gateway_response: params.payload,
    metadata,
    tap_customer_id: params.charge.customerId,
    tap_card_id: params.charge.cardId,
    tap_agreement_id: params.charge.agreementId,
    captured_at: params.charge.status === 'captured' ? new Date().toISOString() : null,
    refunded_at: params.charge.status === 'refunded' ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  };

  if (!existingRes.data) {
    const { data: inserted, error: insertError } = await db
      .from('tap_payments')
      .insert(payload)
      .select('*')
      .single();

    if (insertError || !inserted) {
      throw new Error(insertError?.message || 'Unable to insert tap payment record.');
    }

    return inserted as any;
  }

  const { data: updated, error: updateError } = await db
    .from('tap_payments')
    .update(payload)
    .eq('id', existingRes.data.id)
    .select('*')
    .single();

  if (updateError || !updated) {
    throw new Error(updateError?.message || 'Unable to update tap payment record.');
  }

  return updated as any;
}

async function activateSubscriptionFromTapPayment(tapPayment: any) {
  const db = createSupabaseServerClient();

  const metadata = (tapPayment.metadata && typeof tapPayment.metadata === 'object' ? tapPayment.metadata : {}) as Record<string, unknown>;
  const orgId = String(tapPayment.org_id || metadata.org_id || '').trim();
  const planId = String(tapPayment.plan_id || metadata.plan_id || '').trim();
  const userId = String(tapPayment.user_id || metadata.user_id || '').trim();
  const billingPeriod = String(metadata.billing_period || 'monthly').toLowerCase() === 'yearly' ? 'yearly' : 'monthly';

  if (!orgId || !planId || !userId) {
    throw new Error('Missing org/user/plan metadata for subscription activation.');
  }

  const periods = resolvePeriodEnd(billingPeriod);
  const normalizedPlan = toSubscriptionPlanCode(planId);

  const { data: subscription, error: subscriptionError } = await db
    .from('subscriptions')
    .upsert(
      {
        org_id: orgId,
        plan_code: normalizedPlan,
        status: 'active',
        seats: resolveSeats(normalizedPlan),
        current_period_start: periods.start,
        current_period_end: periods.end,
        cancel_at_period_end: false,
        provider: 'tap',
        provider_customer_id: tapPayment.tap_customer_id || null,
        provider_subscription_id: tapPayment.tap_agreement_id || tapPayment.tap_charge_id,
        tap_customer_id: tapPayment.tap_customer_id || null,
        tap_card_id: tapPayment.tap_card_id || null,
        tap_agreement_id: tapPayment.tap_agreement_id || null,
        last_payment_id: tapPayment.tap_charge_id,
      },
      { onConflict: 'org_id' },
    )
    .select('*')
    .single();

  if (subscriptionError || !subscription) {
    throw new Error(subscriptionError?.message || 'Unable to activate subscription from Tap payment.');
  }

  await db
    .from('tap_payments')
    .update({
      subscription_id: subscription.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', tapPayment.id);

  await db.from('subscription_events').insert({
    org_id: orgId,
    type: 'tap.payment.captured',
    meta: {
      tap_charge_id: tapPayment.tap_charge_id,
      plan_code: normalizedPlan,
      billing_period: billingPeriod,
      user_id: userId,
    },
  });

  await createCommissionForTapPayment({
    tapChargeId: tapPayment.tap_charge_id,
    userId,
    amount: Number(tapPayment.amount || 0),
    currency: String(tapPayment.currency || 'SAR'),
    subscriptionId: subscription.id,
  });

  await addPartnerAuditLog({
    actorUserId: null,
    action: 'tap_payment_subscription_activated',
    targetType: 'tap_payment',
    targetId: tapPayment.id,
    details: {
      tap_charge_id: tapPayment.tap_charge_id,
      subscription_id: subscription.id,
      org_id: orgId,
      user_id: userId,
    },
  });

  await sendSubscriptionInvoiceEmail({
    orgId,
    planCode: normalizedPlan,
    durationMonths: billingPeriod === 'yearly' ? 12 : 1,
    billingPeriod,
    amount: Number(tapPayment.amount || 0),
    currency: String(tapPayment.currency || 'SAR'),
    requestedByUserId: userId,
    sourceKind: 'tap',
    sourceId: String(tapPayment.id || tapPayment.tap_charge_id || ''),
    sentByUserId: userId,
  });

  return subscription;
}

async function handleRefundOrCancellation(tapPayment: any, reason: string) {
  const db = createSupabaseServerClient();

  await reverseCommissionByPaymentId({
    tapChargeId: tapPayment.tap_charge_id,
    reason,
  });

  if (tapPayment.subscription_id) {
    await db
      .from('subscriptions')
      .update({
        status: 'past_due',
        current_period_end: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', tapPayment.subscription_id);
  }

  if (tapPayment.user_id) {
    await updateLeadStatusForUser({
      userId: tapPayment.user_id,
      status: 'cancelled',
    }).catch(() => null);
  }

  await addPartnerAuditLog({
    actorUserId: null,
    action: 'tap_payment_reversed_or_cancelled',
    targetType: 'tap_payment',
    targetId: tapPayment.id,
    details: {
      tap_charge_id: tapPayment.tap_charge_id,
      reason,
    },
  });
}

export async function processTapWebhook(params: {
  payload: Record<string, unknown>;
  signature: string | null;
}): Promise<TapWebhookProcessResult> {
  const db = createSupabaseServerClient();
  const payload = params.payload as Record<string, any>;
  const charge = parseTapCharge(payload);

  const eventType = String(payload.event || payload.type || `charge.${charge.status}`);
  const tapEventId = String(payload.id || payload.event_id || '').trim() || null;

  const { data: webhookEvent, error: webhookInsertError } = await db
    .from('tap_webhook_events')
    .insert({
      tap_event_id: tapEventId,
      event_type: eventType,
      charge_id: charge.chargeId || null,
      signature: params.signature,
      payload,
      status: 'received',
    })
    .select('id')
    .single();

  if (webhookInsertError || !webhookEvent) {
    // if duplicate event id, ignore gracefully
    const duplicated = (webhookInsertError?.message || '').toLowerCase().includes('duplicate');
    if (duplicated) {
      return {
        eventId: tapEventId || 'duplicate',
        status: 'ignored',
        message: 'Duplicate webhook event ignored.',
      };
    }

    throw new Error(webhookInsertError?.message || 'Unable to store webhook event.');
  }

  try {
    if (!charge.chargeId) {
      await db
        .from('tap_webhook_events')
        .update({
          status: 'ignored',
          processed_at: new Date().toISOString(),
          error_message: 'Missing charge id.',
        })
        .eq('id', webhookEvent.id);

      return {
        eventId: webhookEvent.id,
        status: 'ignored',
        message: 'Missing charge id.',
      };
    }

    const tapPayment = await upsertTapPaymentRecord({
      charge,
      payload,
    });

    if (charge.status === 'captured') {
      await activateSubscriptionFromTapPayment(tapPayment);
    }

    if (charge.status === 'failed' || charge.status === 'cancelled' || charge.status === 'refunded') {
      await handleRefundOrCancellation(tapPayment, `tap_status_${charge.status}`);
    }

    await db
      .from('tap_webhook_events')
      .update({
        status: 'processed',
        processed_at: new Date().toISOString(),
      })
      .eq('id', webhookEvent.id);

    return {
      eventId: webhookEvent.id,
      status: 'processed',
      message: 'Webhook processed.',
    };
  } catch (error) {
    await db
      .from('tap_webhook_events')
      .update({
        status: 'failed',
        processed_at: new Date().toISOString(),
        error_message: error instanceof Error ? error.message : 'Unknown webhook error',
      })
      .eq('id', webhookEvent.id);

    throw error;
  }
}
