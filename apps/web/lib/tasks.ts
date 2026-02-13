import 'server-only';

import { z } from 'zod';
import { createSupabaseServerRlsClient } from '@/lib/supabase/server';
import { getCurrentAuthUser } from '@/lib/supabase/auth-session';
import { requireOrgIdForUser } from '@/lib/org';

export type TaskPriority = 'low' | 'medium' | 'high';
export type TaskStatus = 'todo' | 'doing' | 'done' | 'canceled';
export type TaskDueFilter = 'overdue' | 'today' | 'week' | 'all';
export type TaskAssigneeFilter = 'me' | 'unassigned' | 'any';

export type TaskMatter = {
  id: string;
  title: string;
};

export type Task = {
  id: string;
  org_id: string;
  matter_id: string | null;
  title: string;
  description: string | null;
  assignee_id: string | null;
  due_at: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
  matter: TaskMatter | null;
};

type TaskRow = Omit<Task, 'matter'> & {
  matter: TaskMatter | TaskMatter[] | null;
};

export type PaginatedResult<T> = {
  data: T[];
  page: number;
  limit: number;
  total: number;
};

export type ListTasksParams = {
  q?: string;
  status?: TaskStatus | 'all';
  priority?: TaskPriority | 'all';
  due?: TaskDueFilter;
  assignee?: TaskAssigneeFilter;
  matterId?: string;
  page?: number;
  limit?: number;
};

const TASK_SELECT =
  'id, org_id, matter_id, title, description, assignee_id, due_at, priority, status, created_by, created_at, updated_at, matter:matters(id, title)';

export async function listTasks(params: ListTasksParams = {}): Promise<PaginatedResult<Task>> {
  const orgId = await requireOrgIdForUser();
  const supabase = createSupabaseServerRlsClient();

  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(50, Math.max(5, params.limit ?? 20));
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const status = params.status ?? 'all';
  const priority = params.priority ?? 'all';
  const due = params.due ?? 'all';
  const assignee = params.assignee ?? 'any';
  const q = cleanQuery(params.q);
  const matterId = params.matterId?.trim();

  let query = supabase
    .from('tasks')
    .select(TASK_SELECT, { count: 'exact' })
    .eq('org_id', orgId)
    .order('due_at', { ascending: true, nullsFirst: false })
    .order('updated_at', { ascending: false })
    .range(from, to);

  if (matterId) {
    query = query.eq('matter_id', matterId);
  }

  if (status !== 'all') {
    query = query.eq('status', status);
  }

  if (priority !== 'all') {
    query = query.eq('priority', priority);
  }

  if (q) {
    const pattern = `%${q}%`;
    query = query.or(`title.ilike.${pattern},description.ilike.${pattern}`);
  }

  query = applyDueFilter(query, due);
  query = await applyAssigneeFilter(query, assignee);

  const { data, error, count } = await query;
  if (error) {
    throw error;
  }

  return {
    data: ((data as TaskRow[] | null) ?? []).map(normalizeTask),
    page,
    limit,
    total: count ?? 0,
  };
}

export async function getTaskById(id: string): Promise<Task | null> {
  const orgId = await requireOrgIdForUser();
  const supabase = createSupabaseServerRlsClient();

  const { data, error } = await supabase
    .from('tasks')
    .select(TASK_SELECT)
    .eq('org_id', orgId)
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? normalizeTask(data as TaskRow) : null;
}

const createTaskSchema = z.object({
  title: z
    .string()
    .trim()
    .min(2, 'عنوان المهمة مطلوب ويجب أن لا يقل عن حرفين.')
    .max(200, 'عنوان المهمة طويل جدًا.'),
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

export type CreateTaskPayload = z.input<typeof createTaskSchema>;

export async function createTask(payload: CreateTaskPayload): Promise<Task> {
  const parsed = createTaskSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? 'تعذر الحفظ. حاول مرة أخرى.');
  }

  const orgId = await requireOrgIdForUser();
  const currentUser = await getCurrentAuthUser();
  if (!currentUser) {
    throw new Error('not_authenticated');
  }

  const supabase = createSupabaseServerRlsClient();

  const assigneeIdRaw = emptyToNull(parsed.data.assignee_id);
  const assigneeId = parsed.data.assignee_id === null ? null : assigneeIdRaw ?? currentUser.id;

  const { data, error } = await supabase
    .from('tasks')
    .insert({
      org_id: orgId,
      matter_id: emptyToNull(parsed.data.matter_id),
      title: parsed.data.title.trim(),
      description: emptyToNull(parsed.data.description ?? null),
      assignee_id: assigneeId,
      due_at: emptyToNull(parsed.data.due_at ?? null),
      priority: parsed.data.priority ?? 'medium',
      status: parsed.data.status ?? 'todo',
      created_by: currentUser.id,
    })
    .select(TASK_SELECT)
    .single();

  if (error || !data) {
    throw error ?? new Error('تعذر إنشاء المهمة.');
  }

  return normalizeTask(data as TaskRow);
}

const updateTaskSchema = createTaskSchema.partial().extend({
  title: z
    .string()
    .trim()
    .min(2, 'عنوان المهمة مطلوب ويجب أن لا يقل عن حرفين.')
    .max(200, 'عنوان المهمة طويل جدًا.'),
});

export type UpdateTaskPayload = z.input<typeof updateTaskSchema>;

export async function updateTask(id: string, payload: UpdateTaskPayload): Promise<Task> {
  const parsed = updateTaskSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? 'تعذر الحفظ. حاول مرة أخرى.');
  }

  const orgId = await requireOrgIdForUser();
  const supabase = createSupabaseServerRlsClient();

  const update: Record<string, unknown> = {
    title: parsed.data.title.trim(),
  };

  if (parsed.data.description !== undefined) update.description = emptyToNull(parsed.data.description ?? null);
  if (parsed.data.matter_id !== undefined) update.matter_id = emptyToNull(parsed.data.matter_id ?? null);
  if (parsed.data.assignee_id !== undefined) update.assignee_id = emptyToNull(parsed.data.assignee_id ?? null);
  if (parsed.data.due_at !== undefined) update.due_at = emptyToNull(parsed.data.due_at ?? null);
  if (parsed.data.priority !== undefined) update.priority = parsed.data.priority;
  if (parsed.data.status !== undefined) update.status = parsed.data.status;

  const { data, error } = await supabase
    .from('tasks')
    .update(update)
    .eq('org_id', orgId)
    .eq('id', id)
    .select(TASK_SELECT)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error('not_found');
  }

  return normalizeTask(data as TaskRow);
}

const setTaskStatusSchema = z.object({
  status: z.enum(['todo', 'doing', 'done', 'canceled']),
});

export type SetTaskStatusPayload = z.input<typeof setTaskStatusSchema>;

export async function setTaskStatus(id: string, payload: SetTaskStatusPayload): Promise<Task> {
  const parsed = setTaskStatusSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? 'تعذر الحفظ. حاول مرة أخرى.');
  }

  const orgId = await requireOrgIdForUser();
  const supabase = createSupabaseServerRlsClient();

  const { data, error } = await supabase
    .from('tasks')
    .update({ status: parsed.data.status })
    .eq('org_id', orgId)
    .eq('id', id)
    .select(TASK_SELECT)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error('not_found');
  }

  return normalizeTask(data as TaskRow);
}

function normalizeTask(value: TaskRow): Task {
  const rawMatter = value.matter;
  const matter = Array.isArray(rawMatter) ? rawMatter[0] ?? null : rawMatter ?? null;

  return {
    ...value,
    matter,
  };
}

function emptyToNull(value?: string | null) {
  if (value === null) return null;
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function cleanQuery(value?: string) {
  if (!value) return '';
  return value.replaceAll(',', ' ').trim().slice(0, 120);
}

function applyDueFilter(
  query: any,
  due: TaskDueFilter,
) {
  const now = new Date();

  if (due === 'overdue') {
    return query.not('due_at', 'is', null).lt('due_at', now.toISOString());
  }

  if (due === 'today') {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return query.not('due_at', 'is', null).gte('due_at', start.toISOString()).lt('due_at', end.toISOString());
  }

  if (due === 'week') {
    const end = new Date(now);
    end.setDate(end.getDate() + 7);
    return query.not('due_at', 'is', null).gte('due_at', now.toISOString()).lt('due_at', end.toISOString());
  }

  return query;
}

async function applyAssigneeFilter(query: any, assignee: TaskAssigneeFilter) {
  if (assignee === 'any') {
    return query;
  }

  if (assignee === 'unassigned') {
    return query.is('assignee_id', null);
  }

  const currentUser = await getCurrentAuthUser();
  if (!currentUser) {
    throw new Error('not_authenticated');
  }

  return query.eq('assignee_id', currentUser.id);
}

