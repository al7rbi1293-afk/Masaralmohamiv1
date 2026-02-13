import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { getStripeWebhookSecret } from '@/lib/env';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { logError, logInfo } from '@/lib/logger';

export const runtime = 'nodejs';

type StripeStatus =
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'canceled'
  | 'unpaid'
  | 'incomplete'
  | 'incomplete_expired'
  | string;

function mapStripeStatus(status: StripeStatus) {
  const normalized = String(status || '').toLowerCase();
  switch (normalized) {
    case 'active':
      return 'active';
    case 'trialing':
      return 'trial';
    case 'past_due':
      return 'past_due';
    case 'canceled':
      return 'canceled';
    case 'unpaid':
      return 'past_due';
    case 'incomplete':
      return 'past_due';
    case 'incomplete_expired':
      return 'expired';
    default:
      return 'trial';
  }
}

function toIsoFromUnixSeconds(value: unknown) {
  const seconds = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return new Date(seconds * 1000).toISOString();
}

async function resolveOrgIdFromSubscriptionId(subscriptionId: string) {
  const service = createSupabaseServerClient();
  const { data, error } = await service
    .from('subscriptions')
    .select('org_id')
    .eq('provider_subscription_id', subscriptionId)
    .limit(1)
    .maybeSingle();

  if (error) return null;
  return (data as any)?.org_id ? String((data as any).org_id) : null;
}

export async function POST(request: NextRequest) {
  const stripe = getStripe();
  const signature = request.headers.get('stripe-signature') ?? '';

  let event: any;
  try {
    const payload = await request.text();
    event = stripe.webhooks.constructEvent(payload, signature, getStripeWebhookSecret());
  } catch (err) {
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 });
  }

  const service = createSupabaseServerClient();

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as any;
        const orgId = String(session?.metadata?.org_id ?? '').trim();
        const planCode = String(session?.metadata?.plan_code ?? '').trim().toUpperCase();

        const customerId =
          typeof session?.customer === 'string' ? (session.customer as string) : null;
        const subscriptionId =
          typeof session?.subscription === 'string' ? (session.subscription as string) : null;

        if (!orgId || !subscriptionId) {
          break;
        }

        const { error } = await service
          .from('subscriptions')
          .upsert(
            {
              org_id: orgId,
              plan_code: planCode || 'SOLO',
              provider: 'stripe',
              provider_customer_id: customerId,
              provider_subscription_id: subscriptionId,
            },
            { onConflict: 'org_id' },
          );

        if (error) {
          logError('stripe_webhook_checkout_update_failed', {
            orgId,
            message: error.message,
          });
        } else {
          logInfo('stripe_checkout_completed', { orgId });
        }

        await service.from('subscription_events').insert({
          org_id: orgId,
          type: 'stripe.checkout_completed',
          meta: { plan_code: planCode || null },
        });

        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object as any;
        const subscriptionId = String(sub?.id ?? '').trim();
        const customerId = typeof sub?.customer === 'string' ? (sub.customer as string) : null;
        const stripeStatus = String(sub?.status ?? '');
        const status =
          event.type === 'customer.subscription.deleted'
            ? 'canceled'
            : mapStripeStatus(stripeStatus);

        const orgFromMeta = String(sub?.metadata?.org_id ?? '').trim();
        const orgId =
          orgFromMeta ||
          (subscriptionId ? await resolveOrgIdFromSubscriptionId(subscriptionId) : null);

        if (!orgId) {
          break;
        }

        const planCode = String(sub?.metadata?.plan_code ?? '').trim().toUpperCase() || 'SOLO';
        const seats = Number(sub?.items?.data?.[0]?.quantity ?? 1) || 1;

        const currentPeriodStart = toIsoFromUnixSeconds(sub?.current_period_start);
        const currentPeriodEnd = toIsoFromUnixSeconds(sub?.current_period_end);
        const cancelAtPeriodEnd = Boolean(sub?.cancel_at_period_end);

        const { error } = await service
          .from('subscriptions')
          .upsert(
            {
              org_id: orgId,
              plan_code: planCode,
              status,
              seats,
              current_period_start: currentPeriodStart,
              current_period_end: currentPeriodEnd,
              cancel_at_period_end: cancelAtPeriodEnd,
              provider: 'stripe',
              provider_customer_id: customerId,
              provider_subscription_id: subscriptionId || null,
            },
            { onConflict: 'org_id' },
          );

        if (error) {
          logError('stripe_webhook_subscription_upsert_failed', {
            orgId,
            message: error.message,
          });
        } else {
          logInfo('stripe_subscription_synced', { orgId, status });
        }

        await service.from('subscription_events').insert({
          org_id: orgId,
          type: event.type,
          meta: { status, plan_code: planCode },
        });

        break;
      }

      default:
        // Ignore other events.
        break;
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    logError('stripe_webhook_failed', { message: error instanceof Error ? error.message : 'unknown_error' });
    return NextResponse.json({ error: 'Webhook handler failed.' }, { status: 500 });
  }
}

