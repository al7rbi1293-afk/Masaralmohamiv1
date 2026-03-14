import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type RequestKind = 'subscription_request' | 'payment_request';

type SubscriptionRequestRow = {
  id: string;
  org_id: string;
  requester_user_id: string | null;
  plan_requested: string;
  duration_months: number;
  payment_method: string | null;
  payment_reference: string | null;
  proof_file_path: string | null;
  status: string;
  notes: string | null;
  requested_at: string;
  decided_at: string | null;
  decided_by: string | null;
};

type PaymentRequestRow = {
  id: string;
  org_id: string;
  user_id: string | null;
  plan_code: string;
  billing_period: string;
  method: string | null;
  bank_reference: string | null;
  proof_url: string | null;
  status: string;
  review_note: string | null;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  amount: number | null;
  currency: string | null;
};

type UnifiedSubscriptionRequest = {
  id: string;
  org_id: string;
  requester_user_id: string | null;
  plan_requested: string;
  duration_months: number;
  payment_method: string | null;
  payment_reference: string | null;
  proof_file_path: string | null;
  status: string;
  notes: string | null;
  requested_at: string;
  decided_at: string | null;
  decided_by: string | null;
  organizations: { id: string; name: string } | null;
  requester_name: string | null;
  request_kind: RequestKind;
  amount: number | null;
  currency: string | null;
};

type FullVersionRequestRow = {
  id: string;
  created_at: string;
  org_id: string | null;
  user_id: string | null;
  full_name: string | null;
  email: string;
  phone: string | null;
  firm_name: string | null;
  message: string | null;
  source: string;
  type: string | null;
};

type LeadRow = {
  id: string;
  created_at: string;
  full_name: string;
  email: string;
  phone: string | null;
  firm_name: string | null;
  topic: string | null;
  message: string | null;
  referrer: string | null;
  utm: unknown;
};

function isMissingColumnError(message?: string) {
  const normalized = String(message ?? '').toLowerCase();
  return (
    (normalized.includes('column') && normalized.includes('does not exist')) ||
    (normalized.includes('could not find') && normalized.includes('column'))
  );
}

function isMissingRelationError(message?: string) {
  const normalized = String(message ?? '').toLowerCase();
  return (
    normalized.includes('could not find the table') ||
    (normalized.includes('relation') && normalized.includes('does not exist'))
  );
}

function normalizePlanCode(rawPlan: string) {
  const normalized = String(rawPlan ?? '').trim().toUpperCase();
  if (!normalized) return 'SOLO';

  if (normalized === 'TEAM' || normalized === 'SMALL_OFFICE') return 'SMALL_OFFICE';
  if (normalized === 'BUSINESS' || normalized === 'MEDIUM' || normalized === 'MEDIUM_OFFICE') {
    return 'MEDIUM_OFFICE';
  }
  if (normalized === 'PRO') return 'ENTERPRISE';
  return normalized;
}

function toOrgSubscriptionPlan(planCode: string) {
  if (planCode === 'SMALL_OFFICE') return 'TEAM';
  if (planCode === 'MEDIUM_OFFICE') return 'BUSINESS';
  return planCode;
}

function seatsForPlan(planCode: string) {
  if (planCode === 'SOLO') return 1;
  if (planCode === 'SMALL_OFFICE') return 5;
  if (planCode === 'MEDIUM_OFFICE') return 25;
  if (planCode === 'ENTERPRISE') return 999;
  return 1;
}

function monthsFromBillingPeriod(period: string | null | undefined) {
  return String(period ?? '').toLowerCase() === 'yearly' ? 12 : 1;
}

async function activatePaidSubscription(params: {
  adminClient: ReturnType<typeof createSupabaseServerClient>;
  orgId: string;
  planRequested: string;
  durationMonths: number;
  paymentReference: string | null;
  source: RequestKind;
  sourceRequestId: string;
  adminId: string;
}) {
  const planCode = normalizePlanCode(params.planRequested);
  const orgPlan = toOrgSubscriptionPlan(planCode);
  const seats = seatsForPlan(planCode);

  const periodStart = new Date();
  const periodEnd = new Date(periodStart);
  periodEnd.setMonth(periodEnd.getMonth() + Math.max(1, params.durationMonths));

  const { error: subscriptionsError } = await params.adminClient
    .from('subscriptions')
    .upsert(
      {
        org_id: params.orgId,
        plan_code: planCode,
        status: 'active',
        seats,
        current_period_start: periodStart.toISOString(),
        current_period_end: periodEnd.toISOString(),
        provider: 'manual',
      },
      { onConflict: 'org_id' },
    );

  if (subscriptionsError) {
    throw subscriptionsError;
  }

  const { error: orgSubscriptionsError } = await params.adminClient
    .from('org_subscriptions')
    .upsert(
      {
        org_id: params.orgId,
        status: 'active',
        plan: orgPlan,
        payment_status: 'paid',
        current_period_start: periodStart.toISOString(),
        current_period_end: periodEnd.toISOString(),
        last_payment_ref: params.paymentReference,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'org_id' },
    );

  if (orgSubscriptionsError && !isMissingRelationError(orgSubscriptionsError.message)) {
    throw orgSubscriptionsError;
  }

  const { error: eventError } = await params.adminClient.from('subscription_events').insert({
    org_id: params.orgId,
    type: 'manual_subscription_approved',
    meta: {
      source: params.source,
      source_request_id: params.sourceRequestId,
      plan_code: planCode,
      duration_months: Math.max(1, params.durationMonths),
      approved_by: params.adminId,
    },
  });

  if (eventError && !isMissingRelationError(eventError.message)) {
    console.error('subscription_events_insert_failed', eventError.message);
  }

  return {
    planCode,
    durationMonths: Math.max(1, params.durationMonths),
    periodStartIso: periodStart.toISOString(),
    periodEndIso: periodEnd.toISOString(),
  };
}

export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: 'غير مصرح.' }, { status: 403 });
  }

  const adminClient = createSupabaseServerClient();

  let subscriptionRows: SubscriptionRequestRow[] = [];
  const { data: subscriptionRequestsRaw, error: subscriptionError } = await adminClient
    .from('subscription_requests')
    .select(
      'id, org_id, requester_user_id, plan_requested, duration_months, payment_method, payment_reference, proof_file_path, status, notes, requested_at, decided_at, decided_by',
    )
    .order('requested_at', { ascending: false })
    .limit(200);

  if (subscriptionError) {
    if (!isMissingRelationError(subscriptionError.message)) {
      return NextResponse.json({ error: subscriptionError.message }, { status: 500 });
    }
  } else {
    subscriptionRows = (subscriptionRequestsRaw as SubscriptionRequestRow[] | null) ?? [];
  }

  let paymentRows: PaymentRequestRow[] = [];
  const { data: paymentRequestsRaw, error: paymentError } = await adminClient
    .from('payment_requests')
    .select(
      'id, org_id, user_id, plan_code, billing_period, method, bank_reference, proof_url, status, review_note, created_at, reviewed_at, reviewed_by, amount, currency',
    )
    .order('created_at', { ascending: false })
    .limit(200);

  if (paymentError) {
    if (!isMissingRelationError(paymentError.message)) {
      return NextResponse.json({ error: paymentError.message }, { status: 500 });
    }
  } else {
    paymentRows = (paymentRequestsRaw as PaymentRequestRow[] | null) ?? [];
  }

  const requesterUserIds = Array.from(
    new Set([
      ...subscriptionRows
        .map((row) => row.requester_user_id)
        .filter((value): value is string => Boolean(value)),
      ...paymentRows.map((row) => row.user_id).filter((value): value is string => Boolean(value)),
    ]),
  );

  const orgIds = Array.from(
    new Set([
      ...subscriptionRows.map((row) => row.org_id),
      ...paymentRows.map((row) => row.org_id),
    ].filter((value): value is string => Boolean(value))),
  );

  const requesterNamesByUserId = new Map<string, string>();
  const orgNamesByOrgId = new Map<string, { id: string; name: string }>();

  if (requesterUserIds.length || orgIds.length) {
    const [
      { data: appUsersRaw, error: appUsersError },
      { data: profilesRaw, error: profilesError },
      { data: organizationsRaw, error: organizationsError },
    ] = await Promise.all([
      requesterUserIds.length
        ? adminClient.from('app_users').select('id, full_name, email').in('id', requesterUserIds)
        : Promise.resolve({ data: [], error: null } as any),
      requesterUserIds.length
        ? adminClient.from('profiles').select('user_id, full_name').in('user_id', requesterUserIds)
        : Promise.resolve({ data: [], error: null } as any),
      orgIds.length
        ? adminClient.from('organizations').select('id, name').in('id', orgIds)
        : Promise.resolve({ data: [], error: null } as any),
    ]);

    if (appUsersError && !isMissingRelationError(appUsersError.message)) {
      return NextResponse.json({ error: appUsersError.message }, { status: 500 });
    }

    if (profilesError && !isMissingRelationError(profilesError.message)) {
      return NextResponse.json({ error: profilesError.message }, { status: 500 });
    }

    if (organizationsError) {
      return NextResponse.json({ error: organizationsError.message }, { status: 500 });
    }

    for (const user of (appUsersRaw as Array<{ id: string; full_name: string | null; email: string | null }> | null) ?? []) {
      requesterNamesByUserId.set(user.id, user.full_name?.trim() || user.email?.trim() || user.id);
    }

    for (const profile of (profilesRaw as Array<{ user_id: string; full_name: string | null }> | null) ?? []) {
      if (!requesterNamesByUserId.has(profile.user_id)) {
        requesterNamesByUserId.set(profile.user_id, profile.full_name?.trim() || profile.user_id);
      }
    }

    for (const org of (organizationsRaw as Array<{ id: string; name: string }> | null) ?? []) {
      orgNamesByOrgId.set(org.id, { id: org.id, name: org.name });
    }
  }

  const unifiedRequests: UnifiedSubscriptionRequest[] = [
    ...subscriptionRows.map((row) => ({
      ...row,
      organizations: orgNamesByOrgId.get(row.org_id) ?? null,
      requester_name: row.requester_user_id ? requesterNamesByUserId.get(row.requester_user_id) ?? null : null,
      request_kind: 'subscription_request' as const,
      amount: null,
      currency: null,
    })),
    ...paymentRows.map((row) => ({
      id: row.id,
      org_id: row.org_id,
      requester_user_id: row.user_id,
      plan_requested: row.plan_code,
      duration_months: monthsFromBillingPeriod(row.billing_period),
      payment_method: row.method,
      payment_reference: row.bank_reference,
      proof_file_path: row.proof_url,
      status: row.status,
      notes: row.review_note,
      requested_at: row.created_at,
      decided_at: row.reviewed_at,
      decided_by: row.reviewed_by,
      organizations: orgNamesByOrgId.get(row.org_id) ?? null,
      requester_name: row.user_id ? requesterNamesByUserId.get(row.user_id) ?? null : null,
      request_kind: 'payment_request' as const,
      amount: row.amount,
      currency: row.currency,
    })),
  ].sort((a, b) => new Date(b.requested_at).getTime() - new Date(a.requested_at).getTime());

  let fullVersionRequests: FullVersionRequestRow[] = [];
  const { data: fullVersionRequestsWithType, error: fullVersionError } = await adminClient
    .from('full_version_requests')
    .select('id, created_at, org_id, user_id, full_name, email, phone, firm_name, message, source, type')
    .order('created_at', { ascending: false })
    .limit(200);

  if (fullVersionError) {
    if (isMissingColumnError(fullVersionError.message)) {
      const { data: fullVersionRequestsWithoutType, error: retryError } = await adminClient
        .from('full_version_requests')
        .select('id, created_at, org_id, user_id, full_name, email, phone, firm_name, message, source')
        .order('created_at', { ascending: false })
        .limit(200);

      if (retryError) {
        return NextResponse.json({ error: retryError.message }, { status: 500 });
      }

      fullVersionRequests = ((fullVersionRequestsWithoutType as Omit<FullVersionRequestRow, 'type'>[] | null) ?? []).map((row) => ({
        ...row,
        type: null,
      }));
    } else if (!isMissingRelationError(fullVersionError.message)) {
      return NextResponse.json({ error: fullVersionError.message }, { status: 500 });
    }
  } else {
    fullVersionRequests = (fullVersionRequestsWithType as FullVersionRequestRow[] | null) ?? [];
  }

  let leads: LeadRow[] = [];
  const { data: leadsRaw, error: leadsError } = await adminClient
    .from('leads')
    .select('id, created_at, full_name, email, phone, firm_name, topic, message, referrer, utm')
    .order('created_at', { ascending: false })
    .limit(200);

  if (leadsError) {
    if (!isMissingRelationError(leadsError.message)) {
      return NextResponse.json({ error: leadsError.message }, { status: 500 });
    }
  } else {
    leads = (leadsRaw as LeadRow[] | null) ?? [];
  }

  return NextResponse.json({
    requests: unifiedRequests,
    fullVersionRequests,
    leads,
  });
}

export async function PATCH(request: NextRequest) {
  let adminId: string;
  try {
    adminId = await requireAdmin();
  } catch {
    return NextResponse.json({ error: 'غير مصرح.' }, { status: 403 });
  }

  const body = await request.json();
  const { id, action, notes, request_kind } = body as {
    id: string;
    action: 'approve' | 'reject';
    notes?: string;
    request_kind?: RequestKind;
  };

  if (!id || !['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'بيانات غير صالحة.' }, { status: 400 });
  }

  const adminClient = createSupabaseServerClient();
  const nowIso = new Date().toISOString();

  let resolvedKind: RequestKind | null = request_kind ?? null;
  let subscriptionRequest: SubscriptionRequestRow | null = null;
  let paymentRequest: PaymentRequestRow | null = null;

  if (resolvedKind !== 'payment_request') {
    const { data, error } = await adminClient
      .from('subscription_requests')
      .select(
        'id, org_id, requester_user_id, plan_requested, duration_months, payment_method, payment_reference, proof_file_path, status, notes, requested_at, decided_at, decided_by',
      )
      .eq('id', id)
      .maybeSingle();

    if (error && !isMissingRelationError(error.message)) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (data) {
      subscriptionRequest = data as SubscriptionRequestRow;
      resolvedKind = 'subscription_request';
    }
  }

  if (!subscriptionRequest && resolvedKind !== 'subscription_request') {
    const { data, error } = await adminClient
      .from('payment_requests')
      .select(
        'id, org_id, user_id, plan_code, billing_period, method, bank_reference, proof_url, status, review_note, created_at, reviewed_at, reviewed_by, amount, currency',
      )
      .eq('id', id)
      .maybeSingle();

    if (error && !isMissingRelationError(error.message)) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (data) {
      paymentRequest = data as PaymentRequestRow;
      resolvedKind = 'payment_request';
    }
  }

  if (!subscriptionRequest && !paymentRequest) {
    return NextResponse.json({ error: 'الطلب غير موجود.' }, { status: 404 });
  }

  if (resolvedKind === 'subscription_request' && subscriptionRequest) {
    const { error: updateError } = await adminClient
      .from('subscription_requests')
      .update({
        status: action === 'approve' ? 'approved' : 'rejected',
        decided_at: nowIso,
        decided_by: adminId,
        notes: notes || null,
      })
      .eq('id', subscriptionRequest.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    if (action === 'approve') {
      const activation = await activatePaidSubscription({
        adminClient,
        orgId: subscriptionRequest.org_id,
        planRequested: subscriptionRequest.plan_requested,
        durationMonths: Math.max(1, subscriptionRequest.duration_months || 1),
        paymentReference: subscriptionRequest.payment_reference,
        source: 'subscription_request',
        sourceRequestId: subscriptionRequest.id,
        adminId,
      });

      await adminClient.from('audit_logs').insert({
        org_id: subscriptionRequest.org_id,
        user_id: adminId,
        action: 'subscription_approved',
        entity_type: 'subscription_request',
        entity_id: subscriptionRequest.id,
        meta: {
          request_kind: 'subscription_request',
          plan_code: activation.planCode,
          duration_months: activation.durationMonths,
          period_end: activation.periodEndIso,
        },
      });
    } else {
      await adminClient.from('audit_logs').insert({
        org_id: subscriptionRequest.org_id,
        user_id: adminId,
        action: 'subscription_rejected',
        entity_type: 'subscription_request',
        entity_id: subscriptionRequest.id,
        meta: {
          request_kind: 'subscription_request',
          notes: notes || '',
        },
      });
    }

    return NextResponse.json({ success: true, request_kind: 'subscription_request' });
  }

  if (resolvedKind === 'payment_request' && paymentRequest) {
    const { error: updateError } = await adminClient
      .from('payment_requests')
      .update({
        status: action === 'approve' ? 'approved' : 'rejected',
        reviewed_at: nowIso,
        reviewed_by: adminId,
        review_note: notes || null,
      })
      .eq('id', paymentRequest.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    if (action === 'approve') {
      const activation = await activatePaidSubscription({
        adminClient,
        orgId: paymentRequest.org_id,
        planRequested: paymentRequest.plan_code,
        durationMonths: monthsFromBillingPeriod(paymentRequest.billing_period),
        paymentReference: paymentRequest.bank_reference,
        source: 'payment_request',
        sourceRequestId: paymentRequest.id,
        adminId,
      });

      await adminClient.from('audit_logs').insert({
        org_id: paymentRequest.org_id,
        user_id: adminId,
        action: 'subscription_approved',
        entity_type: 'payment_request',
        entity_id: paymentRequest.id,
        meta: {
          request_kind: 'payment_request',
          amount: paymentRequest.amount,
          currency: paymentRequest.currency,
          plan_code: activation.planCode,
          duration_months: activation.durationMonths,
          period_end: activation.periodEndIso,
        },
      });
    } else {
      await adminClient.from('audit_logs').insert({
        org_id: paymentRequest.org_id,
        user_id: adminId,
        action: 'subscription_rejected',
        entity_type: 'payment_request',
        entity_id: paymentRequest.id,
        meta: {
          request_kind: 'payment_request',
          notes: notes || '',
        },
      });
    }

    return NextResponse.json({ success: true, request_kind: 'payment_request' });
  }

  return NextResponse.json({ error: 'تعذر تنفيذ العملية.' }, { status: 500 });
}
