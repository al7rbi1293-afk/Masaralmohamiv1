'use server';

import { z } from 'zod';
import { redirect } from 'next/navigation';
import { createSupabaseServerRlsClient } from '@/lib/supabase/server';
import { getCurrentOrgIdForUser } from '@/lib/org';
import { getCurrentAuthUser } from '@/lib/supabase/auth-session';
import { writeAuditLog } from '@/lib/audit';

const createTaskSchema = z.object({
  title: z.string().trim().min(1, 'يرجى إدخال عنوان المهمة.').max(200, 'العنوان طويل جدًا.'),
  description: z.string().trim().max(2000, 'الوصف طويل جدًا.').optional().or(z.literal('')),
  due_at: z.string().trim().optional().or(z.literal('')),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  matter_id: z.string().uuid().optional().or(z.literal('')),
});

function toText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
}

export async function createTaskAction(formData: FormData) {
  const [orgId, user] = await Promise.all([getCurrentOrgIdForUser(), getCurrentAuthUser()]);
  if (!orgId || !user) {
    redirect('/app');
  }

  const parsed = createTaskSchema.safeParse({
    title: toText(formData, 'title'),
    description: toText(formData, 'description'),
    due_at: toText(formData, 'due_at'),
    priority: toText(formData, 'priority'),
    matter_id: toText(formData, 'matter_id'),
  });

  if (!parsed.success) {
    redirect(`/app/tasks?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? 'تعذر التحقق من البيانات.')}`);
  }

  const supabase = createSupabaseServerRlsClient();
  const { data, error } = await supabase
    .from('tasks')
    .insert({
      org_id: orgId,
      matter_id: parsed.data.matter_id ? parsed.data.matter_id : null,
      title: parsed.data.title,
      description: emptyToNull(parsed.data.description),
      assignee_id: user.id,
      due_at: parsed.data.due_at ? new Date(parsed.data.due_at).toISOString() : null,
      priority: parsed.data.priority,
      status: 'todo',
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    redirect(`/app/tasks?error=${encodeURIComponent('تعذر إنشاء المهمة. حاول مرة أخرى.')}`);
  }

  await writeAuditLog({
    action: 'task_created',
    entityType: 'task',
    entityId: data.id,
  });

  redirect('/app/tasks?success=1');
}

export async function updateTaskStatusAction(taskId: string, status: 'todo' | 'doing' | 'done' | 'canceled') {
  const orgId = await getCurrentOrgIdForUser();
  if (!orgId) {
    redirect('/app');
  }

  const supabase = createSupabaseServerRlsClient();
  const { error } = await supabase
    .from('tasks')
    .update({ status })
    .eq('org_id', orgId)
    .eq('id', taskId);

  if (error) {
    redirect(`/app/tasks?error=${encodeURIComponent('تعذر تحديث المهمة.')}`);
  }

  await writeAuditLog({
    action: 'task_status_updated',
    entityType: 'task',
    entityId: taskId,
    meta: { status },
  });

  redirect('/app/tasks?success=1');
}

function emptyToNull(value?: string) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

