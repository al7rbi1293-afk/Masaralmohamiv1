'use server';

import { z } from 'zod';
import { redirect } from 'next/navigation';
import { createSupabaseServerRlsClient } from '@/lib/supabase/server';
import { getCurrentOrgIdForUser } from '@/lib/org';
import { getCurrentAuthUser } from '@/lib/supabase/auth-session';
import { writeAuditLog } from '@/lib/audit';

const matterSchema = z.object({
  client_id: z.string().uuid('يرجى اختيار عميل صحيح.'),
  title: z.string().trim().min(1, 'يرجى إدخال عنوان القضية.').max(200, 'العنوان طويل جدًا.'),
  status: z
    .enum(['new', 'in_progress', 'on_hold', 'closed', 'archived'])
    .default('new'),
  summary: z.string().trim().max(4000, 'الملخص طويل جدًا.').optional().or(z.literal('')),
  is_private: z
    .union([z.literal('on'), z.literal('true'), z.literal('false'), z.literal('')])
    .optional(),
});

const eventSchema = z.object({
  type: z
    .enum(['hearing', 'call', 'note', 'email', 'meeting', 'other'])
    .default('note'),
  note: z.string().trim().max(4000, 'الملاحظة طويلة جدًا.').optional().or(z.literal('')),
  event_date: z.string().trim().optional().or(z.literal('')),
});

const taskSchema = z.object({
  title: z.string().trim().min(1, 'يرجى إدخال عنوان المهمة.').max(200, 'العنوان طويل جدًا.'),
  due_at: z.string().trim().optional().or(z.literal('')),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
});

function toText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
}

export async function createMatterAction(formData: FormData) {
  const [orgId, user] = await Promise.all([getCurrentOrgIdForUser(), getCurrentAuthUser()]);
  if (!orgId || !user) {
    redirect('/app');
  }

  const parsed = matterSchema.safeParse({
    client_id: toText(formData, 'client_id'),
    title: toText(formData, 'title'),
    status: toText(formData, 'status'),
    summary: toText(formData, 'summary'),
    is_private: toText(formData, 'is_private'),
  });

  if (!parsed.success) {
    redirect(`/app/matters/new?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? 'تعذر التحقق من البيانات.')}`);
  }

  const isPrivate = parsed.data.is_private === 'on' || parsed.data.is_private === 'true';

  const supabase = createSupabaseServerRlsClient();
  const { data, error } = await supabase
    .from('matters')
    .insert({
      org_id: orgId,
      client_id: parsed.data.client_id,
      title: parsed.data.title,
      status: parsed.data.status,
      summary: emptyToNull(parsed.data.summary),
      assigned_user_id: user.id,
      is_private: isPrivate,
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    redirect(`/app/matters/new?error=${encodeURIComponent('تعذر إنشاء القضية. حاول مرة أخرى.')}`);
  }

  if (isPrivate) {
    // Ensure the creator can see private matters by adding themselves as a member.
    await supabase.from('matter_members').insert({
      matter_id: data.id,
      user_id: user.id,
    });
  }

  await writeAuditLog({
    action: 'matter_created',
    entityType: 'matter',
    entityId: data.id,
    meta: { is_private: isPrivate },
  });

  redirect(`/app/matters/${data.id}`);
}

export async function updateMatterAction(matterId: string, formData: FormData) {
  const orgId = await getCurrentOrgIdForUser();
  if (!orgId) {
    redirect('/app');
  }

  const parsed = matterSchema.safeParse({
    client_id: toText(formData, 'client_id'),
    title: toText(formData, 'title'),
    status: toText(formData, 'status'),
    summary: toText(formData, 'summary'),
    is_private: toText(formData, 'is_private'),
  });

  if (!parsed.success) {
    redirect(`/app/matters/${matterId}?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? 'تعذر التحقق من البيانات.')}`);
  }

  const isPrivate = parsed.data.is_private === 'on' || parsed.data.is_private === 'true';

  const supabase = createSupabaseServerRlsClient();
  const { error } = await supabase
    .from('matters')
    .update({
      title: parsed.data.title,
      status: parsed.data.status,
      summary: emptyToNull(parsed.data.summary),
      is_private: isPrivate,
    })
    .eq('id', matterId)
    .eq('org_id', orgId);

  if (error) {
    redirect(`/app/matters/${matterId}?error=${encodeURIComponent('تعذر تحديث القضية. حاول مرة أخرى.')}`);
  }

  await writeAuditLog({
    action: 'matter_updated',
    entityType: 'matter',
    entityId: matterId,
  });

  redirect(`/app/matters/${matterId}?success=1`);
}

export async function addMatterEventAction(matterId: string, formData: FormData) {
  const [orgId, user] = await Promise.all([getCurrentOrgIdForUser(), getCurrentAuthUser()]);
  if (!orgId || !user) {
    redirect('/app');
  }

  const parsed = eventSchema.safeParse({
    type: toText(formData, 'type'),
    note: toText(formData, 'note'),
    event_date: toText(formData, 'event_date'),
  });

  if (!parsed.success) {
    redirect(`/app/matters/${matterId}?tab=timeline&error=${encodeURIComponent(parsed.error.issues[0]?.message ?? 'تعذر التحقق من البيانات.')}`);
  }

  const supabase = createSupabaseServerRlsClient();
  const { error } = await supabase.from('matter_events').insert({
    org_id: orgId,
    matter_id: matterId,
    type: parsed.data.type,
    note: emptyToNull(parsed.data.note),
    event_date: parsed.data.event_date ? new Date(parsed.data.event_date).toISOString() : null,
    created_by: user.id,
  });

  if (error) {
    redirect(`/app/matters/${matterId}?tab=timeline&error=${encodeURIComponent('تعذر إضافة الحدث. حاول مرة أخرى.')}`);
  }

  await writeAuditLog({
    action: 'matter_event_created',
    entityType: 'matter',
    entityId: matterId,
    meta: { type: parsed.data.type },
  });

  redirect(`/app/matters/${matterId}?tab=timeline&success=1`);
}

export async function addMatterTaskAction(matterId: string, formData: FormData) {
  const [orgId, user] = await Promise.all([getCurrentOrgIdForUser(), getCurrentAuthUser()]);
  if (!orgId || !user) {
    redirect('/app');
  }

  const parsed = taskSchema.safeParse({
    title: toText(formData, 'title'),
    due_at: toText(formData, 'due_at'),
    priority: toText(formData, 'priority'),
  });

  if (!parsed.success) {
    redirect(`/app/matters/${matterId}?tab=tasks&error=${encodeURIComponent(parsed.error.issues[0]?.message ?? 'تعذر التحقق من البيانات.')}`);
  }

  const supabase = createSupabaseServerRlsClient();
  const { error } = await supabase.from('tasks').insert({
    org_id: orgId,
    matter_id: matterId,
    title: parsed.data.title,
    due_at: parsed.data.due_at ? new Date(parsed.data.due_at).toISOString() : null,
    priority: parsed.data.priority,
    status: 'todo',
    assignee_id: user.id,
  });

  if (error) {
    redirect(`/app/matters/${matterId}?tab=tasks&error=${encodeURIComponent('تعذر إضافة المهمة. حاول مرة أخرى.')}`);
  }

  await writeAuditLog({
    action: 'task_created',
    entityType: 'task',
    entityId: null,
    meta: { matter_id: matterId },
  });

  redirect(`/app/matters/${matterId}?tab=tasks&success=1`);
}

function emptyToNull(value?: string) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}
