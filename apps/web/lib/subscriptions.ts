import 'server-only';

import { createSupabaseServerRlsClient } from '@/lib/supabase/server';
import { requireOrgIdForUser, requireOwner } from '@/lib/org';

export type Plan = {
  id: string;
  code: string;
  name_ar: string;
  price_monthly: string | null;
  currency: string;
  features: unknown;
  seat_limit: number | null;
  created_at: string;
};

export type SubscriptionStatus = 'trial' | 'active' | 'past_due' | 'canceled' | 'expired';

export type Subscription = {
  id: string;
  org_id: string;
  plan_code: string;
  status: SubscriptionStatus;
  seats: number;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  provider: string | null;
  provider_customer_id: string | null;
  provider_subscription_id: string | null;
  created_at: string;
};

const SUBSCRIPTION_SELECT =
  'id, org_id, plan_code, status, seats, current_period_start, current_period_end, cancel_at_period_end, provider, provider_customer_id, provider_subscription_id, created_at';

const DEFAULT_PLAN_CODE = 'SOLO';

export async function listPlans(): Promise<Plan[]> {
  const supabase = createSupabaseServerRlsClient();

  const { data, error } = await supabase
    .from('plans')
    .select('id, code, name_ar, price_monthly, currency, features, seat_limit, created_at')
    .order('created_at', { ascending: true });

  if (error) {
    throw error;
  }

  return (data as Plan[] | null) ?? [];
}

export async function getOrgSubscription(): Promise<Subscription | null> {
  const orgId = await requireOrgIdForUser();
  const supabase = createSupabaseServerRlsClient();

  const { data, error } = await supabase
    .from('subscriptions')
    .select(SUBSCRIPTION_SELECT)
    .eq('org_id', orgId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as Subscription | null) ?? null;
}

export async function ensureSubscriptionRowExists(): Promise<Subscription> {
  const { orgId } = await requireOwner();
  const supabase = createSupabaseServerRlsClient();

  const { data: existing, error: existingError } = await supabase
    .from('subscriptions')
    .select(SUBSCRIPTION_SELECT)
    .eq('org_id', orgId)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existing) {
    return existing as Subscription;
  }

  const { data, error } = await supabase
    .from('subscriptions')
    .insert({
      org_id: orgId,
      plan_code: DEFAULT_PLAN_CODE,
      status: 'trial',
      seats: 1,
    })
    .select(SUBSCRIPTION_SELECT)
    .single();

  if (error || !data) {
    console.error('Subscription creation failed:', error);
    // Common case: migrations not applied or missing default plan.
    throw new Error(`تعذر إنشاء سجل الاشتراك. تفاصيل الخطأ: ${error?.message || 'غير معروف'} (Phase 8.0)`);
  }

  return data as Subscription;
}

