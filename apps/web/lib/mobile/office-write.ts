import 'server-only';

import { z } from 'zod';
import type { MobileAppSessionContext } from '@/lib/mobile/auth';

const clientSchema = z.object({
  type: z.enum(['person', 'company']).default('person'),
  name: z.string().trim().min(2, 'اسم العميل مطلوب.').max(200, 'اسم العميل طويل جدًا.'),
  identity_no: z.string().trim().max(50, 'رقم الهوية طويل جدًا.').optional().nullable(),
  commercial_no: z.string().trim().max(50, 'رقم السجل طويل جدًا.').optional().nullable(),
  email: z
    .string()
    .trim()
    .email('البريد الإلكتروني غير صحيح.')
    .max(255, 'البريد الإلكتروني طويل جدًا.')
    .optional()
    .nullable(),
  phone: z.string().trim().max(50, 'رقم الجوال طويل جدًا.').optional().nullable(),
  notes: z.string().trim().max(4000, 'الملاحظات طويلة جدًا.').optional().nullable(),
  address: z.string().trim().max(1000, 'العنوان طويل جدًا.').optional().nullable(),
  status: z.enum(['active', 'archived']).optional(),
});

const matterSchema = z.object({
  client_id: z.string().uuid('العميل غير صالح.').nullable().optional(),
  title: z.string().trim().min(2, 'عنوان القضية مطلوب.').max(200, 'عنوان القضية طويل جدًا.'),
  status: z.enum(['new', 'in_progress', 'on_hold', 'closed', 'archived']).optional(),
  summary: z.string().trim().max(4000, 'الملخص طويل جدًا.').optional().nullable(),
  najiz_case_number: z.string().trim().max(100, 'رقم ناجز طويل جدًا.').optional().nullable(),
  case_type: z.string().trim().max(120, 'نوع القضية طويل جدًا.').optional().nullable(),
  claims: z.string().trim().max(4000, 'المطالبات طويلة جدًا.').optional().nullable(),
  assigned_user_id: z.string().uuid('المستخدم المسند إليه غير صالح.').optional().nullable(),
  is_private: z.boolean().optional(),
});

const taskSchema = z.object({
  title: z.string().trim().min(2, 'عنوان المهمة مطلوب.').max(200, 'عنوان المهمة طويل جدًا.'),
  description: z.string().trim().max(4000, 'الوصف طويل جدًا.').optional().nullable(),
  matter_id: z.string().uuid('القضية غير صالحة.').optional().nullable(),
  assignee_id: z.string().uuid('المستخدم المسند إليه غير صالح.').optional().nullable(),
  due_at: z
    .string()
    .trim()
    .optional()
    .nullable()
    .refine((value) => !value || !Number.isNaN(Date.parse(value)), {
      message: 'تاريخ الاستحقاق غير صحيح.',
    }),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  status: z.enum(['todo', 'doing', 'done', 'canceled']).optional(),
  is_archived: z.boolean().optional(),
});

type ClientInput = z.input<typeof clientSchema>;
type MatterInput = z.input<typeof matterSchema>;
type TaskInput = z.input<typeof taskSchema>;

function normalizeText(value: string | null | undefined) {
  const normalized = String(value ?? '').trim();
  return normalized || null;
}

function ensureOfficeContext(context: MobileAppSessionContext) {
  if (!context.hasOfficeAccess || !context.org?.id) {
    throw new Error('لا تملك صلاحية الوصول إلى المكتب.');
  }

  return context.org.id;
}

function ensureEditor(context: MobileAppSessionContext) {
  ensureOfficeContext(context);
  if (context.isAdmin || context.role === 'owner' || context.role === 'lawyer' || context.role === 'assistant') {
    return;
  }

  throw new Error('لا تملك صلاحية تنفيذ هذا الإجراء.');
}

function ensureManager(context: MobileAppSessionContext) {
  ensureOfficeContext(context);
  if (context.isAdmin || context.role === 'owner') {
    return;
  }

  throw new Error('لا تملك صلاحية تنفيذ هذا الإجراء.');
}

async function assertClientInOrg(context: MobileAppSessionContext, clientId: string) {
  const orgId = ensureOfficeContext(context);
  const { data, error } = await context.db
    .from('clients')
    .select('id')
    .eq('org_id', orgId)
    .eq('id', clientId)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error('العميل غير موجود.');
}

async function assertUserInOrg(context: MobileAppSessionContext, userId: string) {
  const orgId = ensureOfficeContext(context);
  const { data, error } = await context.db
    .from('memberships')
    .select('user_id')
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error('المستخدم غير موجود داخل المكتب.');
}

async function assertMatterInOrg(context: MobileAppSessionContext, matterId: string) {
  const orgId = ensureOfficeContext(context);
  const { data, error } = await context.db
    .from('matters')
    .select('id, assigned_user_id')
    .eq('org_id', orgId)
    .eq('id', matterId)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error('القضية غير موجودة.');
  return data as { id: string; assigned_user_id: string | null };
}

export async function listOfficeClients(
  context: MobileAppSessionContext,
  params: { q?: string | null; status?: 'active' | 'archived' | 'all' | null; page?: number; limit?: number } = {},
) {
  const orgId = ensureOfficeContext(context);
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(50, Math.max(5, params.limit ?? 20));
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  const q = String(params.q ?? '').trim();
  const status = params.status ?? 'active';

  let query = context.db
    .from('clients')
    .select(
      'id, org_id, type, name, identity_no, commercial_no, email, phone, notes, address, status, created_at, updated_at',
      { count: 'exact' },
    )
    .eq('org_id', orgId)
    .order('updated_at', { ascending: false })
    .range(from, to);

  if (status !== 'all') {
    query = query.eq('status', status);
  }

  if (q) {
    const pattern = `%${q}%`;
    query = query.or(`name.ilike.${pattern},email.ilike.${pattern},phone.ilike.${pattern}`);
  }

  const { data, error, count } = await query;
  if (error) throw error;

  return {
    data: (data ?? []).map((item) => ({
      id: String(item.id),
      org_id: String(item.org_id),
      type: String(item.type ?? 'person'),
      name: String(item.name ?? ''),
      identity_no: normalizeText(item.identity_no as string | null | undefined),
      commercial_no: normalizeText(item.commercial_no as string | null | undefined),
      email: normalizeText(item.email as string | null | undefined),
      phone: normalizeText(item.phone as string | null | undefined),
      notes: normalizeText(item.notes as string | null | undefined),
      address: normalizeText((item as Record<string, unknown>).address as string | null | undefined),
      status: String(item.status ?? 'active'),
      created_at: normalizeText(item.created_at as string | null | undefined),
      updated_at: normalizeText(item.updated_at as string | null | undefined),
    })),
    page,
    limit,
    total: count ?? 0,
  };
}

export async function getOfficeClient(context: MobileAppSessionContext, clientId: string) {
  const orgId = ensureOfficeContext(context);
  const { data, error } = await context.db
    .from('clients')
    .select('id, org_id, type, name, identity_no, commercial_no, email, phone, notes, address, status, created_at, updated_at')
    .eq('org_id', orgId)
    .eq('id', clientId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    id: String(data.id),
    org_id: String(data.org_id),
    type: String(data.type ?? 'person'),
    name: String(data.name ?? ''),
    identity_no: normalizeText(data.identity_no as string | null | undefined),
    commercial_no: normalizeText(data.commercial_no as string | null | undefined),
    email: normalizeText(data.email as string | null | undefined),
    phone: normalizeText(data.phone as string | null | undefined),
    notes: normalizeText(data.notes as string | null | undefined),
    address: normalizeText((data as Record<string, unknown>).address as string | null | undefined),
    status: String(data.status ?? 'active'),
    created_at: normalizeText(data.created_at as string | null | undefined),
    updated_at: normalizeText(data.updated_at as string | null | undefined),
  };
}

export async function createOfficeClient(context: MobileAppSessionContext, payload: ClientInput) {
  ensureEditor(context);
  const orgId = ensureOfficeContext(context);
  const parsed = clientSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? 'تعذر إنشاء العميل.');
  }

  const { data, error } = await context.db
    .from('clients')
    .insert({
      org_id: orgId,
      type: parsed.data.type,
      name: parsed.data.name,
      identity_no: normalizeText(parsed.data.identity_no),
      commercial_no: normalizeText(parsed.data.commercial_no),
      email: normalizeText(parsed.data.email)?.toLowerCase() ?? null,
      phone: normalizeText(parsed.data.phone),
      notes: normalizeText(parsed.data.notes),
      address: normalizeText(parsed.data.address),
      status: parsed.data.status ?? 'active',
    })
    .select('id, org_id, type, name, identity_no, commercial_no, email, phone, notes, address, status, created_at, updated_at')
    .single();

  if (error || !data) throw error ?? new Error('تعذر إنشاء العميل.');
  return getOfficeClient(context, String(data.id));
}

export async function updateOfficeClient(context: MobileAppSessionContext, clientId: string, payload: Partial<ClientInput>) {
  ensureEditor(context);
  const orgId = ensureOfficeContext(context);
  const parsed = clientSchema.partial().safeParse(payload);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? 'تعذر تحديث العميل.');
  }

  const update: Record<string, unknown> = {};
  if (parsed.data.type !== undefined) update.type = parsed.data.type;
  if (parsed.data.name !== undefined) update.name = parsed.data.name;
  if (parsed.data.identity_no !== undefined) update.identity_no = normalizeText(parsed.data.identity_no);
  if (parsed.data.commercial_no !== undefined) update.commercial_no = normalizeText(parsed.data.commercial_no);
  if (parsed.data.email !== undefined) update.email = normalizeText(parsed.data.email)?.toLowerCase() ?? null;
  if (parsed.data.phone !== undefined) update.phone = normalizeText(parsed.data.phone);
  if (parsed.data.notes !== undefined) update.notes = normalizeText(parsed.data.notes);
  if (parsed.data.address !== undefined) update.address = normalizeText(parsed.data.address);
  if (parsed.data.status !== undefined) update.status = parsed.data.status;

  const { data, error } = await context.db
    .from('clients')
    .update(update)
    .eq('org_id', orgId)
    .eq('id', clientId)
    .select('id')
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error('العميل غير موجود.');

  return getOfficeClient(context, clientId);
}

export async function deleteOfficeClient(context: MobileAppSessionContext, clientId: string) {
  ensureManager(context);
  const orgId = ensureOfficeContext(context);
  const { error } = await context.db.from('clients').delete().eq('org_id', orgId).eq('id', clientId);
  if (error) throw error;
}

export async function createOfficeMatter(context: MobileAppSessionContext, payload: MatterInput) {
  ensureEditor(context);
  const orgId = ensureOfficeContext(context);
  const parsed = matterSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? 'تعذر إنشاء القضية.');
  }

  const clientId = normalizeText(parsed.data.client_id);
  const assignedUserId = normalizeText(parsed.data.assigned_user_id) ?? context.user.id;
  if (clientId) await assertClientInOrg(context, clientId);
  if (assignedUserId) await assertUserInOrg(context, assignedUserId);

  const { data, error } = await context.db
    .from('matters')
    .insert({
      org_id: orgId,
      client_id: clientId,
      title: parsed.data.title,
      status: parsed.data.status ?? 'new',
      summary: normalizeText(parsed.data.summary),
      najiz_case_number: normalizeText(parsed.data.najiz_case_number),
      case_type: normalizeText(parsed.data.case_type),
      claims: normalizeText(parsed.data.claims),
      assigned_user_id: assignedUserId,
      is_private: Boolean(parsed.data.is_private),
    })
    .select('id')
    .single();

  if (error || !data) throw error ?? new Error('تعذر إنشاء القضية.');

  if (parsed.data.is_private) {
    const memberIds = Array.from(new Set([context.user.id, assignedUserId].filter(Boolean)));
    if (memberIds.length) {
      await context.db.from('matter_members').upsert(memberIds.map((userId) => ({ matter_id: String(data.id), user_id: userId })));
    }
  }

  return data;
}

export async function updateOfficeMatter(context: MobileAppSessionContext, matterId: string, payload: Partial<MatterInput>) {
  ensureEditor(context);
  const orgId = ensureOfficeContext(context);
  const parsed = matterSchema.partial().safeParse(payload);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? 'تعذر تحديث القضية.');
  }

  const existing = await assertMatterInOrg(context, matterId);
  const update: Record<string, unknown> = {};
  const clientId = parsed.data.client_id !== undefined ? normalizeText(parsed.data.client_id) : undefined;
  const assignedUserId =
    parsed.data.assigned_user_id !== undefined ? normalizeText(parsed.data.assigned_user_id) : undefined;

  if (clientId) await assertClientInOrg(context, clientId);
  if (assignedUserId) await assertUserInOrg(context, assignedUserId);

  if (parsed.data.title !== undefined) update.title = parsed.data.title;
  if (parsed.data.status !== undefined) update.status = parsed.data.status;
  if (parsed.data.summary !== undefined) update.summary = normalizeText(parsed.data.summary);
  if (parsed.data.najiz_case_number !== undefined) update.najiz_case_number = normalizeText(parsed.data.najiz_case_number);
  if (parsed.data.case_type !== undefined) update.case_type = normalizeText(parsed.data.case_type);
  if (parsed.data.claims !== undefined) update.claims = normalizeText(parsed.data.claims);
  if (parsed.data.client_id !== undefined) update.client_id = clientId;
  if (parsed.data.assigned_user_id !== undefined) update.assigned_user_id = assignedUserId;
  if (parsed.data.is_private !== undefined) update.is_private = parsed.data.is_private;

  const { data, error } = await context.db
    .from('matters')
    .update(update)
    .eq('org_id', orgId)
    .eq('id', matterId)
    .select('id, assigned_user_id, is_private')
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error('القضية غير موجودة.');

  const isPrivate = Boolean((data as Record<string, unknown>).is_private ?? parsed.data.is_private ?? false);
  const finalAssignee = normalizeText((data as Record<string, unknown>).assigned_user_id as string | null | undefined) ?? existing.assigned_user_id ?? context.user.id;
  if (isPrivate) {
    const memberIds = Array.from(new Set([context.user.id, finalAssignee].filter(Boolean)));
    if (memberIds.length) {
      await context.db.from('matter_members').upsert(memberIds.map((userId) => ({ matter_id: matterId, user_id: userId })));
    }
  }

  return data;
}

export async function deleteOfficeMatter(context: MobileAppSessionContext, matterId: string) {
  ensureManager(context);
  const orgId = ensureOfficeContext(context);
  const { error } = await context.db.from('matters').delete().eq('org_id', orgId).eq('id', matterId);
  if (error) throw error;
}

export async function createOfficeTask(context: MobileAppSessionContext, payload: TaskInput) {
  ensureEditor(context);
  const orgId = ensureOfficeContext(context);
  const parsed = taskSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? 'تعذر إنشاء المهمة.');
  }

  const matterId = normalizeText(parsed.data.matter_id);
  const assigneeId = normalizeText(parsed.data.assignee_id) ?? context.user.id;
  if (matterId) await assertMatterInOrg(context, matterId);
  if (assigneeId) await assertUserInOrg(context, assigneeId);

  const { data, error } = await context.db
    .from('tasks')
    .insert({
      org_id: orgId,
      matter_id: matterId,
      title: parsed.data.title,
      description: normalizeText(parsed.data.description),
      assignee_id: assigneeId,
      due_at: normalizeText(parsed.data.due_at),
      priority: parsed.data.priority ?? 'medium',
      status: parsed.data.status ?? 'todo',
      created_by: context.user.id,
      is_archived: Boolean(parsed.data.is_archived ?? false),
    })
    .select('id')
    .single();

  if (error || !data) throw error ?? new Error('تعذر إنشاء المهمة.');
  return data;
}

export async function updateOfficeTask(context: MobileAppSessionContext, taskId: string, payload: Partial<TaskInput>) {
  ensureEditor(context);
  const orgId = ensureOfficeContext(context);
  const parsed = taskSchema.partial().safeParse(payload);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? 'تعذر تحديث المهمة.');
  }

  const update: Record<string, unknown> = {};
  const matterId = parsed.data.matter_id !== undefined ? normalizeText(parsed.data.matter_id) : undefined;
  const assigneeId = parsed.data.assignee_id !== undefined ? normalizeText(parsed.data.assignee_id) : undefined;
  if (matterId) await assertMatterInOrg(context, matterId);
  if (assigneeId) await assertUserInOrg(context, assigneeId);

  if (parsed.data.title !== undefined) update.title = parsed.data.title;
  if (parsed.data.description !== undefined) update.description = normalizeText(parsed.data.description);
  if (parsed.data.matter_id !== undefined) update.matter_id = matterId;
  if (parsed.data.assignee_id !== undefined) update.assignee_id = assigneeId;
  if (parsed.data.due_at !== undefined) update.due_at = normalizeText(parsed.data.due_at);
  if (parsed.data.priority !== undefined) update.priority = parsed.data.priority;
  if (parsed.data.status !== undefined) update.status = parsed.data.status;
  if (parsed.data.is_archived !== undefined) update.is_archived = parsed.data.is_archived;

  const { data, error } = await context.db
    .from('tasks')
    .update(update)
    .eq('org_id', orgId)
    .eq('id', taskId)
    .select('id')
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error('المهمة غير موجودة.');
  return data;
}

export async function deleteOfficeTask(context: MobileAppSessionContext, taskId: string) {
  ensureManager(context);
  const orgId = ensureOfficeContext(context);
  const { error } = await context.db.from('tasks').delete().eq('org_id', orgId).eq('id', taskId);
  if (error) throw error;
}
