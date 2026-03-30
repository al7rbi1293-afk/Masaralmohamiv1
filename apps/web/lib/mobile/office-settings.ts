import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { getDefaultSeatLimit, isTrialSubscriptionStatus, normalizePlanCode } from '@/lib/billing/plans';
import { sendAdminBankTransferRequestAlert } from '@/lib/subscription-admin-alert-email';
import { getPricingPlanCardByCode, SUBSCRIPTION_PRICING_CARDS } from '@/lib/subscription-pricing';
import type { MobileAppSessionContext } from '@/lib/mobile/auth';

type OfficeSettingsRow = {
  id: string;
  name: string;
  logo_url: string | null;
  tax_number: string | null;
  cr_number: string | null;
  address: string | null;
};

type SubscriptionRow = {
  id: string;
  org_id: string;
  plan_code: string;
  status: string;
  seats: number | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
  provider: string | null;
  provider_customer_id: string | null;
  provider_subscription_id: string | null;
  created_at: string;
};

type PaymentRequestRow = {
  id: string;
  org_id: string;
  user_id: string | null;
  amount: number | null;
  currency: string | null;
  plan_code: string;
  billing_period: 'monthly' | 'yearly' | string;
  method: string | null;
  status: string;
  proof_url: string | null;
  bank_reference: string | null;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  review_note: string | null;
};

type SubscriptionRequestRow = {
  id: string;
  org_id: string;
  requester_user_id: string | null;
  plan_requested: string;
  duration_months: number | null;
  payment_method: string | null;
  payment_reference: string | null;
  proof_file_path: string | null;
  status: string;
  notes: string | null;
  requested_at: string;
  decided_at: string | null;
  decided_by: string | null;
};

export type MobileOfficeSettings = {
  id: string;
  name: string;
  logo_url: string | null;
  tax_number: string | null;
  cr_number: string | null;
  address: string | null;
};

export type MobileOfficeSubscriptionRequest = {
  id: string;
  kind: 'payment_request' | 'subscription_request';
  org_id: string;
  status: string;
  plan_code: string;
  billing_period: 'monthly' | 'yearly' | null;
  amount: number | null;
  currency: string | null;
  bank_reference: string | null;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  review_note: string | null;
  duration_months: number | null;
  payment_method: string | null;
  payment_reference: string | null;
};

export type MobileOfficeSubscriptionOverview = {
  subscription: SubscriptionRow | null;
  current_plan_card: ReturnType<typeof getPricingPlanCardByCode>;
  pricing_cards: typeof SUBSCRIPTION_PRICING_CARDS;
  seat_usage: {
    used: number;
    limit: number;
    available: number;
  };
  payment_requests: MobileOfficeSubscriptionRequest[];
  latest_payment_request: MobileOfficeSubscriptionRequest | null;
  subscription_requests: MobileOfficeSubscriptionRequest[];
  recent_requests: MobileOfficeSubscriptionRequest[];
  has_active_access: boolean;
};

const OFFICE_SUBSCRIPTION_SELECT =
  'id, org_id, plan_code, status, seats, current_period_start, current_period_end, cancel_at_period_end, provider, provider_customer_id, provider_subscription_id, created_at';

function isUserIdForeignKeyError(message?: string) {
  const normalized = String(message ?? '').toLowerCase();
  return normalized.includes('payment_requests_user_id_fkey') || (normalized.includes('foreign key') && normalized.includes('user_id'));
}

function isMissingRelationError(message?: string) {
  const normalized = String(message ?? '').toLowerCase();
  return normalized.includes('could not find the table') || (normalized.includes('relation') && normalized.includes('does not exist'));
}

function isPlanCodeForeignKeyError(message?: string) {
  const normalized = String(message ?? '').toLowerCase();
  return normalized.includes('foreign key') || normalized.includes('violates foreign key');
}

function isValidDate(value: string | null | undefined) {
  if (!value) return false;
  return !Number.isNaN(new Date(value).getTime());
}

function normalizeOfficeSubscription(subscription: SubscriptionRow): SubscriptionRow {
  if (!isTrialSubscriptionStatus(subscription.status)) {
    return subscription;
  }

  return {
    ...subscription,
    plan_code: 'TRIAL',
    seats: getDefaultSeatLimit('TRIAL'),
  };
}

function toMobileRequest(row: PaymentRequestRow): MobileOfficeSubscriptionRequest {
  return {
    id: row.id,
    kind: 'payment_request',
    org_id: row.org_id,
    status: row.status,
    plan_code: row.plan_code,
    billing_period: row.billing_period === 'yearly' ? 'yearly' : 'monthly',
    amount: row.amount ?? null,
    currency: row.currency ?? null,
    bank_reference: row.bank_reference ?? null,
    created_at: row.created_at,
    reviewed_at: row.reviewed_at,
    reviewed_by: row.reviewed_by,
    review_note: row.review_note,
    duration_months: null,
    payment_method: row.method,
    payment_reference: row.bank_reference,
  };
}

function toMobileSubscriptionRequest(row: SubscriptionRequestRow): MobileOfficeSubscriptionRequest {
  return {
    id: row.id,
    kind: 'subscription_request',
    org_id: row.org_id,
    status: row.status,
    plan_code: row.plan_requested,
    billing_period: null,
    amount: null,
    currency: null,
    bank_reference: row.payment_reference ?? null,
    created_at: row.requested_at,
    reviewed_at: row.decided_at,
    reviewed_by: row.decided_by,
    review_note: row.notes,
    duration_months: row.duration_months ?? null,
    payment_method: row.payment_method,
    payment_reference: row.payment_reference,
  };
}

async function loadOfficeSettingsRow(db: SupabaseClient, orgId: string) {
  const { data, error } = await db
    .from('organizations')
    .select('id, name, logo_url, tax_number, cr_number, address')
    .eq('id', orgId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as OfficeSettingsRow | null) ?? null;
}

async function loadOrCreateSubscription(db: SupabaseClient, orgId: string) {
  const { data: existing, error: existingError } = await db
    .from('subscriptions')
    .select(OFFICE_SUBSCRIPTION_SELECT)
    .eq('org_id', orgId)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existing) {
    return normalizeOfficeSubscription(existing as SubscriptionRow);
  }

  let { data, error } = await db
    .from('subscriptions')
    .insert({
      org_id: orgId,
      plan_code: 'TRIAL',
      status: 'trial',
      seats: getDefaultSeatLimit('TRIAL'),
    })
    .select(OFFICE_SUBSCRIPTION_SELECT)
    .single();

  if (error && isPlanCodeForeignKeyError(error.message)) {
    ({ data, error } = await db
      .from('subscriptions')
      .insert({
        org_id: orgId,
        plan_code: 'SOLO',
        status: 'trial',
        seats: 1,
      })
      .select(OFFICE_SUBSCRIPTION_SELECT)
      .single());
  }

  if (error) {
    throw error;
  }

  return normalizeOfficeSubscription(data as SubscriptionRow);
}

async function countOrgMembers(db: SupabaseClient, orgId: string) {
  const { count, error } = await db
    .from('memberships')
    .select('user_id', { count: 'exact', head: true })
    .eq('org_id', orgId);

  if (error) {
    throw error;
  }

  return count ?? 0;
}

async function loadRecentRequests(db: SupabaseClient, orgId: string) {
  const [paymentResult, subscriptionResult] = await Promise.all([
    db
      .from('payment_requests')
      .select(
        'id, org_id, user_id, amount, currency, plan_code, billing_period, method, status, proof_url, bank_reference, created_at, reviewed_at, reviewed_by, review_note',
      )
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(10),
    db
      .from('subscription_requests')
      .select(
        'id, org_id, requester_user_id, plan_requested, duration_months, payment_method, payment_reference, proof_file_path, status, notes, requested_at, decided_at, decided_by',
      )
      .eq('org_id', orgId)
      .order('requested_at', { ascending: false })
      .limit(10),
  ]);

  if (paymentResult.error && !isMissingRelationError(paymentResult.error.message)) {
    throw paymentResult.error;
  }

  if (subscriptionResult.error && !isMissingRelationError(subscriptionResult.error.message)) {
    throw subscriptionResult.error;
  }

  const paymentRequests = ((paymentResult.data as PaymentRequestRow[] | null) ?? []).map(toMobileRequest);
  const subscriptionRequests = ((subscriptionResult.data as SubscriptionRequestRow[] | null) ?? []).map(
    toMobileSubscriptionRequest,
  );

  const recentRequests = [...paymentRequests, ...subscriptionRequests].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  return { paymentRequests, subscriptionRequests, recentRequests };
}

export async function getMobileOfficeSettings(context: MobileAppSessionContext): Promise<MobileOfficeSettings> {
  const orgId = context.org?.id;
  if (!orgId) {
    throw new Error('missing_org');
  }

  const settings = await loadOfficeSettingsRow(context.db, orgId);
  if (!settings) {
    throw new Error('office_settings_not_found');
  }

  return settings;
}

export async function updateMobileOfficeSettings(
  context: MobileAppSessionContext,
  params: {
    name: string;
    tax_number?: string | null;
    cr_number?: string | null;
    address?: string | null;
    logo_url?: string | null;
    logo_file?: File | null;
  },
) {
  const orgId = context.org?.id;
  if (!orgId) {
    throw new Error('missing_org');
  }

  const updateData: Record<string, string | null> = {
    name: params.name.trim(),
    tax_number: params.tax_number?.trim() || null,
    cr_number: params.cr_number?.trim() || null,
    address: params.address?.trim() || null,
  };

  if (params.logo_file && params.logo_file.size > 0) {
    if (params.logo_file.size > 5 * 1024 * 1024) {
      throw new Error('يجب ألا يتجاوز حجم الشعار 5 ميجابايت.');
    }

    const ext = params.logo_file.name.split('.').pop()?.trim() || 'png';
    const safeExt = ext.replace(/[^a-z0-9]/gi, '').toLowerCase() || 'png';
    const filePath = `office-logos/${orgId}-${Date.now()}.${safeExt}`;
    const { error: uploadError } = await context.db.storage.from('public_assets').upload(filePath, params.logo_file, {
      upsert: true,
    });

    if (uploadError) {
      throw new Error('تعذر رفع الشعار.');
    }

    const { data } = context.db.storage.from('public_assets').getPublicUrl(filePath);
    updateData.logo_url = data.publicUrl;
  } else if (typeof params.logo_url === 'string') {
    const trimmedLogoUrl = params.logo_url.trim();
    if (trimmedLogoUrl) {
      updateData.logo_url = trimmedLogoUrl;
    }
  }

  const { error } = await context.db.from('organizations').update(updateData).eq('id', orgId);
  if (error) {
    throw error;
  }

  const updated = await loadOfficeSettingsRow(context.db, orgId);
  if (!updated) {
    throw new Error('office_settings_not_found');
  }

  return updated;
}

export async function getMobileOfficeSubscriptionOverview(
  context: MobileAppSessionContext,
): Promise<MobileOfficeSubscriptionOverview> {
  const orgId = context.org?.id;
  if (!orgId) {
    throw new Error('missing_org');
  }

  const [subscription, memberCount, requests] = await Promise.all([
    loadOrCreateSubscription(context.db, orgId),
    countOrgMembers(context.db, orgId),
    loadRecentRequests(context.db, orgId),
  ]);

  const limit = Math.max(1, Number(subscription.seats ?? 0) || getDefaultSeatLimit(subscription.plan_code));
  const used = Math.max(0, memberCount);

  return {
    subscription,
    current_plan_card: getPricingPlanCardByCode(subscription.plan_code),
    pricing_cards: SUBSCRIPTION_PRICING_CARDS,
    seat_usage: {
      used,
      limit,
      available: Math.max(limit - used, 0),
    },
    payment_requests: requests.paymentRequests,
    latest_payment_request: requests.paymentRequests[0] ?? null,
    subscription_requests: requests.subscriptionRequests,
    recent_requests: requests.recentRequests,
    has_active_access:
      ['active', 'past_due', 'canceled'].includes(String(subscription.status ?? '').trim().toLowerCase()) &&
      (!isValidDate(subscription.current_period_end) || new Date(subscription.current_period_end as string).getTime() > Date.now()),
  };
}

export async function createMobileBankTransferRequest(
  context: MobileAppSessionContext,
  params: {
    plan_code: string;
    billing_period: 'monthly' | 'yearly';
    amount: number;
    bank_reference: string;
  },
) {
  const orgId = context.org?.id;
  if (!orgId) {
    throw new Error('missing_org');
  }

  const normalizedPlanCode = normalizePlanCode(params.plan_code, 'TRIAL');
  if (normalizedPlanCode === 'TRIAL') {
    throw new Error('Invalid plan code');
  }

  const payload = {
    org_id: orgId,
    user_id: context.user.id,
    amount: params.amount,
    currency: 'SAR',
    plan_code: normalizedPlanCode,
    billing_period: params.billing_period,
    method: 'bank_transfer',
    status: 'pending',
    proof_url: null,
    bank_reference: params.bank_reference,
  };

  let { data, error } = await context.db.from('payment_requests').insert(payload).select().single();
  if (error && isUserIdForeignKeyError(error.message)) {
    ({ data, error } = await context.db
      .from('payment_requests')
      .insert({
        ...payload,
        user_id: null,
      })
      .select()
      .single());
  }

  if (error) {
    throw error;
  }

  const paymentRequest = data as PaymentRequestRow;

  try {
    await sendAdminBankTransferRequestAlert({
      paymentRequestId: paymentRequest.id,
      orgId,
      requestedByUserId: context.user.id,
      planCode: normalizedPlanCode,
      billingPeriod: params.billing_period,
      amount: params.amount,
      currency: paymentRequest.currency,
      bankReference: params.bank_reference,
      createdAt: paymentRequest.created_at,
    });
  } catch {
    // Non-blocking notification, consistent with the existing web behavior.
  }

  return paymentRequest;
}
