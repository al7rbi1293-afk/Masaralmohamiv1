import 'server-only';

import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  getPublicSiteUrl,
  getTapApiBaseUrl,
  getTapSecretKey,
  getTapSourceId,
  getTapWebhookSecret,
} from '@/lib/env';
import { normalizeTapStatus } from '@/lib/partners/tap-utils';

export type TapCreateChargeInput = {
  amount: number;
  currency: string;
  customer: {
    id?: string | null;
    first_name: string;
    last_name: string;
    email: string;
    phone?: {
      country_code?: string;
      number?: string;
    };
  };
  planCode: string;
  billingPeriod: 'monthly' | 'yearly';
  userId: string;
  orgId: string;
  redirectPath?: string;
  metadata?: Record<string, unknown>;
};

export type TapChargeResponse = {
  id: string;
  status: string;
  amount: number;
  currency: string;
  transaction?: {
    url?: string;
  };
  customer?: {
    id?: string;
  };
  card?: {
    id?: string;
  };
  payment_agreement?: {
    id?: string;
  };
  reference?: {
    transaction?: string;
    order?: string;
  };
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
};

export type TapRecurringChargeInput = {
  amount: number;
  currency: string;
  customerId: string;
  cardId?: string | null;
  paymentAgreementId?: string | null;
  metadata?: Record<string, unknown>;
};

export { normalizeTapStatus } from '@/lib/partners/tap-utils';

function getTapHeaders() {
  const secret = getTapSecretKey();
  return {
    Authorization: `Bearer ${secret}`,
    'Content-Type': 'application/json',
  };
}

export async function createTapCharge(input: TapCreateChargeInput): Promise<TapChargeResponse> {
  const baseUrl = getTapApiBaseUrl();
  const siteUrl = getPublicSiteUrl();
  const sourceId = getTapSourceId();

  const redirectUrl = new URL(input.redirectPath || '/app/billing/result', `${siteUrl}/`).toString();
  const webhookUrl = new URL('/api/tap/webhook', `${siteUrl}/`).toString();

  const payload = {
    amount: Number(input.amount.toFixed(2)),
    currency: input.currency,
    threeDSecure: true,
    save_card: true,
    customer_initiated: true,
    description: `اشتراك ${input.planCode}`,
    metadata: {
      org_id: input.orgId,
      user_id: input.userId,
      plan_id: input.planCode,
      billing_period: input.billingPeriod,
      ...(input.metadata || {}),
    },
    reference: {
      transaction: `MASAR-${Date.now()}`,
      order: input.orgId,
    },
    customer: {
      id: input.customer.id || undefined,
      first_name: input.customer.first_name,
      last_name: input.customer.last_name,
      email: input.customer.email,
      phone: {
        country_code: input.customer.phone?.country_code || '966',
        number: input.customer.phone?.number || '500000000',
      },
    },
    source: {
      id: sourceId,
    },
    post: {
      url: webhookUrl,
    },
    redirect: {
      url: redirectUrl,
    },
  };

  const response = await fetch(`${baseUrl}/charges`, {
    method: 'POST',
    headers: getTapHeaders(),
    body: JSON.stringify(payload),
  });

  const data = (await response.json().catch(() => null)) as TapChargeResponse | null;
  if (!response.ok || !data?.id) {
    const message = (data as any)?.errors?.[0]?.description || (data as any)?.message || 'Tap create charge failed';
    throw new Error(message);
  }

  return data;
}

export async function retrieveTapCharge(chargeId: string): Promise<TapChargeResponse> {
  const baseUrl = getTapApiBaseUrl();

  const response = await fetch(`${baseUrl}/charges/${encodeURIComponent(chargeId)}`, {
    method: 'GET',
    headers: getTapHeaders(),
  });

  const data = (await response.json().catch(() => null)) as TapChargeResponse | null;

  if (!response.ok || !data?.id) {
    const message = (data as any)?.errors?.[0]?.description || (data as any)?.message || 'Tap retrieve charge failed';
    throw new Error(message);
  }

  return data;
}

export function verifyTapWebhookSignature(params: {
  rawBody: string;
  signature: string | null;
}) {
  const providedRaw = (params.signature || '').trim();
  if (!providedRaw) {
    return false;
  }

  const secret = getTapWebhookSecret();
  const expected = createHmac('sha256', secret).update(params.rawBody).digest('hex').toLowerCase();
  const provided = providedRaw.replace(/^sha256=/i, '').trim().toLowerCase();

  if (!provided || provided.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
}

/**
 * Recurring charge scaffolding:
 * - Requires Tap recurring capability and valid `customer_id` + `payment_agreement_id`/`card_id`.
 * - This helper is intentionally isolated to make future scheduler/cron integration straightforward.
 */
export async function createTapRecurringCharge(_input: TapRecurringChargeInput): Promise<TapChargeResponse> {
  // TODO(recurring): implement scheduled recurring charge creation once account capabilities are confirmed.
  // TODO(recurring): wire with cron task and retry policy + dunning workflow.
  throw new Error('Tap recurring charge is not enabled yet for this deployment.');
}
