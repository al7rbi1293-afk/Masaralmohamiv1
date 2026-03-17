import 'server-only';

import { randomBytes } from 'crypto';
import { z } from 'zod';
import { getPublicSiteUrl } from '@/lib/env';
import { requireOwner, type OrgRole } from '@/lib/org';
import { logAudit } from '@/lib/audit';
import { createSupabaseServerClient, createSupabaseServerRlsClient } from '@/lib/supabase/server';
import { canAddMoreMembers } from '@/lib/subscription';

export type TeamRole = OrgRole;

export type TeamMember = {
  user_id: string;
  email: string | null;
  full_name: string;
  phone: string | null;
  license_number: string | null;
  role: TeamRole;
  permissions: any;
  created_at: string;
  is_current_user: boolean;
};

export type TeamInvitation = {
  id: string;
  email: string;
  role: TeamRole;
  token: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
};

export class TeamHttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'TeamHttpError';
    this.status = status;
  }
}

const roleSchema = z.enum(['owner', 'lawyer', 'assistant']);
const expiresInSchema = z.enum(['24h', '7d']);

export async function addMemberDirect(
  input: unknown,
  req?: Request,
): Promise<void> {
  const { orgId, userId } = await getOwnerContext();

  const parsed = addMemberSchema.safeParse(input);
  if (!parsed.success) {
    throw new TeamHttpError(
      400,
      parsed.error.issues[0]?.message ?? 'تعذر التحقق من البيانات.',
    );
  }

  const { hashPassword } = await import('@/lib/auth-custom');
  const db = createSupabaseServerClient();

  // 0. Check if the org can add more members based on their plan
  const canAdd = await canAddMoreMembers(orgId);
  if (!canAdd) {
    throw new TeamHttpError(403, 'لقد وصلت للحد الأقصى لعدد المشتركين المسموح به في باقتك الحالية. يرجى ترقية الباقة لإضافة المزيد من الأعضاء.');
  }

  const email = parsed.data.email.toLowerCase();

  // 1. Check if email already exists in app_users
  const { data: existing } = await db
    .from('app_users')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (existing) {
    throw new TeamHttpError(400, 'هذا البريد الإلكتروني مسجل مسبقاً.');
  }

  // 2. Create the user in app_users with bcrypt-hashed password
  const passwordHash = await hashPassword(parsed.data.password);
  const { data: newUser, error: createError } = await db
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

  const newUserId = newUser.id;

  // 3. Create profile for this user
  await db
    .from('profiles')
    .upsert({
      user_id: newUserId,
      full_name: parsed.data.fullName,
    }, { onConflict: 'user_id' });

  // 4. Add them to the organization's memberships
  const { error: membershipError } = await db
    .from('memberships')
    .insert({
      org_id: orgId,
      user_id: newUserId,
      role: parsed.data.role,
      permissions: parsed.data.permissions || {},
    });

  if (membershipError) {
    // Rollback: delete the user from app_users
    await db.from('app_users').delete().eq('id', newUserId);
    throw new TeamHttpError(400, 'تعذر إضافة المستخدم للمكتب. ' + membershipError.message);
  }

  await logAudit({
    action: 'team.member_added_direct',
    entityType: 'membership',
    entityId: newUserId,
    meta: {
      role: parsed.data.role,
      email: email,
    },
    req,
  });
}

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

const revokeInvitationSchema = z.object({
  invitationId: z.string().uuid('الدعوة غير صحيحة.'),
});

const changeRoleSchema = z.object({
  userId: z.string().uuid('العضو غير صحيح.'),
  role: roleSchema,
});

const updateMemberSchema = z.object({
  userId: z.string().uuid('العضو غير صحيح.'),
  fullName: z.string().trim().min(2, 'يجب أن يكون الاسم الكامل من حرفين على الأقل').max(100),
  email: z.string().trim().email('يرجى إدخال بريد إلكتروني صحيح.').max(255),
  phone: z.string().trim().max(40, 'رقم الجوال طويل جدًا.').optional().nullable(),
  licenseNumber: z.string().trim().optional().nullable(),
  permissions: z.record(z.boolean()).optional(),
});

const removeMemberSchema = z.object({
  userId: z.string().uuid('العضو غير صحيح.'),
});

const LAST_OWNER_MESSAGE = 'لا يمكن إزالة/تغيير آخر شريك (Owner) في المكتب.';

async function getOwnerContext() {
  try {
    const { orgId, userId } = await requireOwner();
    return { orgId, userId };
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'الرجاء تسجيل الدخول.') {
      throw new TeamHttpError(401, message);
    }
    if (message === 'لا تملك صلاحية تنفيذ هذا الإجراء.') {
      throw new TeamHttpError(403, message);
    }
    if (message) {
      throw new TeamHttpError(400, message);
    }
    throw new TeamHttpError(400, 'تعذر تنفيذ الطلب. حاول مرة أخرى.');
  }
}

async function countOwners(orgId: string) {
  const supabase = createSupabaseServerRlsClient();
  const { count, error } = await supabase
    .from('memberships')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('role', 'owner');

  if (error) {
    throw new TeamHttpError(400, 'تعذر التحقق من الملاك. حاول مرة أخرى.');
  }

  return count ?? 0;
}

function expiresAtFrom(expiresIn: z.infer<typeof expiresInSchema>) {
  const now = Date.now();
  const ms = expiresIn === '24h' ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
  return new Date(now + ms);
}

function generateToken() {
  return randomBytes(32).toString('base64url');
}

export async function listMembers(): Promise<TeamMember[]> {
  const { orgId, userId } = await getOwnerContext();
  const supabase = createSupabaseServerRlsClient();

  const { data: memberships, error: membershipsError } = await supabase
    .from('memberships')
    .select('user_id, role, permissions, created_at')
    .eq('org_id', orgId)
    .order('created_at', { ascending: true });

  if (membershipsError) {
    throw new TeamHttpError(400, 'تعذر تحميل أعضاء الفريق. حاول مرة أخرى.');
  }

  const memberRows = (memberships as any[] | null) ?? [];
  const memberIds = memberRows.map((row) => String(row.user_id));

  const [profilesResult, appUsersResult] = await Promise.all([
    memberIds.length
      ? supabase.from('profiles').select('user_id, full_name, phone').in('user_id', memberIds)
      : Promise.resolve({ data: [], error: null } as any),
    memberIds.length
      ? supabase.from('app_users').select('id, email, full_name, phone, license_number').in('id', memberIds)
      : Promise.resolve({ data: [], error: null } as any),
  ]);

  if (profilesResult.error) {
    throw new TeamHttpError(400, 'تعذر تحميل أسماء الأعضاء. حاول مرة أخرى.');
  }

  if (appUsersResult.error) {
    throw new TeamHttpError(400, 'تعذر تحميل بيانات الأعضاء. حاول مرة أخرى.');
  }

  const emailById = new Map<string, string>();
  const licenseById = new Map<string, string | null>();
  for (const row of (appUsersResult.data as any[] | null) ?? []) {
    if (row?.id && row?.email) {
      emailById.set(String(row.id), String(row.email));
      licenseById.set(String(row.id), row.license_number ? String(row.license_number) : null);
    }
  }

  const nameById = new Map<string, string>();
  const phoneById = new Map<string, string>();
  for (const row of (profilesResult.data as any[] | null) ?? []) {
    if (row?.user_id) {
      nameById.set(String(row.user_id), String(row.full_name ?? ''));
      if (row.phone) {
        phoneById.set(String(row.user_id), String(row.phone));
      }
    }
  }

  for (const row of (appUsersResult.data as any[] | null) ?? []) {
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
      is_current_user: id === userId,
    };
  });
}

export async function listInvitations(): Promise<TeamInvitation[]> {
  const { orgId } = await getOwnerContext();
  const supabase = createSupabaseServerRlsClient();

  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
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

  return ((data as any[] | null) ?? []).map((row) => ({
    id: String(row.id),
    email: String(row.email),
    role: row.role as TeamRole,
    token: String(row.token),
    expires_at: String(row.expires_at),
    accepted_at: row.accepted_at ? String(row.accepted_at) : null,
    created_at: String(row.created_at),
  }));
}

export async function createInvitation(
  input: unknown,
  req?: Request,
): Promise<{ inviteUrl: string; invitation: TeamInvitation }> {
  const { orgId, userId } = await getOwnerContext();

  const parsed = createInvitationSchema.safeParse(input);
  if (!parsed.success) {
    throw new TeamHttpError(
      400,
      parsed.error.issues[0]?.message ?? 'تعذر التحقق من البيانات.',
    );
  }

  const supabase = createSupabaseServerRlsClient();

  // 0. Check if the org can add more members based on their plan
  const canAdd = await canAddMoreMembers(orgId);
  if (!canAdd) {
    throw new TeamHttpError(403, 'لقد وصلت للحد الأقصى لعدد المشتركين المسموح به في باقتك الحالية. يرجى ترقية الباقة لإرسال المزيد من الدعوات.');
  }

  const email = parsed.data.email.toLowerCase();
  const expiresAt = expiresAtFrom(parsed.data.expiresIn);

  let inserted: any = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const token = generateToken();
    const { data, error } = await supabase
      .from('org_invitations')
      .insert({
        org_id: orgId,
        email,
        role: parsed.data.role,
        token,
        expires_at: expiresAt.toISOString(),
        invited_by: userId,
      })
      .select('id, email, role, token, expires_at, accepted_at, created_at')
      .maybeSingle();

    if (!error) {
      inserted = data;
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

  const inviteUrl = `${getPublicSiteUrl()}/invite/${String(inserted.token)}`;

  await logAudit({
    action: 'team.invite_created',
    entityType: 'org_invitation',
    entityId: String(inserted.id),
    meta: {
      role: inserted.role,
      expires_at: inserted.expires_at,
    },
    req,
  });

  return {
    inviteUrl,
    invitation: {
      id: String(inserted.id),
      email: String(inserted.email),
      role: inserted.role as TeamRole,
      token: String(inserted.token),
      expires_at: String(inserted.expires_at),
      accepted_at: inserted.accepted_at ? String(inserted.accepted_at) : null,
      created_at: String(inserted.created_at),
    },
  };
}

export async function revokeInvitation(input: unknown, req?: Request): Promise<void> {
  const { orgId } = await getOwnerContext();

  const parsed = revokeInvitationSchema.safeParse(input);
  if (!parsed.success) {
    throw new TeamHttpError(
      400,
      parsed.error.issues[0]?.message ?? 'تعذر التحقق من البيانات.',
    );
  }

  const supabase = createSupabaseServerRlsClient();

  const { error } = await supabase
    .from('org_invitations')
    .delete()
    .eq('org_id', orgId)
    .eq('id', parsed.data.invitationId);

  if (error) {
    throw new TeamHttpError(400, 'تعذر إلغاء الدعوة. حاول مرة أخرى.');
  }

  await logAudit({
    action: 'team.invite_revoked',
    entityType: 'org_invitation',
    entityId: parsed.data.invitationId,
    meta: { invitation_id: parsed.data.invitationId },
    req,
  });
}

export async function changeMemberRole(input: unknown, req?: Request): Promise<void> {
  const { orgId } = await getOwnerContext();

  const parsed = changeRoleSchema.safeParse(input);
  if (!parsed.success) {
    throw new TeamHttpError(
      400,
      parsed.error.issues[0]?.message ?? 'تعذر التحقق من البيانات.',
    );
  }

  const supabase = createSupabaseServerRlsClient();

  const { data: target, error: targetError } = await supabase
    .from('memberships')
    .select('id, role')
    .eq('org_id', orgId)
    .eq('user_id', parsed.data.userId)
    .maybeSingle();

  if (targetError) {
    throw new TeamHttpError(400, 'تعذر تحميل العضو. حاول مرة أخرى.');
  }

  if (!target) {
    throw new TeamHttpError(404, 'العضو غير موجود.');
  }

  const fromRole = String((target as any).role) as TeamRole;
  const toRole = parsed.data.role as TeamRole;

  if (fromRole === 'owner' && toRole !== 'owner') {
    const owners = await countOwners(orgId);
    if (owners <= 1) {
      throw new TeamHttpError(409, LAST_OWNER_MESSAGE);
    }
  }

  const { error: updateError } = await supabase
    .from('memberships')
    .update({ role: toRole })
    .eq('org_id', orgId)
    .eq('user_id', parsed.data.userId);

  if (updateError) {
    throw new TeamHttpError(400, 'تعذر تحديث الدور. حاول مرة أخرى.');
  }

  await logAudit({
    action: 'team.role_changed',
    entityType: 'membership',
    entityId: String((target as any).id),
    meta: { user_id: parsed.data.userId, from: fromRole, to: toRole },
    req,
  });
}

export async function updateMemberProfile(input: unknown, req?: Request): Promise<void> {
  const { orgId } = await getOwnerContext();

  const parsed = updateMemberSchema.safeParse(input);
  if (!parsed.success) {
    throw new TeamHttpError(
      400,
      parsed.error.issues[0]?.message ?? 'تعذر التحقق من البيانات.',
    );
  }

  const supabase = createSupabaseServerRlsClient();
  const email = parsed.data.email.toLowerCase();
  const fullName = parsed.data.fullName.trim();
  const phone = parsed.data.phone?.trim() ? parsed.data.phone.trim() : null;

  const { data: targetMembership, error: targetMembershipError } = await supabase
    .from('memberships')
    .select('id')
    .eq('org_id', orgId)
    .eq('user_id', parsed.data.userId)
    .maybeSingle();

  if (targetMembershipError) {
    throw new TeamHttpError(400, 'تعذر تحميل العضو. حاول مرة أخرى.');
  }

  if (!targetMembership) {
    throw new TeamHttpError(404, 'العضو غير موجود.');
  }

  const { data: currentUserData, error: currentUserDataError } = await supabase
    .from('app_users')
    .select('id, email, full_name, phone, license_number')
    .eq('id', parsed.data.userId)
    .maybeSingle();

  if (currentUserDataError) {
    throw new TeamHttpError(400, 'تعذر تحميل بيانات العضو. حاول مرة أخرى.');
  }

  if (!currentUserData) {
    throw new TeamHttpError(404, 'بيانات العضو غير موجودة.');
  }

  const { data: emailInUse, error: emailInUseError } = await supabase
    .from('app_users')
    .select('id')
    .ilike('email', email)
    .neq('id', parsed.data.userId)
    .maybeSingle();

  if (emailInUseError) {
    throw new TeamHttpError(400, 'تعذر التحقق من البريد الإلكتروني. حاول مرة أخرى.');
  }

  if (emailInUse) {
    throw new TeamHttpError(409, 'هذا البريد الإلكتروني مستخدم من عضو آخر.');
  }

  const changed: string[] = [];
  if (String(currentUserData.full_name ?? '').trim() !== fullName) {
    changed.push('full_name');
  }
  if (String(currentUserData.email ?? '').trim().toLowerCase() !== email) {
    changed.push('email');
  }
  if (String(currentUserData.phone ?? '').trim() !== (phone ?? '')) {
    changed.push('phone');
  }
  if (String(currentUserData.license_number ?? '').trim() !== (parsed.data.licenseNumber ?? '')) {
    changed.push('license_number');
  }

  // Always update permissions independently of 'changed' length if present
  if (parsed.data.permissions) {
     const { error: permError } = await supabase
       .from('memberships')
       .update({ permissions: parsed.data.permissions })
       .eq('org_id', orgId)
       .eq('user_id', parsed.data.userId);
     if (permError) {
        throw new TeamHttpError(400, 'تعذر تحديث الصلاحيات.');
     }
  }

  if (changed.length === 0) {
    return;
  }

  const { error: updateError } = await supabase
    .from('app_users')
    .update({
      full_name: fullName,
      email,
      phone,
      license_number: parsed.data.licenseNumber || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', parsed.data.userId);

  if (updateError) {
    const code = (updateError as any)?.code ? String((updateError as any).code) : '';
    if (code === '23505') {
      throw new TeamHttpError(409, 'هذا البريد الإلكتروني مستخدم من عضو آخر.');
    }
    throw new TeamHttpError(400, 'تعذر تحديث بيانات العضو. حاول مرة أخرى.');
  }

  const { error: profileError } = await supabase
    .from('profiles')
    .upsert(
      {
        user_id: parsed.data.userId,
        full_name: fullName,
        phone,
      },
      { onConflict: 'user_id' },
    );

  if (profileError) {
    throw new TeamHttpError(400, 'تم تحديث الحساب لكن تعذر مزامنة الملف الشخصي. حاول مرة أخرى.');
  }

  const { data: linkedPartner, error: linkedPartnerError } = await supabase
    .from('partners')
    .select('id, full_name, email, whatsapp_number')
    .eq('user_id', parsed.data.userId)
    .maybeSingle();

  if (linkedPartnerError) {
    throw new TeamHttpError(400, 'تم تحديث بيانات العضو لكن تعذر التحقق من ملف الشريك المرتبط.');
  }

  if (linkedPartner) {
    const partnerUpdatePayload: Record<string, unknown> = {};
    if (String((linkedPartner as any).full_name ?? '').trim() !== fullName) {
      partnerUpdatePayload.full_name = fullName;
    }
    if (String((linkedPartner as any).email ?? '').trim().toLowerCase() !== email) {
      partnerUpdatePayload.email = email;
    }
    if (phone && String((linkedPartner as any).whatsapp_number ?? '').trim() !== phone) {
      partnerUpdatePayload.whatsapp_number = phone;
    }

    if (Object.keys(partnerUpdatePayload).length > 0) {
      const { error: partnerUpdateError } = await supabase
        .from('partners')
        .update(partnerUpdatePayload)
        .eq('id', String((linkedPartner as any).id));

      if (partnerUpdateError) {
        throw new TeamHttpError(400, 'تم تحديث بيانات العضو لكن تعذر مزامنة بيانات بوابة الشريك.');
      }
      changed.push('partner_profile');
    }
  }

  await logAudit({
    action: 'team.member_updated',
    entityType: 'membership',
    entityId: String((targetMembership as any).id),
    meta: {
      user_id: parsed.data.userId,
      changed,
    },
    req,
  });
}

export async function removeMember(input: unknown, req?: Request): Promise<void> {
  const { orgId } = await getOwnerContext();

  const parsed = removeMemberSchema.safeParse(input);
  if (!parsed.success) {
    throw new TeamHttpError(
      400,
      parsed.error.issues[0]?.message ?? 'تعذر التحقق من البيانات.',
    );
  }

  const supabase = createSupabaseServerRlsClient();

  const { data: target, error: targetError } = await supabase
    .from('memberships')
    .select('id, role')
    .eq('org_id', orgId)
    .eq('user_id', parsed.data.userId)
    .maybeSingle();

  if (targetError) {
    throw new TeamHttpError(400, 'تعذر تحميل العضو. حاول مرة أخرى.');
  }

  if (!target) {
    throw new TeamHttpError(404, 'العضو غير موجود.');
  }

  const role = String((target as any).role) as TeamRole;
  if (role === 'owner') {
    const owners = await countOwners(orgId);
    if (owners <= 1) {
      throw new TeamHttpError(409, LAST_OWNER_MESSAGE);
    }
  }

  const { error: deleteError } = await supabase
    .from('memberships')
    .delete()
    .eq('org_id', orgId)
    .eq('user_id', parsed.data.userId);

  if (deleteError) {
    throw new TeamHttpError(400, 'تعذر إزالة العضو. حاول مرة أخرى.');
  }

  await logAudit({
    action: 'team.member_removed',
    entityType: 'membership',
    entityId: String((target as any).id),
    meta: { user_id: parsed.data.userId, role },
    req,
  });
}
