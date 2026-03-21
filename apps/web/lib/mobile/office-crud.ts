import 'server-only';

import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Client, ClientStatus } from '@/lib/clients';
import type { Matter } from '@/lib/matters';
import type { MobileAppSessionContext } from '@/lib/mobile/auth';
import type { Task } from '@/lib/tasks';
import { emptyToNull, getErrorText } from '@/lib/shared-utils';

const CLIENT_SELECT_COLUMNS = [
  'id',
  'org_id',
  'type',
  'name',
  'identity_no',
  'commercial_no',
  'email',
  'phone',
  'notes',
  'agency_number',
  'agency_file_name',
  'agency_storage_path',
  'agency_file_size',
  'agency_file_mime_type',
  'address',
  'status',
  'created_at',
  'updated_at',
].join(', ');

const MATTER_SELECT_COLUMNS =
  'id, org_id, client_id, title, status, summary, najiz_case_number, case_type, claims, assigned_user_id, is_private, created_at, updated_at, client:clients(id, name, email, phone)';
const TASK_SELECT_COLUMNS =
  'id, org_id, matter_id, title, description, assignee_id, due_at, priority, status, is_archived, created_by, created_at, updated_at, matter:matters(id, title)';
const TASK_SELECT_COLUMNS_LEGACY =
  'id, org_id, matter_id, title, description, assignee_id, due_at, priority, status, created_by, created_at, updated_at, matter:matters(id, title)';

export const MOBILE_OFFICE_FORBIDDEN_MESSAGE = 'لا تملك صلاحية لهذا الإجراء.';

const mobileClientCreateSchema = z.object({
  type: z.enum(['person', 'company']),
  name: z.string().trim().min(2, 'اسم العميل مطلوب ويجب أن لا يقل عن حرفين.').max(200, 'اسم العميل طويل جدًا.'),
  email: z.string().trim().min(1, 'البريد الإلكتروني مطلوب.').email('البريد الإلكتروني غير صحيح.').max(200, 'البريد الإلكتروني طويل جدًا.'),
  phone: z.string().trim().max(40, 'رقم الجوال طويل جدًا.').optional().or(z.literal('')).nullable(),
  notes: z.string().trim().max(4000, 'الملاحظات طويلة جدًا.').optional().or(z.literal('')).nullable(),
  identity_no: z.string().trim().max(60, 'رقم الهوية طويل جدًا.').optional().or(z.literal('')).nullable(),
  commercial_no: z.string().trim().max(60, 'السجل التجاري طويل جدًا.').optional().or(z.literal('')).nullable(),
  agency_number: z.string().trim().max(120, 'رقم الوكالة طويل جدًا.').optional().or(z.literal('')).nullable(),
  agency_file_name: z.string().trim().max(180, 'اسم ملف الوكالة طويل جدًا.').optional().or(z.literal('')).nullable(),
  agency_storage_path: z.string().trim().max(500, 'مسار الملف طويل جدًا.').optional().or(z.literal('')).nullable(),
  agency_file_size: z.number().int().nonnegative('حجم الملف غير صحيح.').optional().nullable(),
  agency_file_mime_type: z.string().trim().max(120, 'نوع الملف طويل جدًا.').optional().or(z.literal('')).nullable(),
  address: z.string().trim().max(500, 'العنوان طويل جدًا.').optional().or(z.literal('')).nullable(),
  status: z.enum(['active', 'archived']).optional(),
});

const mobileClientUpdateSchema = mobileClientCreateSchema.partial();

const mobileMatterCreateSchema = z.object({
  client_id: z.string().uuid('العميل غير صحيح.'),
  title: z.string().trim().min(2, 'عنوان القضية مطلوب ويجب أن لا يقل عن حرفين.').max(200, 'عنوان القضية طويل جدًا.'),
  status: z.enum(['new', 'in_progress', 'on_hold', 'closed', 'archived']).optional(),
  summary: z.string().trim().max(4000, 'الملخص طويل جدًا.').optional().or(z.literal('')).nullable(),
  najiz_case_number: z.string().trim().max(120, 'رقم القضية في ناجز طويل جدًا.').optional().or(z.literal('')).nullable(),
  case_type: z.string().trim().max(120, 'نوع القضية طويل جدًا.').optional().or(z.literal('')).nullable(),
  claims: z.string().trim().max(4000, 'الطلبات طويلة جدًا.').optional().or(z.literal('')).nullable(),
  assigned_user_id: z.string().uuid('المسند إليه غير صحيح.').optional().or(z.literal('')).nullable(),
  is_private: z.boolean().optional(),
});

const mobileMatterUpdateSchema = mobileMatterCreateSchema.partial();

const mobileTaskCreateSchema = z.object({
  title: z.string().trim().min(2, 'عنوان المهمة مطلوب ويجب أن لا يقل عن حرفين.').max(200, 'عنوان المهمة طويل جدًا.'),
  description: z.string().trim().max(4000, 'الوصف طويل جدًا.').optional().or(z.literal('')).nullable(),
  matter_id: z.string().uuid('القضية غير صحيحة.').optional().or(z.literal('')).nullable(),
  assignee_id: z.string().uuid('المسند إليه غير صحيح.').optional().or(z.literal('')).nullable(),
  due_at: z
    .string()
    .trim()
    .optional()
    .or(z.literal(''))
    .nullable()
    .refine((value) => !value || !Number.isNaN(Date.parse(value)), {
      message: 'تاريخ الاستحقاق غير صحيح.',
    }),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  status: z.enum(['todo', 'doing', 'done', 'canceled']).optional(),
});

const mobileTaskUpdateSchema = mobileTaskCreateSchema.partial();

type ClientRow = Client & {
  agency_number: string | null;
  agency_file_name: string | null;
  agency_storage_path: string | null;
  agency_file_size: number | null;
  agency_file_mime_type: string | null;
};

type MatterClientRelation = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
};

type MatterRow = Omit<Matter, 'client'> & {
  client: MatterClientRelation | MatterClientRelation[] | null;
};

type TaskMatterRelation = {
  id: string;
  title: string;
};

type TaskRow = Omit<Task, 'matter'> & {
  matter: TaskMatterRelation | TaskMatterRelation[] | null;
};

type TaskRowLike = Omit<TaskRow, 'is_archived'> & {
  is_archived?: boolean;
};

function isUuidLike(value: string | null | undefined) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value ?? '').trim());
}

function cleanQuery(value: string | null | undefined) {
  const normalized = String(value ?? '').trim();
  return normalized ? normalized.replace(/\s+/g, ' ') : '';
}

function pickRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  if (Array.isArray(value)) return (value[0] as T | undefined) ?? null;
  return value;
}

function normalizeTaskRow(value: TaskRowLike): Task {
  const rawMatter = value.matter;
  const matter = Array.isArray(rawMatter) ? rawMatter[0] ?? null : rawMatter ?? null;

  return {
    ...value,
    is_archived: Boolean(value.is_archived ?? false),
    matter,
  };
}

function normalizeClientRow(value: ClientRow): Client {
  return {
    id: value.id,
    org_id: value.org_id,
    type: value.type,
    name: value.name,
    identity_no: value.identity_no ?? null,
    commercial_no: value.commercial_no ?? null,
    email: value.email ?? null,
    phone: value.phone ?? null,
    notes: value.notes ?? null,
    agency_number: value.agency_number ?? null,
    agency_file_name: value.agency_file_name ?? null,
    agency_storage_path: value.agency_storage_path ?? null,
    agency_file_size: value.agency_file_size ?? null,
    agency_file_mime_type: value.agency_file_mime_type ?? null,
    address: value.address ?? null,
    status: value.status,
    created_at: value.created_at,
    updated_at: value.updated_at,
  };
}

function normalizeMatterRow(value: MatterRow): Matter {
  const rawClient = value.client;
  const client = Array.isArray(rawClient) ? rawClient[0] ?? null : rawClient ?? null;

  return {
    id: value.id,
    org_id: value.org_id,
    client_id: value.client_id,
    title: value.title,
    status: value.status,
    summary: value.summary ?? null,
    case_type: value.case_type ?? null,
    claims: value.claims ?? null,
    assigned_user_id: value.assigned_user_id ?? null,
    is_private: Boolean(value.is_private),
    najiz_case_number: value.najiz_case_number ?? null,
    created_at: value.created_at,
    updated_at: value.updated_at,
    client: client
      ? {
          id: client.id,
          name: client.name,
          email: client.email ?? null,
          phone: client.phone ?? null,
        }
      : null,
  };
}

async function getOrgMemberRole(
  db: SupabaseClient,
  orgId: string,
  userId: string,
): Promise<'owner' | 'lawyer' | 'assistant' | null> {
  const { data, error } = await db
    .from('memberships')
    .select('role')
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as { role?: 'owner' | 'lawyer' | 'assistant' } | null)?.role ?? null;
}

async function assertClientExists(db: SupabaseClient, orgId: string, clientId: string) {
  const { data, error } = await db
    .from('clients')
    .select('id')
    .eq('org_id', orgId)
    .eq('id', clientId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error('client_not_found');
  }
}

async function assertAssignableMatterUser(
  db: SupabaseClient,
  orgId: string,
  userId: string,
) {
  const role = await getOrgMemberRole(db, orgId, userId);
  if (role !== 'owner' && role !== 'lawyer') {
    throw new Error('assignee_not_found');
  }
}

async function assertTaskAssigneeInOrg(
  db: SupabaseClient,
  orgId: string,
  userId: string,
) {
  const role = await getOrgMemberRole(db, orgId, userId);
  if (!role) {
    throw new Error('assignee_not_found');
  }
}

async function getMatterAccessRow(
  db: SupabaseClient,
  orgId: string,
  matterId: string,
) {
  const { data, error } = await db
    .from('matters')
    .select('id, org_id, client_id, title, status, summary, najiz_case_number, case_type, claims, assigned_user_id, is_private, created_at, updated_at, client:clients(id, name, email, phone)')
    .eq('org_id', orgId)
    .eq('id', matterId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as unknown as MatterRow | null) ?? null;
}

async function canAccessMatter(
  db: SupabaseClient,
  orgId: string,
  matterId: string,
  userId: string,
  role: 'owner' | 'lawyer' | 'assistant' | null,
) {
  const matter = await getMatterAccessRow(db, orgId, matterId);
  if (!matter) {
    return false;
  }

  if (!matter.is_private) {
    return true;
  }

  if (role === 'owner') {
    return true;
  }

  if (String(matter.assigned_user_id ?? '') === userId) {
    return true;
  }

  const { data, error } = await db
    .from('matter_members')
    .select('matter_id')
    .eq('matter_id', matterId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data);
}

async function getTaskRow(
  db: SupabaseClient,
  orgId: string,
  taskId: string,
): Promise<TaskRowLike | null> {
  let { data, error } = await db
    .from('tasks')
    .select(TASK_SELECT_COLUMNS)
    .eq('org_id', orgId)
    .eq('id', taskId)
    .maybeSingle();

  if (error && isMissingColumnError(error, 'tasks', 'is_archived')) {
    ({ data, error } = await db
      .from('tasks')
      .select(TASK_SELECT_COLUMNS_LEGACY)
      .eq('org_id', orgId)
      .eq('id', taskId)
      .maybeSingle());
  }

  if (error) {
    throw error;
  }

  return (data as unknown as TaskRowLike | null) ?? null;
}

async function getTaskAccessContext(
  db: SupabaseClient,
  orgId: string,
  taskId: string,
  userId: string,
  role: 'owner' | 'lawyer' | 'assistant' | null,
) {
  const task = await getTaskRow(db, orgId, taskId);
  if (!task) {
    return null;
  }

  if (task.matter_id) {
    const matter = await getMatterAccessRow(db, orgId, task.matter_id);
    if (!matter) {
      return null;
    }

    const canAccessMatterRow = await canAccessMatter(db, orgId, task.matter_id, userId, role);
    if (!canAccessMatterRow) {
      return null;
    }
  }

  return task;
}

function ensurePatchPayload<T extends Record<string, unknown>>(payload: T, fallback: string) {
  if (!Object.keys(payload).length) {
    throw new Error(fallback);
  }
}

function normalizeStatusInput<T extends string>(value: T | null | undefined) {
  const normalized = String(value ?? '').trim();
  return normalized || null;
}

function toNullableText(value: string | null | undefined) {
  return emptyToNull(value ?? undefined);
}

export function toMobileOfficeUserMessage(
  error: unknown,
  fallback: string,
  notFoundMessage: string,
) {
  const message = getErrorText(error);
  const normalized = message.toLowerCase();

  if (message.includes('لا يوجد مكتب مفعّل')) {
    return message;
  }

  if (normalized.includes('missing_org')) {
    return 'لا يوجد مكتب مفعّل لهذا الحساب. ابدأ التجربة من الصفحة الرئيسية أو تواصل معنا.';
  }

  if (normalized.includes('not_authenticated')) {
    return 'يرجى تسجيل الدخول.';
  }

  if (normalized.includes('client_required')) {
    return 'العميل مطلوب.';
  }

  if (
    normalized.includes('permission denied') ||
    normalized.includes('not allowed') ||
    normalized.includes('violates row-level security') ||
    normalized.includes('not_authorized')
  ) {
    return MOBILE_OFFICE_FORBIDDEN_MESSAGE;
  }

  if (normalized.includes('client_not_found')) {
    return 'العميل غير موجود.';
  }

  if (normalized.includes('assignee_not_found')) {
    return 'المسند إليه غير موجود ضمن المكتب.';
  }

  if (
    normalized.includes('not_found') ||
    normalized.includes('no rows')
  ) {
    return notFoundMessage;
  }

  if (normalized.includes('archive_not_supported')) {
    return 'ميزة الأرشفة غير مفعلة في هذه البيئة بعد.';
  }

  if (containsArabicText(message)) {
    return message;
  }

  return fallback;
}

export async function listOfficeClients(
  context: MobileAppSessionContext,
  params: {
    q?: string | null;
    status?: ClientStatus | 'all' | null;
    page?: number;
    limit?: number;
  },
) {
  const orgId = context.org?.id;
  if (!orgId) {
    throw new Error('missing_org');
  }

  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(50, Math.max(5, params.limit ?? 20));
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  const q = cleanQuery(params.q);
  const status = normalizeStatusInput(params.status) ?? 'active';

  let query = context.db
    .from('clients')
    .select(CLIENT_SELECT_COLUMNS, { count: 'exact' })
    .eq('org_id', orgId)
    .order('updated_at', { ascending: false })
    .range(from, to);

  if (status !== 'all') {
    query = query.eq('status', status);
  }

  if (q) {
    const pattern = `%${q}%`;
    query = query.or(`name.ilike.${pattern},email.ilike.${pattern},phone.ilike.${pattern},identity_no.ilike.${pattern},commercial_no.ilike.${pattern}`);
  }

  const { data, error, count } = await query;
  if (error) {
    throw error;
  }

  const clients = ((data as unknown as ClientRow[] | null) ?? []);
  return {
    data: clients.map(normalizeClientRow),
    page,
    limit,
    total: count ?? 0,
  };
}

export async function getOfficeClient(context: MobileAppSessionContext, id: string) {
  const orgId = context.org?.id;
  if (!orgId) {
    throw new Error('missing_org');
  }

  const { data, error } = await context.db
    .from('clients')
    .select(CLIENT_SELECT_COLUMNS)
    .eq('org_id', orgId)
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const client = (data as unknown as ClientRow | null) ?? null;
  return client ? normalizeClientRow(client) : null;
}

export async function createOfficeClient(context: MobileAppSessionContext, payload: unknown) {
  const parsed = mobileClientCreateSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? 'تعذر إنشاء العميل.');
  }

  const orgId = context.org?.id;
  if (!orgId) {
    throw new Error('missing_org');
  }

  const insertPayload = {
    org_id: orgId,
    type: parsed.data.type,
    name: parsed.data.name.trim(),
    identity_no: toNullableText(parsed.data.identity_no),
    commercial_no: toNullableText(parsed.data.commercial_no),
    email: parsed.data.email.trim().toLowerCase(),
    phone: toNullableText(parsed.data.phone),
    notes: toNullableText(parsed.data.notes),
    agency_number: toNullableText(parsed.data.agency_number),
    agency_file_name: toNullableText(parsed.data.agency_file_name),
    agency_storage_path: toNullableText(parsed.data.agency_storage_path),
    agency_file_size: parsed.data.agency_file_size ?? null,
    agency_file_mime_type: toNullableText(parsed.data.agency_file_mime_type),
    address: toNullableText(parsed.data.address),
    status: parsed.data.status ?? 'active',
  };

  const { data, error } = await context.db
    .from('clients')
    .insert(insertPayload)
    .select(CLIENT_SELECT_COLUMNS)
    .single();

  if (error || !data) {
    throw error ?? new Error('تعذر إنشاء العميل.');
  }

  return normalizeClientRow(data as unknown as ClientRow);
}

export async function updateOfficeClient(
  context: MobileAppSessionContext,
  id: string,
  payload: unknown,
) {
  const parsed = mobileClientUpdateSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? 'تعذر تحديث العميل.');
  }

  ensurePatchPayload(parsed.data, 'لا توجد بيانات قابلة للتحديث.');

  const orgId = context.org?.id;
  if (!orgId) {
    throw new Error('missing_org');
  }

  const update: Record<string, unknown> = {};
  if (parsed.data.type !== undefined) update.type = parsed.data.type;
  if (parsed.data.name !== undefined) update.name = parsed.data.name.trim();
  if (parsed.data.identity_no !== undefined) update.identity_no = toNullableText(parsed.data.identity_no);
  if (parsed.data.commercial_no !== undefined) update.commercial_no = toNullableText(parsed.data.commercial_no);
  if (parsed.data.email !== undefined) update.email = parsed.data.email.trim().toLowerCase();
  if (parsed.data.phone !== undefined) update.phone = toNullableText(parsed.data.phone);
  if (parsed.data.notes !== undefined) update.notes = toNullableText(parsed.data.notes);
  if (parsed.data.agency_number !== undefined) update.agency_number = toNullableText(parsed.data.agency_number);
  if (parsed.data.agency_file_name !== undefined) update.agency_file_name = toNullableText(parsed.data.agency_file_name);
  if (parsed.data.agency_storage_path !== undefined) update.agency_storage_path = toNullableText(parsed.data.agency_storage_path);
  if (parsed.data.agency_file_size !== undefined) update.agency_file_size = parsed.data.agency_file_size;
  if (parsed.data.agency_file_mime_type !== undefined) update.agency_file_mime_type = toNullableText(parsed.data.agency_file_mime_type);
  if (parsed.data.address !== undefined) update.address = toNullableText(parsed.data.address);
  if (parsed.data.status !== undefined) update.status = parsed.data.status;

  const { data, error } = await context.db
    .from('clients')
    .update(update)
    .eq('org_id', orgId)
    .eq('id', id)
    .select(CLIENT_SELECT_COLUMNS)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error('client_not_found');
  }

  return normalizeClientRow(data as unknown as ClientRow);
}

export async function deleteOfficeClient(context: MobileAppSessionContext, id: string) {
  const orgId = context.org?.id;
  if (!orgId) {
    throw new Error('missing_org');
  }

  if (context.role !== 'owner') {
    throw new Error('not_allowed');
  }

  await context.db.rpc('delete_client_cascade', {
    p_org_id: orgId,
    p_actor_id: context.user.id,
    p_client_id: id,
  });
}

export async function createOfficeMatter(context: MobileAppSessionContext, payload: unknown) {
  const parsed = mobileMatterCreateSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? 'تعذر إنشاء القضية.');
  }

  const orgId = context.org?.id;
  if (!orgId) {
    throw new Error('missing_org');
  }

  await assertClientExists(context.db, orgId, parsed.data.client_id);

  const currentRole = context.role;
  const assignedUserId = toNullableText(parsed.data.assigned_user_id) ?? context.user.id;
  if (assignedUserId) {
    await assertAssignableMatterUser(context.db, orgId, assignedUserId);
  }

  if (
    parsed.data.is_private &&
    assignedUserId &&
    assignedUserId !== context.user.id &&
    currentRole !== 'owner'
  ) {
    throw new Error('not_allowed');
  }

  const matterId = crypto.randomUUID();
  const insertPayload = {
    id: matterId,
    org_id: orgId,
    client_id: parsed.data.client_id,
    title: parsed.data.title.trim(),
    status: parsed.data.status ?? 'new',
    summary: toNullableText(parsed.data.summary),
    najiz_case_number: toNullableText(parsed.data.najiz_case_number),
    case_type: toNullableText(parsed.data.case_type),
    claims: toNullableText(parsed.data.claims),
    assigned_user_id: assignedUserId,
    is_private: parsed.data.is_private ?? false,
  };

  const { data, error } = await context.db
    .from('matters')
    .insert(insertPayload)
    .select(MATTER_SELECT_COLUMNS)
    .single();

  if (error || !data) {
    if ((parsed.data.client_id ?? null) === null) {
      throw new Error('client_required');
    }
    throw error ?? new Error('تعذر إنشاء القضية.');
  }

  const created = normalizeMatterRow(data as unknown as MatterRow);

  if (created.is_private) {
    const memberIds = collectPrivateMatterMemberIds(context.user.id, created.assigned_user_id);
    if (memberIds.length) {
      const { error: memberError } = await context.db.from('matter_members').upsert(
        memberIds.map((memberId) => ({
          matter_id: created.id,
          user_id: memberId,
        })),
        {
          onConflict: 'matter_id,user_id',
          ignoreDuplicates: true,
        },
      );

      if (memberError && !isMatterMemberForeignKeyViolation(memberError)) {
        throw memberError;
      }
    }
  }

  return created;
}

export async function updateOfficeMatter(
  context: MobileAppSessionContext,
  id: string,
  payload: unknown,
) {
  const parsed = mobileMatterUpdateSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? 'تعذر تحديث القضية.');
  }

  ensurePatchPayload(parsed.data, 'لا توجد بيانات قابلة للتحديث.');

  const orgId = context.org?.id;
  if (!orgId) {
    throw new Error('missing_org');
  }

  const existingMatter = await getMatterAccessRow(context.db, orgId, id);
  if (!existingMatter) {
    throw new Error('not_found');
  }

  const currentRole = context.role;
  const currentUserId = context.user.id;
  const currentAssigneeId = String(existingMatter.assigned_user_id ?? '') || null;
  const canEdit = currentRole === 'owner' || currentAssigneeId === currentUserId;
  if (!canEdit) {
    throw new Error('not_allowed');
  }

  if (parsed.data.client_id !== undefined) {
    await assertClientExists(context.db, orgId, parsed.data.client_id);
  }

  if (parsed.data.assigned_user_id !== undefined && parsed.data.assigned_user_id) {
    await assertAssignableMatterUser(context.db, orgId, parsed.data.assigned_user_id);
  }

  if (
    currentRole !== 'owner' &&
    parsed.data.assigned_user_id !== undefined &&
    parsed.data.assigned_user_id !== currentAssigneeId
  ) {
    throw new Error('not_allowed');
  }

  const effectiveAssigneeId =
    parsed.data.assigned_user_id !== undefined
      ? toNullableText(parsed.data.assigned_user_id)
      : currentAssigneeId;

  if (
    parsed.data.is_private &&
    effectiveAssigneeId &&
    effectiveAssigneeId !== currentUserId &&
    currentRole !== 'owner'
  ) {
    throw new Error('not_allowed');
  }

  const update: Record<string, unknown> = {};
  if (parsed.data.client_id !== undefined) update.client_id = parsed.data.client_id;
  if (parsed.data.title !== undefined) update.title = parsed.data.title.trim();
  if (parsed.data.status !== undefined) update.status = parsed.data.status;
  if (parsed.data.summary !== undefined) update.summary = toNullableText(parsed.data.summary);
  if (parsed.data.najiz_case_number !== undefined) update.najiz_case_number = toNullableText(parsed.data.najiz_case_number);
  if (parsed.data.case_type !== undefined) update.case_type = toNullableText(parsed.data.case_type);
  if (parsed.data.claims !== undefined) update.claims = toNullableText(parsed.data.claims);
  if (parsed.data.assigned_user_id !== undefined) update.assigned_user_id = parsed.data.assigned_user_id;
  if (parsed.data.is_private !== undefined) update.is_private = parsed.data.is_private;

  const { data, error } = await context.db
    .from('matters')
    .update(update)
    .eq('org_id', orgId)
    .eq('id', id)
    .select(MATTER_SELECT_COLUMNS)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error('not_found');
  }

  const updated = normalizeMatterRow(data as unknown as MatterRow);

  if (updated.is_private) {
    const memberIds = collectPrivateMatterMemberIds(currentUserId, updated.assigned_user_id);
    if (memberIds.length) {
      const { error: memberError } = await context.db.from('matter_members').upsert(
        memberIds.map((memberId) => ({
          matter_id: updated.id,
          user_id: memberId,
        })),
        {
          onConflict: 'matter_id,user_id',
          ignoreDuplicates: true,
        },
      );

      if (memberError && !isMatterMemberForeignKeyViolation(memberError)) {
        throw memberError;
      }
    }
  }

  return updated;
}

export async function deleteOfficeMatter(context: MobileAppSessionContext, id: string) {
  const orgId = context.org?.id;
  if (!orgId) {
    throw new Error('missing_org');
  }

  if (context.role !== 'owner') {
    throw new Error('not_allowed');
  }

  await context.db.rpc('delete_matter_cascade', {
    p_org_id: orgId,
    p_actor_id: context.user.id,
    p_matter_id: id,
  });
}

export async function getOfficeMatter(context: MobileAppSessionContext, id: string) {
  const orgId = context.org?.id;
  if (!orgId) {
    throw new Error('missing_org');
  }

  const matter = await getMatterAccessRow(context.db, orgId, id);
  if (!matter) {
    return null;
  }

  const role = context.role;
  if (!matter.is_private) {
    return normalizeMatterRow(matter);
  }

  if (role === 'owner' || String(matter.assigned_user_id ?? '') === context.user.id) {
    return normalizeMatterRow(matter);
  }

  const { data, error } = await context.db
    .from('matter_members')
    .select('matter_id')
    .eq('matter_id', matter.id)
    .eq('user_id', context.user.id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return normalizeMatterRow(matter);
}

export async function createOfficeTask(context: MobileAppSessionContext, payload: unknown) {
  const parsed = mobileTaskCreateSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? 'تعذر إنشاء المهمة.');
  }

  const orgId = context.org?.id;
  if (!orgId) {
    throw new Error('missing_org');
  }

  if (parsed.data.matter_id) {
    const canAccess = await canAccessMatter(
      context.db,
      orgId,
      parsed.data.matter_id,
      context.user.id,
      context.role,
    );

    if (!canAccess) {
      throw new Error('not_allowed');
    }
  }

  const assigneeIdRaw = toNullableText(parsed.data.assignee_id);
  const assigneeId = parsed.data.assignee_id === null ? null : assigneeIdRaw ?? context.user.id;
  if (assigneeId) {
    await assertTaskAssigneeInOrg(context.db, orgId, assigneeId);
  }

  const { data, error } = await context.db
    .from('tasks')
    .insert({
      org_id: orgId,
      matter_id: parsed.data.matter_id ? parsed.data.matter_id : null,
      title: parsed.data.title.trim(),
      description: toNullableText(parsed.data.description),
      assignee_id: assigneeId,
      due_at: parsed.data.due_at ? parsed.data.due_at : null,
      priority: parsed.data.priority ?? 'medium',
      status: parsed.data.status ?? 'todo',
      created_by: context.user.id,
    })
    .select('id')
    .single();

  if (error || !data) {
    throw error ?? new Error('تعذر إنشاء المهمة.');
  }

  const task = await getTaskRow(context.db, orgId, String((data as { id: string }).id));
  if (!task) {
    throw new Error('تعذر إنشاء المهمة.');
  }

  return normalizeTaskRow(task);
}

export async function getOfficeTask(context: MobileAppSessionContext, id: string) {
  const orgId = context.org?.id;
  if (!orgId) {
    throw new Error('missing_org');
  }

  const task = await getTaskAccessContext(context.db, orgId, id, context.user.id, context.role);
  if (!task) {
    return null;
  }

  return normalizeTaskRow(task);
}

export async function updateOfficeTask(
  context: MobileAppSessionContext,
  id: string,
  payload: unknown,
) {
  const parsed = mobileTaskUpdateSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? 'تعذر تحديث المهمة.');
  }

  ensurePatchPayload(parsed.data, 'لا توجد بيانات قابلة للتحديث.');

  const orgId = context.org?.id;
  if (!orgId) {
    throw new Error('missing_org');
  }

  const existingTask = await getTaskAccessContext(context.db, orgId, id, context.user.id, context.role);
  if (!existingTask) {
    throw new Error('not_found');
  }

  const currentRole = context.role;
  const currentUserId = context.user.id;
  const isOwner = currentRole === 'owner';
  const isAssignee = String(existingTask.assignee_id ?? '') === currentUserId;
  const isCreator = String(existingTask.created_by ?? '') === currentUserId;

  if (!isOwner && !isAssignee && !isCreator) {
    throw new Error('not_allowed');
  }

  if (parsed.data.matter_id !== undefined && parsed.data.matter_id) {
    const canAccess = await canAccessMatter(
      context.db,
      orgId,
      parsed.data.matter_id,
      currentUserId,
      currentRole,
    );

    if (!canAccess) {
      throw new Error('not_allowed');
    }
  }

  if (parsed.data.assignee_id !== undefined && parsed.data.assignee_id) {
    await assertTaskAssigneeInOrg(context.db, orgId, parsed.data.assignee_id);
  }

  const update: Record<string, unknown> = {};
  if (parsed.data.title !== undefined) update.title = parsed.data.title.trim();
  if (parsed.data.description !== undefined) update.description = toNullableText(parsed.data.description);
  if (parsed.data.matter_id !== undefined) update.matter_id = parsed.data.matter_id;
  if (parsed.data.assignee_id !== undefined) {
    update.assignee_id = parsed.data.assignee_id === null ? null : parsed.data.assignee_id;
  }
  if (parsed.data.due_at !== undefined) update.due_at = parsed.data.due_at ? parsed.data.due_at : null;
  if (parsed.data.priority !== undefined) update.priority = parsed.data.priority;
  if (parsed.data.status !== undefined) update.status = parsed.data.status;

  const { data, error } = await context.db
    .from('tasks')
    .update(update)
    .eq('org_id', orgId)
    .eq('id', id)
    .select('id')
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error('not_found');
  }

  const task = await getTaskRow(context.db, orgId, String((data as { id: string }).id));
  if (!task) {
    throw new Error('not_found');
  }

  return normalizeTaskRow(task);
}

export async function deleteOfficeTask(context: MobileAppSessionContext, id: string) {
  const orgId = context.org?.id;
  if (!orgId) {
    throw new Error('missing_org');
  }

  if (context.role !== 'owner') {
    throw new Error('not_allowed');
  }

  await context.db.rpc('delete_task_cascade', {
    p_org_id: orgId,
    p_actor_id: context.user.id,
    p_task_id: id,
  });
}

function collectPrivateMatterMemberIds(...userIds: Array<string | null | undefined>) {
  const unique = new Set<string>();
  for (const userId of userIds) {
    const normalized = String(userId ?? '').trim();
    if (isUuidLike(normalized)) {
      unique.add(normalized);
    }
  }
  return [...unique];
}

function isMatterMemberForeignKeyViolation(error: unknown) {
  const text = getErrorText(error).toLowerCase();
  return (
    text.includes('matter_members_user_id_fkey') ||
    (text.includes('matter_members') && text.includes('foreign key'))
  );
}

function containsArabicText(value: string) {
  return /[\u0600-\u06ff]/.test(value);
}

function isMissingColumnError(error: unknown, table: string, column: string) {
  const message = getErrorText(error);
  if (!message) return false;
  const normalized = message.toLowerCase();
  const tableName = table.toLowerCase();
  const columnName = column.toLowerCase();

  return (
    normalized.includes(`column "${columnName}" of relation "${tableName}" does not exist`) ||
    normalized.includes(`column ${tableName}.${columnName} does not exist`) ||
    normalized.includes(`column "${tableName}"."${columnName}" does not exist`) ||
    normalized.includes(`could not find the '${columnName}' column of '${tableName}' in the schema cache`) ||
    (
      normalized.includes(`column "${columnName}" does not exist`) &&
      (normalized.includes(`relation "${tableName}"`) || normalized.includes(`${tableName}.`))
    )
  );
}
