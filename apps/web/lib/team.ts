import 'server-only';

import { randomBytes } from 'crypto';
import { z } from 'zod';
import { getPublicSiteUrl } from '@/lib/env';
import { requireOwner, type OrgRole } from '@/lib/org';
import { logAudit } from '@/lib/audit';
import { createSupabaseServerClient, createSupabaseServerRlsClient } from '@/lib/supabase/server';

export type TeamRole = OrgRole;

export type TeamMember = {
  user_id: string;
  email: string | null;
  full_name: string;
  role: TeamRole;
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

  const supabase = createSupabaseServerRlsClient();
  const serviceClient = createSupabaseServerClient(); // Admin client needed for auth.admin

  const email = parsed.data.email.toLowerCase();

  // 1. Create the user in Supabase Auth (Admin API)
  const { data: authData, error: authError } = await serviceClient.auth.admin.createUser({
    email,
    password: parsed.data.password,
    email_confirm: true, // Auto-confirm the email so they can log in immediately
    user_metadata: {
      full_name: parsed.data.fullName,
    },
  });

  if (authError) {
    const message = authError.message.toLowerCase();
    if (message.includes('already exists') || message.includes('already registered')) {
      throw new TeamHttpError(400, 'هذا البريد الإلكتروني مسجل مسبقاً.');
    }
    throw new TeamHttpError(400, 'تعذر إنشاء الحساب. ' + authError.message);
  }

  const newUserId = authData.user.id;

  // 2. Add them to the organization's memberships
  const { error: membershipError } = await serviceClient
    .from('memberships')
    .insert({
      org_id: orgId,
      user_id: newUserId,
      role: parsed.data.role,
    });

  if (membershipError) {
    // Attempt rollback of user creation if membership fails, to maintain consistency
    await serviceClient.auth.admin.deleteUser(newUserId);
    throw new TeamHttpError(400, 'تعذر إضافة المستخدم للمكتب.');
  }

  // Note: auth.users insert triggers should automatically create the profile, 
  // but we might need to verify if the trigger propagates user_metadata.full_name correctly 
  // or update it manually if `full_name` is missing from the profile.
  // For safety, let's explicitly update the profile name just in case the trigger didn't catch it.
  await serviceClient
    .from('profiles')
    .update({ full_name: parsed.data.fullName })
    .eq('user_id', newUserId);

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
  role: roleSchema.default('lawyer'),
});

const revokeInvitationSchema = z.object({
  invitationId: z.string().uuid('الدعوة غير صحيحة.'),
});

const changeRoleSchema = z.object({
  userId: z.string().uuid('العضو غير صحيح.'),
  role: roleSchema,
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
    .select('user_id, role, created_at')
    .eq('org_id', orgId)
    .order('created_at', { ascending: true });

  if (membershipsError) {
    throw new TeamHttpError(400, 'تعذر تحميل أعضاء الفريق. حاول مرة أخرى.');
  }

  const memberRows = (memberships as any[] | null) ?? [];
  const memberIds = memberRows.map((row) => String(row.user_id));

  const [profilesResult, authUsersResult] = await Promise.all([
    memberIds.length
      ? supabase.from('profiles').select('user_id, full_name').in('user_id', memberIds)
      : Promise.resolve({ data: [], error: null } as any),
    memberIds.length
      ? (async () => {
        try {
          const service = createSupabaseServerClient();
          return await service.schema('auth').from('users').select('id, email').in('id', memberIds);
        } catch {
          return { data: [], error: null } as any;
        }
      })()
      : Promise.resolve({ data: [], error: null } as any),
  ]);

  if (profilesResult.error) {
    throw new TeamHttpError(400, 'تعذر تحميل أسماء الأعضاء. حاول مرة أخرى.');
  }

  const emailById = new Map<string, string>();
  for (const row of (authUsersResult.data as any[] | null) ?? []) {
    if (row?.id && row?.email) {
      emailById.set(String(row.id), String(row.email));
    }
  }

  const nameById = new Map<string, string>();
  for (const row of (profilesResult.data as any[] | null) ?? []) {
    if (row?.user_id) {
      nameById.set(String(row.user_id), String(row.full_name ?? ''));
    }
  }

  return memberRows.map((row) => {
    const id = String(row.user_id);
    return {
      user_id: id,
      email: emailById.get(id) ?? null,
      full_name: nameById.get(id) ?? '',
      role: row.role as TeamRole,
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
