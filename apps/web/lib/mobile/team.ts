import 'server-only';

import { randomBytes } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { getDefaultSeatLimit, getPlanDisplayLabel, resolveEffectivePlanCode, type CanonicalPlanCode } from '@/lib/billing/plans';
import { getPublicSiteUrl } from '@/lib/env';
import { hashPassword } from '@/lib/auth-custom';
import { type MobileAppSessionContext, requireMobileOfficeOwnerContext } from '@/lib/mobile/auth';
import { TeamHttpError, type TeamInvitation, type TeamMember, type TeamRole } from '@/lib/team';

type TeamMemberRow = {
  user_id: string;
  role: TeamRole;
  permissions: Record<string, boolean> | null;
  created_at: string;
};

type AppUserRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  license_number: string | null;
};

type CurrentUserRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  license_number: string | null;
};

type PartnerRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  whatsapp_number: string | null;
};

const roleSchema = z.enum(['owner', 'lawyer', 'assistant']);
const expiresInSchema = z.enum(['24h', '7d']);

const createInvitationSchema = z.object({
  email: z.string().trim().email('يرجى إدخال بريد إلكتروني صحيح.').max(255),
  role: roleSchema.default('lawyer'),
  expiresIn: expiresInSchema.default('7d'),
});

const addMemberSchema = z.object({
  fullName: z.string().trim().min(2, 'يجب أن يكون الاسم الكامل من حرفين على الأقل').max(100),
  email: z.string().trim().email('يرجى إدخال بريد إلكتروني صحيح.').max(255),
  password: z.string().min(6, 'كلمة المرور يجب أن تكون 6 أحرف على الأقل').max(100),
  licenseNumber: z.string().trim().optional().nullable(),
  role: roleSchema.default('lawyer'),
  permissions: z.record(z.boolean()).optional(),
});

const changeRoleSchema = z.object({
  role: roleSchema,
});

const updateMemberSchema = z.object({
  fullName: z.string().trim().min(2, 'يجب أن يكون الاسم الكامل من حرفين على الأقل').max(100),
  email: z.string().trim().email('يرجى إدخال بريد إلكتروني صحيح.').max(255),
  phone: z.string().trim().max(40, 'رقم الجوال طويل جدًا.').optional().nullable(),
  licenseNumber: z.string().trim().optional().nullable(),
  permissions: z.record(z.boolean()).optional(),
});

const revokeInvitationSchema = z.object({
  invitationId: z.string().uuid('الدعوة غير صحيحة.'),
});

const removeMemberSchema = z.object({
  userId: z.string().uuid('العضو غير صحيح.'),
});

const LAST_OWNER_MESSAGE = 'لا يمكن إزالة/تغيير آخر شريك (Owner) في المكتب.';

async function getOwnerContext(request: NextRequest | Request) {
  const auth = await requireMobileOfficeOwnerContext(request);
  if (!auth.ok) {
    throw new TeamHttpError(auth.status, auth.error);
  }

  if (!auth.context.org?.id) {
    throw new TeamHttpError(403, 'هذا الحساب لا يملك وصولاً إلى المكتب.');
  }

  return auth.context;
}

async function logMobileTeamAudit(params: {
  context: MobileAppSessionContext;
  action: string;
  entityType: string;
  entityId: string;
  meta?: Record<string, unknown>;
  req?: Request;
}) {
  try {
    const headerStore = params.req?.headers ?? null;
    const forwardedFor = headerStore?.get('x-forwarded-for') || '';
    const ip = forwardedFor.split(',')[0]?.trim() || headerStore?.get('x-real-ip') || null;
    const userAgent = headerStore?.get('user-agent') || null;

    await params.context.db.from('audit_logs').insert({
      org_id: params.context.org?.id ?? null,
      user_id: params.context.user.id,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId,
      meta: params.meta ?? {},
      ip,
      user_agent: userAgent,
    });
  } catch {
    // Non-blocking audit logging for mobile routes.
  }
}

async function countOwners(context: MobileAppSessionContext) {
  if (!context.org?.id) {
    throw new TeamHttpError(403, 'هذا الحساب لا يملك وصولاً إلى المكتب.');
  }

  const { count, error } = await context.db
    .from('memberships')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', context.org.id)
    .eq('role', 'owner');

  if (error) {
    throw new TeamHttpError(400, 'تعذر التحقق من الملاك. حاول مرة أخرى.');
  }

  return count ?? 0;
}

function generateToken() {
  return randomBytes(32).toString('base64url');
}

function expiresAtFrom(expiresIn: z.infer<typeof expiresInSchema>) {
  const now = Date.now();
  const ms = expiresIn === '24h' ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
  return new Date(now + ms);
}

async function getActivePlanCode(context: MobileAppSessionContext): Promise<CanonicalPlanCode | null> {
  const orgId = context.org?.id;
  if (!orgId) {
    return null;
  }

  const [subscriptionRes, legacyRes, trialRes] = await Promise.all([
    context.db
      .from('subscriptions')
      .select('plan_code, status, created_at')
      .eq('org_id', orgId)
      .in('status', ['trial', 'active', 'past_due', 'canceled'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    context.db
      .from('org_subscriptions')
      .select('plan, status, created_at')
      .eq('org_id', orgId)
      .in('status', ['trial', 'active'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    context.db
      .from('trial_subscriptions')
      .select('status')
      .eq('org_id', orgId)
      .eq('status', 'active')
      .maybeSingle(),
  ]);

  return resolveEffectivePlanCode({
    subscriptionPlan: (subscriptionRes.data as { plan_code?: string | null } | null)?.plan_code,
    subscriptionStatus: (subscriptionRes.data as { status?: string | null } | null)?.status,
    legacyPlan: (legacyRes.data as { plan?: string | null } | null)?.plan,
    legacyStatus: (legacyRes.data as { status?: string | null } | null)?.status,
    hasActiveTrial: Boolean(trialRes.data),
  });
}

async function getSeatSummary(context: MobileAppSessionContext) {
  const orgId = context.org?.id;
  if (!orgId) {
    throw new TeamHttpError(403, 'هذا الحساب لا يملك وصولاً إلى المكتب.');
  }

  const [membersCountRes, activePlanCode] = await Promise.all([
    context.db
      .from('memberships')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId),
    getActivePlanCode(context),
  ]);

  if (membersCountRes.error) {
    throw new TeamHttpError(400, 'تعذر تحميل ملخص المقاعد. حاول مرة أخرى.');
  }

  const memberCount = membersCountRes.count ?? 0;
  const seatLimit = activePlanCode ? getDefaultSeatLimit(activePlanCode) : null;

  return {
    plan_code: activePlanCode,
    plan_label: activePlanCode ? getPlanDisplayLabel(activePlanCode) : null,
    seat_limit: seatLimit,
    member_count: memberCount,
    remaining_seats: seatLimit === null ? null : Math.max(0, seatLimit - memberCount),
    can_add_more_members: seatLimit === null ? false : memberCount < seatLimit,
  };
}

async function loadTeamMembers(context: MobileAppSessionContext): Promise<TeamMember[]> {
  const orgId = context.org?.id;
  if (!orgId) {
    throw new TeamHttpError(403, 'هذا الحساب لا يملك وصولاً إلى المكتب.');
  }

  const { data: memberships, error: membershipsError } = await context.db
    .from('memberships')
    .select('user_id, role, permissions, created_at')
    .eq('org_id', orgId)
    .order('created_at', { ascending: true });

  if (membershipsError) {
    throw new TeamHttpError(400, 'تعذر تحميل أعضاء الفريق. حاول مرة أخرى.');
  }

  const memberRows = (memberships as TeamMemberRow[] | null) ?? [];
  const memberIds = memberRows.map((row) => String(row.user_id));

  const [profilesResult, appUsersResult] = await Promise.all([
    memberIds.length
      ? context.db.from('profiles').select('user_id, full_name, phone').in('user_id', memberIds)
      : Promise.resolve({ data: [], error: null } as const),
    memberIds.length
      ? context.db.from('app_users').select('id, email, full_name, phone, license_number').in('id', memberIds)
      : Promise.resolve({ data: [], error: null } as const),
  ]);

  if (profilesResult.error) {
    throw new TeamHttpError(400, 'تعذر تحميل أسماء الأعضاء. حاول مرة أخرى.');
  }

  if (appUsersResult.error) {
    throw new TeamHttpError(400, 'تعذر تحميل بيانات الأعضاء. حاول مرة أخرى.');
  }

  const emailById = new Map<string, string>();
  const licenseById = new Map<string, string | null>();
  for (const row of (appUsersResult.data as Array<AppUserRow> | null) ?? []) {
    if (row?.id && row?.email) {
      emailById.set(String(row.id), String(row.email));
      licenseById.set(String(row.id), row.license_number ? String(row.license_number) : null);
    }
  }

  const nameById = new Map<string, string>();
  const phoneById = new Map<string, string>();
  for (const row of (profilesResult.data as Array<{ user_id?: string | null; full_name?: string | null; phone?: string | null }> | null) ?? []) {
    if (row?.user_id) {
      nameById.set(String(row.user_id), String(row.full_name ?? ''));
      if (row.phone) {
        phoneById.set(String(row.user_id), String(row.phone));
      }
    }
  }

  for (const row of (appUsersResult.data as Array<AppUserRow> | null) ?? []) {
    if (!row?.id) {
      continue;
    }
    const id = String(row.id);
    if (!nameById.get(id)?.trim() && row.full_name) {
      nameById.set(id, String(row.full_name));
    }
    if (!phoneById.get(id)?.trim() && row.phone) {
      phoneById.set(id, String(row.phone));
    }
  }

  return memberRows.map((row) => {
    const id = String(row.user_id);
    return {
      user_id: id,
      email: emailById.get(id) ?? null,
      full_name: nameById.get(id) ?? '',
      phone: phoneById.get(id) ?? null,
      license_number: licenseById.get(id) ?? null,
      role: row.role as TeamRole,
      permissions: row.permissions ?? {},
      created_at: String(row.created_at),
      is_current_user: id === context.user.id,
    };
  });
}

async function loadInvitations(context: MobileAppSessionContext): Promise<TeamInvitation[]> {
  const orgId = context.org?.id;
  if (!orgId) {
    throw new TeamHttpError(403, 'هذا الحساب لا يملك وصولاً إلى المكتب.');
  }

  const nowIso = new Date().toISOString();
  const { data, error } = await context.db
    .from('org_invitations')
    .select('id, email, role, token, expires_at, accepted_at, created_at')
    .eq('org_id', orgId)
    .is('accepted_at', null)
    .gt('expires_at', nowIso)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    throw new TeamHttpError(400, 'تعذر تحميل الدعوات. حاول مرة أخرى.');
  }

  return ((data as Array<TeamInvitation & { accepted_at: string | null }> | null) ?? []).map((row) => ({
    id: String(row.id),
    email: String(row.email),
    role: row.role as TeamRole,
    token: String(row.token),
    expires_at: String(row.expires_at),
    accepted_at: row.accepted_at ? String(row.accepted_at) : null,
    created_at: String(row.created_at),
  }));
}

export async function getMobileTeamOverview(context: MobileAppSessionContext) {
  const orgId = context.org?.id;
  if (!orgId) {
    throw new TeamHttpError(403, 'هذا الحساب لا يملك وصولاً إلى المكتب.');
  }

  const [members, invitations, seatSummary] = await Promise.all([
    loadTeamMembers(context),
    loadInvitations(context),
    getSeatSummary(context),
  ]);

  return {
    org: context.org,
    members,
    invitations,
    seat_summary: seatSummary,
  };
}

export async function createMobileTeamInvitation(
  context: MobileAppSessionContext,
  input: unknown,
  req?: Request,
): Promise<{ inviteUrl: string; invitation: TeamInvitation }> {
  const orgId = context.org?.id;
  if (!orgId) {
    throw new TeamHttpError(403, 'هذا الحساب لا يملك وصولاً إلى المكتب.');
  }

  const parsed = createInvitationSchema.safeParse({
    email: (input as { email?: unknown } | null)?.email,
    role: (input as { role?: unknown } | null)?.role,
    expiresIn: (input as { expires_in?: unknown; expiresIn?: unknown } | null)?.expiresIn ?? (input as { expires_in?: unknown } | null)?.expires_in,
  });
  if (!parsed.success) {
    throw new TeamHttpError(400, parsed.error.issues[0]?.message ?? 'تعذر التحقق من البيانات.');
  }

  const summary = await getSeatSummary(context);
  if (!summary.can_add_more_members) {
    throw new TeamHttpError(403, 'لقد وصلت للحد الأقصى لعدد المشتركين المسموح به في باقتك الحالية. يرجى ترقية الباقة لإرسال المزيد من الدعوات.');
  }

  const email = parsed.data.email.toLowerCase();
  const expiresAt = expiresAtFrom(parsed.data.expiresIn);

  let inserted: TeamInvitation | null = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const token = generateToken();
    const { data, error } = await context.db
      .from('org_invitations')
      .insert({
        org_id: orgId,
        email,
        role: parsed.data.role,
        token,
        expires_at: expiresAt.toISOString(),
        invited_by: context.user.id,
      })
      .select('id, email, role, token, expires_at, accepted_at, created_at')
      .maybeSingle();

    if (!error && data) {
      inserted = {
        id: String((data as any).id),
        email: String((data as any).email),
        role: (data as any).role as TeamRole,
        token: String((data as any).token),
        expires_at: String((data as any).expires_at),
        accepted_at: (data as any).accepted_at ? String((data as any).accepted_at) : null,
        created_at: String((data as any).created_at),
      };
      break;
    }

    const code = (error as any)?.code ? String((error as any).code) : '';
    const message = String((error as any)?.message ?? '');
    const isDuplicate = code === '23505' || message.toLowerCase().includes('duplicate');
    if (!isDuplicate) {
      throw new TeamHttpError(400, 'تعذر إنشاء الدعوة. حاول مرة أخرى.');
    }
  }

  if (!inserted) {
    throw new TeamHttpError(400, 'تعذر إنشاء الدعوة. حاول مرة أخرى.');
  }

  const inviteUrl = `${getPublicSiteUrl()}/invite/${inserted.token}`;

  await logMobileTeamAudit({
    context,
    action: 'team.invite_created',
    entityType: 'org_invitation',
    entityId: inserted.id,
    meta: {
      role: inserted.role,
      expires_at: inserted.expires_at,
    },
    req,
  });

  return {
    inviteUrl,
    invitation: inserted,
  };
}

export async function addMobileTeamMemberDirect(
  context: MobileAppSessionContext,
  input: unknown,
  req?: Request,
): Promise<void> {
  const orgId = context.org?.id;
  if (!orgId) {
    throw new TeamHttpError(403, 'هذا الحساب لا يملك وصولاً إلى المكتب.');
  }

  const parsed = addMemberSchema.safeParse(input);
  if (!parsed.success) {
    throw new TeamHttpError(400, parsed.error.issues[0]?.message ?? 'تعذر التحقق من البيانات.');
  }

  const summary = await getSeatSummary(context);
  if (!summary.can_add_more_members) {
    throw new TeamHttpError(403, 'لقد وصلت للحد الأقصى لعدد المشتركين المسموح به في باقتك الحالية. يرجى ترقية الباقة لإضافة المزيد من الأعضاء.');
  }

  const email = parsed.data.email.toLowerCase();

  const { data: existing } = await context.db
    .from('app_users')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (existing) {
    throw new TeamHttpError(400, 'هذا البريد الإلكتروني مسجل مسبقاً.');
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const { data: newUser, error: createError } = await context.db
    .from('app_users')
    .insert({
      email,
      password_hash: passwordHash,
      full_name: parsed.data.fullName,
      license_number: parsed.data.licenseNumber || null,
      email_verified: true,
      status: 'active',
    })
    .select('id')
    .single();

  if (createError || !newUser) {
    throw new TeamHttpError(400, 'تعذر إنشاء الحساب. ' + (createError?.message || ''));
  }

  const newUserId = String((newUser as { id: string }).id);

  await context.db
    .from('profiles')
    .upsert(
      {
        user_id: newUserId,
        full_name: parsed.data.fullName,
      },
      { onConflict: 'user_id' },
    );

  const { error: membershipError } = await context.db
    .from('memberships')
    .insert({
      org_id: orgId,
      user_id: newUserId,
      role: parsed.data.role,
      permissions: parsed.data.permissions || {},
    });

  if (membershipError) {
    await context.db.from('app_users').delete().eq('id', newUserId);
    throw new TeamHttpError(400, 'تعذر إضافة المستخدم للمكتب. ' + membershipError.message);
  }

  await logMobileTeamAudit({
    context,
    action: 'team.member_added_direct',
    entityType: 'membership',
    entityId: newUserId,
    meta: {
      role: parsed.data.role,
      email,
    },
    req,
  });
}

export async function updateMobileTeamMemberProfile(
  context: MobileAppSessionContext,
  input: unknown,
  req?: Request,
): Promise<void> {
  const orgId = context.org?.id;
  if (!orgId) {
    throw new TeamHttpError(403, 'هذا الحساب لا يملك وصولاً إلى المكتب.');
  }

  const parsed = updateMemberSchema.safeParse(input);
  if (!parsed.success) {
    throw new TeamHttpError(400, parsed.error.issues[0]?.message ?? 'تعذر التحقق من البيانات.');
  }

  const email = parsed.data.email.toLowerCase();
  const fullName = parsed.data.fullName.trim();
  const phone = parsed.data.phone?.trim() ? parsed.data.phone.trim() : null;

  const { data: targetMembership, error: targetMembershipError } = await context.db
    .from('memberships')
    .select('id')
    .eq('org_id', orgId)
    .eq('user_id', String((input as { userId?: unknown } | null)?.userId ?? ''))
    .maybeSingle();

  if (targetMembershipError) {
    throw new TeamHttpError(400, 'تعذر تحميل العضو. حاول مرة أخرى.');
  }

  if (!targetMembership) {
    throw new TeamHttpError(404, 'العضو غير موجود.');
  }

  const userId = String((input as { userId?: unknown } | null)?.userId ?? '');
  const { data: currentUserData, error: currentUserDataError } = await context.db
    .from('app_users')
    .select('id, email, full_name, phone, license_number')
    .eq('id', userId)
    .maybeSingle();

  if (currentUserDataError) {
    throw new TeamHttpError(400, 'تعذر تحميل بيانات العضو. حاول مرة أخرى.');
  }

  if (!currentUserData) {
    throw new TeamHttpError(404, 'بيانات العضو غير موجودة.');
  }

  const { data: emailInUse, error: emailInUseError } = await context.db
    .from('app_users')
    .select('id')
    .ilike('email', email)
    .neq('id', userId)
    .maybeSingle();

  if (emailInUseError) {
    throw new TeamHttpError(400, 'تعذر التحقق من البريد الإلكتروني. حاول مرة أخرى.');
  }

  if (emailInUse) {
    throw new TeamHttpError(409, 'هذا البريد الإلكتروني مستخدم من عضو آخر.');
  }

  const changed: string[] = [];
  if (String((currentUserData as CurrentUserRow).full_name ?? '').trim() !== fullName) {
    changed.push('full_name');
  }
  if (String((currentUserData as CurrentUserRow).email ?? '').trim().toLowerCase() !== email) {
    changed.push('email');
  }
  if (String((currentUserData as CurrentUserRow).phone ?? '').trim() !== (phone ?? '')) {
    changed.push('phone');
  }
  if (String((currentUserData as CurrentUserRow).license_number ?? '').trim() !== (parsed.data.licenseNumber ?? '')) {
    changed.push('license_number');
  }

  if (parsed.data.permissions) {
    const { error: permError } = await context.db
      .from('memberships')
      .update({ permissions: parsed.data.permissions })
      .eq('org_id', orgId)
      .eq('user_id', userId);
    if (permError) {
      throw new TeamHttpError(400, 'تعذر تحديث الصلاحيات.');
    }
    changed.push('permissions');
  }

  if (changed.length === 0) {
    return;
  }

  const { error: updateError } = await context.db
    .from('app_users')
    .update({
      full_name: fullName,
      email,
      phone,
      license_number: parsed.data.licenseNumber || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (updateError) {
    const code = (updateError as any)?.code ? String((updateError as any).code) : '';
    if (code === '23505') {
      throw new TeamHttpError(409, 'هذا البريد الإلكتروني مستخدم من عضو آخر.');
    }
    throw new TeamHttpError(400, 'تعذر تحديث بيانات العضو. حاول مرة أخرى.');
  }

  const { error: profileError } = await context.db
    .from('profiles')
    .upsert(
      {
        user_id: userId,
        full_name: fullName,
        phone,
      },
      { onConflict: 'user_id' },
    );

  if (profileError) {
    throw new TeamHttpError(400, 'تم تحديث الحساب لكن تعذر مزامنة الملف الشخصي. حاول مرة أخرى.');
  }

  const { data: linkedPartner, error: linkedPartnerError } = await context.db
    .from('partners')
    .select('id, full_name, email, whatsapp_number')
    .eq('user_id', userId)
    .maybeSingle();

  if (linkedPartnerError) {
    throw new TeamHttpError(400, 'تم تحديث بيانات العضو لكن تعذر التحقق من ملف الشريك المرتبط.');
  }

  if (linkedPartner) {
    const partnerUpdatePayload: Record<string, unknown> = {};
    const partnerRow = linkedPartner as PartnerRow;
    if (String(partnerRow.full_name ?? '').trim() !== fullName) {
      partnerUpdatePayload.full_name = fullName;
    }
    if (String(partnerRow.email ?? '').trim().toLowerCase() !== email) {
      partnerUpdatePayload.email = email;
    }
    if (phone && String(partnerRow.whatsapp_number ?? '').trim() !== phone) {
      partnerUpdatePayload.whatsapp_number = phone;
    }

    if (Object.keys(partnerUpdatePayload).length > 0) {
      const { error: partnerUpdateError } = await context.db
        .from('partners')
        .update(partnerUpdatePayload)
        .eq('id', partnerRow.id);

      if (partnerUpdateError) {
        throw new TeamHttpError(400, 'تم تحديث بيانات العضو لكن تعذر مزامنة بيانات بوابة الشريك.');
      }
      changed.push('partner_profile');
    }
  }

  await logMobileTeamAudit({
    context,
    action: 'team.member_updated',
    entityType: 'membership',
    entityId: String((targetMembership as { id: string }).id),
    meta: {
      user_id: userId,
      changed,
    },
    req,
  });
}

export async function changeMobileTeamMemberRole(
  context: MobileAppSessionContext,
  userId: string,
  input: unknown,
  req?: Request,
): Promise<void> {
  const orgId = context.org?.id;
  if (!orgId) {
    throw new TeamHttpError(403, 'هذا الحساب لا يملك وصولاً إلى المكتب.');
  }

  const parsed = changeRoleSchema.safeParse(input);
  if (!parsed.success) {
    throw new TeamHttpError(400, parsed.error.issues[0]?.message ?? 'تعذر التحقق من البيانات.');
  }

  const { data: target, error: targetError } = await context.db
    .from('memberships')
    .select('id, role')
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .maybeSingle();

  if (targetError) {
    throw new TeamHttpError(400, 'تعذر تحميل العضو. حاول مرة أخرى.');
  }

  if (!target) {
    throw new TeamHttpError(404, 'العضو غير موجود.');
  }

  const fromRole = String((target as { role?: string }).role) as TeamRole;
  const toRole = parsed.data.role as TeamRole;

  if (fromRole === 'owner' && toRole !== 'owner') {
    const owners = await countOwners(context);
    if (owners <= 1) {
      throw new TeamHttpError(409, LAST_OWNER_MESSAGE);
    }
  }

  const { error: updateError } = await context.db
    .from('memberships')
    .update({ role: toRole })
    .eq('org_id', orgId)
    .eq('user_id', userId);

  if (updateError) {
    throw new TeamHttpError(400, 'تعذر تحديث الدور. حاول مرة أخرى.');
  }

  await logMobileTeamAudit({
    context,
    action: 'team.role_changed',
    entityType: 'membership',
    entityId: String((target as { id: string }).id),
    meta: { user_id: userId, from: fromRole, to: toRole },
    req,
  });
}

export async function removeMobileTeamMember(
  context: MobileAppSessionContext,
  userId: string,
  req?: Request,
): Promise<void> {
  const orgId = context.org?.id;
  if (!orgId) {
    throw new TeamHttpError(403, 'هذا الحساب لا يملك وصولاً إلى المكتب.');
  }

  const parsed = removeMemberSchema.safeParse({ userId });
  if (!parsed.success) {
    throw new TeamHttpError(400, parsed.error.issues[0]?.message ?? 'تعذر التحقق من البيانات.');
  }

  const { data: target, error: targetError } = await context.db
    .from('memberships')
    .select('id, role')
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .maybeSingle();

  if (targetError) {
    throw new TeamHttpError(400, 'تعذر تحميل العضو. حاول مرة أخرى.');
  }

  if (!target) {
    throw new TeamHttpError(404, 'العضو غير موجود.');
  }

  const role = String((target as { role?: string }).role) as TeamRole;
  if (role === 'owner') {
    const owners = await countOwners(context);
    if (owners <= 1) {
      throw new TeamHttpError(409, LAST_OWNER_MESSAGE);
    }
  }

  const { error: deleteError } = await context.db
    .from('memberships')
    .delete()
    .eq('org_id', orgId)
    .eq('user_id', userId);

  if (deleteError) {
    throw new TeamHttpError(400, 'تعذر إزالة العضو. حاول مرة أخرى.');
  }

  await logMobileTeamAudit({
    context,
    action: 'team.member_removed',
    entityType: 'membership',
    entityId: String((target as { id: string }).id),
    meta: { user_id: userId, role },
    req,
  });
}

export async function revokeMobileTeamInvitation(
  context: MobileAppSessionContext,
  invitationId: string,
  req?: Request,
): Promise<void> {
  const orgId = context.org?.id;
  if (!orgId) {
    throw new TeamHttpError(403, 'هذا الحساب لا يملك وصولاً إلى المكتب.');
  }

  const parsed = revokeInvitationSchema.safeParse({ invitationId });
  if (!parsed.success) {
    throw new TeamHttpError(400, parsed.error.issues[0]?.message ?? 'تعذر التحقق من البيانات.');
  }

  const { data: invitation, error: invitationError } = await context.db
    .from('org_invitations')
    .select('id')
    .eq('org_id', orgId)
    .eq('id', invitationId)
    .maybeSingle();

  if (invitationError) {
    throw new TeamHttpError(400, 'تعذر تحميل الدعوة. حاول مرة أخرى.');
  }

  if (!invitation) {
    throw new TeamHttpError(404, 'الدعوة غير موجودة.');
  }

  const { error: deleteError } = await context.db
    .from('org_invitations')
    .delete()
    .eq('org_id', orgId)
    .eq('id', invitationId);

  if (deleteError) {
    throw new TeamHttpError(400, 'تعذر إلغاء الدعوة. حاول مرة أخرى.');
  }

  await logMobileTeamAudit({
    context,
    action: 'team.invite_revoked',
    entityType: 'org_invitation',
    entityId: invitationId,
    meta: { invitation_id: invitationId },
    req,
  });
}
