import { NextRequest, NextResponse } from 'next/server';
import { getDefaultSeatLimit, normalizePlanCode } from '@/lib/billing/plans';
import { requireAdmin } from '@/lib/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type AdminOrgAction =
  | 'suspend'
  | 'activate'
  | 'delete'
  | 'extend_trial'
  | 'activate_subscription'
  | 'grant_lifetime'
  | 'activate_paid'
  | 'set_plan';

type OrgMembershipRow = {
  org_id: string;
  user_id: string;
};

/**
 * GET /admin/api/orgs — list all orgs with plan/status/member count
 * PATCH /admin/api/orgs — manage org state, trials, and subscriptions
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: 'غير مصرح.' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get('query')?.trim() || '';
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
  const offset = (page - 1) * limit;

  const adminClient = createSupabaseServerClient();

  let dbQuery = adminClient
    .from('organizations')
    .select(
      `
      id, name, status, created_at,
      memberships (
        id,
        role,
        user_id,
        app_users ( id, email, full_name, status, email_verified )
      ),
      org_subscriptions ( plan, status, payment_status, current_period_end ),
      trial_subscriptions ( ends_at, status )
    `,
      { count: 'exact' },
    );

  if (query) {
    dbQuery = dbQuery.ilike('name', `%${query}%`);
  }

  const { data: orgs, error, count } = await dbQuery
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const membershipUserIds = Array.from(
    new Set(
      (orgs ?? [])
        .flatMap((org: any) => (Array.isArray(org.memberships) ? org.memberships : []))
        .map((membership: any) => String(membership.user_id || '').trim())
        .filter(Boolean),
    ),
  );

  const adminUserIds = new Set<string>();
  if (membershipUserIds.length > 0) {
    const { data: appAdmins, error: appAdminsError } = await adminClient
      .from('app_admins')
      .select('user_id')
      .in('user_id', membershipUserIds);

    if (appAdminsError) {
      return NextResponse.json({ error: appAdminsError.message }, { status: 500 });
    }

    for (const row of (appAdmins as Array<{ user_id?: string | null }> | null) ?? []) {
      const userId = String(row.user_id || '').trim();
      if (userId) {
        adminUserIds.add(userId);
      }
    }
  }

  const mapped = (orgs ?? []).map((org: any) => {
    const sub = Array.isArray(org.org_subscriptions) ? org.org_subscriptions[0] : org.org_subscriptions;
    const trial = Array.isArray(org.trial_subscriptions) ? org.trial_subscriptions[0] : org.trial_subscriptions;
    const memberships = Array.isArray(org.memberships) ? org.memberships : [];
    const linkedAccounts = memberships
      .map((membership: any) => {
        const user = Array.isArray(membership.app_users) ? membership.app_users[0] : membership.app_users;
        if (!user) return null;

        return {
          membership_id: membership.id,
          role: membership.role ?? null,
          user_id: membership.user_id ?? user.id,
          email: user.email ?? null,
          full_name: user.full_name ?? null,
          status: user.status ?? null,
          email_verified: typeof user.email_verified === 'boolean' ? user.email_verified : null,
          is_app_admin: adminUserIds.has(String(membership.user_id ?? user.id ?? '').trim()),
        };
      })
      .filter(Boolean);

    const primaryAccount = linkedAccounts.find((account: any) => account.role === 'owner') ?? linkedAccounts[0] ?? null;
    const hasAdminAccount = linkedAccounts.some((account: any) => Boolean(account.is_app_admin));

    return {
      id: org.id,
      name: org.name,
      status: org.status,
      created_at: org.created_at,
      members_count: memberships.length,
      subscription: sub ?? null,
      trial: trial ?? null,
      linked_accounts: linkedAccounts,
      primary_account: primaryAccount,
      has_admin_account: hasAdminAccount,
    };
  });

  return NextResponse.json({
    orgs: mapped,
    total_count: count ?? 0,
    page,
    limit,
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
  const { org_id, org_ids, action, extra_data } = body as {
    org_id?: string;
    org_ids?: string[];
    action: AdminOrgAction;
    extra_data?: Record<string, unknown>;
  };

  const targetIds = Array.isArray(org_ids)
    ? org_ids.map((value) => String(value || '').trim()).filter(Boolean)
    : org_id
      ? [String(org_id).trim()]
      : [];

  if (targetIds.length === 0 || !action) {
    return NextResponse.json({ error: 'بيانات غير صالحة.' }, { status: 400 });
  }

  const adminClient = createSupabaseServerClient();

  if (action === 'suspend' || action === 'activate') {
    const newStatus = action === 'suspend' ? 'suspended' : 'active';

    const { error: orgError } = await adminClient
      .from('organizations')
      .update({ status: newStatus })
      .in('id', targetIds);

    if (orgError) {
      return NextResponse.json({ error: orgError.message }, { status: 500 });
    }

    const auditLogs = targetIds.map((id) => ({
      org_id: id,
      user_id: adminId,
      action: action === 'suspend' ? 'org_suspended' : 'org_activated',
      entity_type: 'organization',
      entity_id: id,
      meta: { bulk: targetIds.length > 1 },
    }));

    await adminClient.from('audit_logs').insert(auditLogs);

    return NextResponse.json({ success: true, status: newStatus, count: targetIds.length });
  }

  if (action === 'delete') {
    const { error: deleteError } = await adminClient
      .from('organizations')
      .delete()
      .in('id', targetIds);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, status: 'deleted', count: targetIds.length });
  }

  if (targetIds.length > 1) {
    return NextResponse.json({ error: 'هذا الإجراء غير مدعوم للمعالجة المجمعة حالياً.' }, { status: 400 });
  }

  const singleOrgId = targetIds[0];
  const adminCapableOrgIds = await resolveAdminLinkedOrgIds(adminClient, [singleOrgId]);
  const allowLifetime = adminCapableOrgIds.has(singleOrgId);

  if (action === 'extend_trial') {
    const days = clampInteger(extra_data?.days, 14, 1, 365);
    const now = new Date();
    const { data: existingTrial, error: existingTrialError } = await adminClient
      .from('trial_subscriptions')
      .select('started_at, ends_at')
      .eq('org_id', singleOrgId)
      .maybeSingle();

    if (existingTrialError) {
      return NextResponse.json({ error: existingTrialError.message }, { status: 500 });
    }

    const existingEndsAt = parseDate((existingTrial as { ends_at?: string | null } | null)?.ends_at ?? null);
    const baseDate = existingEndsAt && existingEndsAt.getTime() > Date.now() ? existingEndsAt : now;
    const nextEndsAt = new Date(baseDate);
    nextEndsAt.setDate(nextEndsAt.getDate() + days);

    const { error: trialError } = await adminClient
      .from('trial_subscriptions')
      .upsert(
        {
          org_id: singleOrgId,
          started_at:
            (existingTrial as { started_at?: string | null } | null)?.started_at ?? now.toISOString(),
          ends_at: nextEndsAt.toISOString(),
          status: 'active',
          updated_at: now.toISOString(),
        },
        { onConflict: 'org_id' },
      );

    if (trialError) {
      return NextResponse.json({ error: trialError.message }, { status: 500 });
    }

    await adminClient.from('organizations').update({ status: 'active' }).eq('id', singleOrgId);

    await adminClient.from('audit_logs').insert({
      org_id: singleOrgId,
      user_id: adminId,
      action: 'trial_extended',
      entity_type: 'trial_subscriptions',
      entity_id: singleOrgId,
      meta: { days, ends_at: nextEndsAt.toISOString() },
    });

    return NextResponse.json({ success: true, ends_at: nextEndsAt.toISOString() });
  }

  if (action === 'grant_lifetime') {
    if (!allowLifetime) {
      return NextResponse.json({ error: 'اشتراك مدى الحياة متاح فقط لحساب الإدارة.' }, { status: 403 });
    }

    const config = buildActivationConfig({
      action,
      extraData: extra_data,
      allowLifetime: true,
    });

    if (!config) {
      return NextResponse.json({ error: 'إعدادات التفعيل غير صحيحة.' }, { status: 400 });
    }

    const result = await upsertSubscriptionState(adminClient, {
      orgId: singleOrgId,
      adminId,
      planCode: config.planCode,
      expiresAt: config.expiresAt,
      auditAction: 'subscription_lifetime_granted',
      auditMeta: {
        lifetime: true,
        plan_code: config.planCode,
      },
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  }

  if (action === 'activate_subscription' || action === 'activate_paid') {
    const config = buildActivationConfig({
      action,
      extraData: extra_data,
      allowLifetime,
    });

    if (!config) {
      return NextResponse.json({ error: 'إعدادات التفعيل غير صحيحة.' }, { status: 400 });
    }

    const result = await upsertSubscriptionState(adminClient, {
      orgId: singleOrgId,
      adminId,
      planCode: config.planCode,
      expiresAt: config.expiresAt,
      auditAction: 'subscription_updated',
      auditMeta: {
        plan_code: config.planCode,
        duration_label: config.durationLabel,
        duration_months: config.durationMonths,
      },
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  }

  if (action === 'set_plan' && extra_data?.plan) {
    const normalizedPlan = normalizePlanCode(extra_data.plan, 'TRIAL');
    if (normalizedPlan === 'TRIAL') {
      return NextResponse.json({ error: 'الخطة غير صحيحة.' }, { status: 400 });
    }

    const { data: existingSub, error: existingSubError } = await adminClient
      .from('org_subscriptions')
      .select('current_period_end')
      .eq('org_id', singleOrgId)
      .maybeSingle();

    if (existingSubError) {
      return NextResponse.json({ error: existingSubError.message }, { status: 500 });
    }

    const existingEndDate = parseDate((existingSub as { current_period_end?: string | null } | null)?.current_period_end ?? null);
    const fallbackEndDate = new Date();
    fallbackEndDate.setFullYear(fallbackEndDate.getFullYear() + 1);

    const result = await upsertSubscriptionState(adminClient, {
      orgId: singleOrgId,
      adminId,
      planCode: normalizedPlan,
      expiresAt: (existingEndDate ?? fallbackEndDate).toISOString(),
      auditAction: 'subscription_plan_changed',
      auditMeta: { plan_code: normalizedPlan },
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'إجراء غير معروف.' }, { status: 400 });
}

async function resolveAdminLinkedOrgIds(
  adminClient: ReturnType<typeof createSupabaseServerClient>,
  orgIds: string[],
) {
  const sanitizedOrgIds = orgIds.map((value) => String(value || '').trim()).filter(Boolean);
  if (!sanitizedOrgIds.length) {
    return new Set<string>();
  }

  const { data: memberships, error: membershipsError } = await adminClient
    .from('memberships')
    .select('org_id, user_id')
    .in('org_id', sanitizedOrgIds);

  if (membershipsError) {
    throw membershipsError;
  }

  const membershipRows = ((memberships as OrgMembershipRow[] | null) ?? []).filter(
    (row) => row.org_id && row.user_id,
  );

  const userIds = Array.from(new Set(membershipRows.map((row) => row.user_id)));
  if (!userIds.length) {
    return new Set<string>();
  }

  const { data: appAdmins, error: appAdminsError } = await adminClient
    .from('app_admins')
    .select('user_id')
    .in('user_id', userIds);

  if (appAdminsError) {
    throw appAdminsError;
  }

  const adminUserIds = new Set(
    ((appAdmins as Array<{ user_id?: string | null }> | null) ?? [])
      .map((row) => String(row.user_id || '').trim())
      .filter(Boolean),
  );

  return new Set(
    membershipRows
      .filter((row) => adminUserIds.has(row.user_id))
      .map((row) => row.org_id),
  );
}

function buildActivationConfig(params: {
  action: AdminOrgAction;
  extraData?: Record<string, unknown>;
  allowLifetime: boolean;
}) {
  if (params.action === 'grant_lifetime') {
    const lifetimeEnd = new Date();
    lifetimeEnd.setFullYear(lifetimeEnd.getFullYear() + 100);

    return {
      planCode: 'ENTERPRISE' as const,
      expiresAt: lifetimeEnd.toISOString(),
      durationMonths: 1200,
      durationLabel: 'مدى الحياة',
    };
  }

  if (params.action === 'activate_paid') {
    const months = clampInteger(params.extraData?.months, 12, 1, 240);
    return {
      planCode: normalizePlanCode(params.extraData?.plan ?? 'MEDIUM_OFFICE', 'MEDIUM_OFFICE'),
      expiresAt: addMonths(new Date(), months).toISOString(),
      durationMonths: months,
      durationLabel: `${months} شهر`,
    };
  }

  const normalizedPlan = normalizePlanCode(params.extraData?.plan, 'TRIAL');
  if (normalizedPlan === 'TRIAL') {
    return null;
  }

  const durationMode = String(params.extraData?.duration_mode || 'month').trim();
  if (durationMode === 'lifetime') {
    if (!params.allowLifetime) {
      return null;
    }
    const lifetimeEnd = new Date();
    lifetimeEnd.setFullYear(lifetimeEnd.getFullYear() + 100);
    return {
      planCode: normalizedPlan,
      expiresAt: lifetimeEnd.toISOString(),
      durationMonths: 1200,
      durationLabel: 'مدى الحياة',
    };
  }

  if (durationMode === 'year') {
    return {
      planCode: normalizedPlan,
      expiresAt: addYears(new Date(), 1).toISOString(),
      durationMonths: 12,
      durationLabel: 'سنة واحدة',
    };
  }

  if (durationMode === 'custom_months') {
    const months = clampInteger(params.extraData?.duration_value, 1, 1, 240);
    return {
      planCode: normalizedPlan,
      expiresAt: addMonths(new Date(), months).toISOString(),
      durationMonths: months,
      durationLabel: `${months} شهر`,
    };
  }

  if (durationMode === 'custom_years') {
    const years = clampInteger(params.extraData?.duration_value, 1, 1, 20);
    return {
      planCode: normalizedPlan,
      expiresAt: addYears(new Date(), years).toISOString(),
      durationMonths: years * 12,
      durationLabel: `${years} سنة`,
    };
  }

  return {
    planCode: normalizedPlan,
    expiresAt: addMonths(new Date(), 1).toISOString(),
    durationMonths: 1,
    durationLabel: 'شهر واحد',
  };
}

async function upsertSubscriptionState(
  adminClient: ReturnType<typeof createSupabaseServerClient>,
  params: {
    orgId: string;
    adminId: string;
    planCode: string;
    expiresAt: string;
    auditAction: string;
    auditMeta: Record<string, unknown>;
  },
) {
  const now = new Date().toISOString();
  const seats = getDefaultSeatLimit(params.planCode);

  const { error: modernError } = await adminClient
    .from('subscriptions')
    .upsert(
      {
        org_id: params.orgId,
        plan_code: params.planCode,
        status: 'active',
        seats,
        current_period_start: now,
        current_period_end: params.expiresAt,
        cancel_at_period_end: false,
        provider: 'manual',
      },
      { onConflict: 'org_id' },
    );

  if (modernError) {
    return { ok: false as const, error: modernError.message };
  }

  const { error: legacyError } = await adminClient
    .from('org_subscriptions')
    .upsert(
      {
        org_id: params.orgId,
        status: 'active',
        plan: params.planCode,
        payment_status: 'paid',
        current_period_start: now,
        current_period_end: params.expiresAt,
        updated_at: now,
      },
      { onConflict: 'org_id' },
    );

  if (legacyError) {
    return { ok: false as const, error: legacyError.message };
  }

  const { error: orgStatusError } = await adminClient
    .from('organizations')
    .update({ status: 'active' })
    .eq('id', params.orgId);

  if (orgStatusError) {
    return { ok: false as const, error: orgStatusError.message };
  }

  await adminClient.from('audit_logs').insert({
    org_id: params.orgId,
    user_id: params.adminId,
    action: params.auditAction,
    entity_type: 'org_subscriptions',
    entity_id: params.orgId,
    meta: {
      plan_code: params.planCode,
      seats,
      expires_at: params.expiresAt,
      ...params.auditMeta,
    },
  });

  return { ok: true as const };
}

function clampInteger(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.floor(parsed)));
}

function parseDate(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function addMonths(baseDate: Date, months: number) {
  const next = new Date(baseDate);
  next.setMonth(next.getMonth() + months);
  return next;
}

function addYears(baseDate: Date, years: number) {
  const next = new Date(baseDate);
  next.setFullYear(next.getFullYear() + years);
  return next;
}
