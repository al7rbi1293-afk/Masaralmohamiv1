import { NextResponse } from 'next/server';
import { z } from 'zod';
import { updateTask } from '@/lib/tasks';
import { logError, logInfo } from '@/lib/logger';

const updateTaskRouteSchema = z.object({
  id: z.string().uuid(),
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

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = updateTaskRouteSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'تعذر تحديث المهمة.' },
        { status: 400 },
      );
    }

    const updated = await updateTask(parsed.data.id, {
      title: parsed.data.title,
      description: parsed.data.description,
      matter_id: parsed.data.matter_id,
      assignee_id: parsed.data.assignee_id,
      due_at: parsed.data.due_at,
      priority: parsed.data.priority,
      status: parsed.data.status,
    });

    logInfo('task_updated', { taskId: updated.id, matterId: updated.matter_id ?? null });
    return NextResponse.json({ task: updated }, { status: 200 });
  } catch (error) {
    const message = toUserMessage(error);
    logError('task_update_failed', { message });
    const status =
      message === 'لا تملك صلاحية لهذا الإجراء.'
        ? 403
        : message === 'المهمة غير موجودة.'
          ? 404
          : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

function toUserMessage(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  const normalized = message.toLowerCase();

  if (message.includes('لا يوجد مكتب مفعّل')) {
    return message;
  }

  if (
    normalized.includes('permission denied') ||
    normalized.includes('not allowed') ||
    normalized.includes('violates row-level security')
  ) {
    return 'لا تملك صلاحية لهذا الإجراء.';
  }

  if (normalized.includes('not_found') || normalized.includes('no rows')) {
    return 'المهمة غير موجودة.';
  }

  return message || 'تعذر تحديث المهمة.';
}

