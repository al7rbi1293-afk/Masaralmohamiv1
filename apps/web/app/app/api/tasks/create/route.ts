import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createTask } from '@/lib/tasks';
import { logError, logInfo } from '@/lib/logger';

const createTaskRouteSchema = z.object({
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
    const parsed = createTaskRouteSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'تعذر إنشاء المهمة.' },
        { status: 400 },
      );
    }

    const created = await createTask(parsed.data);
    logInfo('task_created', { taskId: created.id, matterId: created.matter_id ?? null });

    return NextResponse.json({ task: created }, { status: 201 });
  } catch (error) {
    const message = toUserMessage(error);
    logError('task_create_failed', { message });
    return NextResponse.json({ error: message }, { status: message === 'لا تملك صلاحية لهذا الإجراء.' ? 403 : 400 });
  }
}

function toUserMessage(error: unknown) {
  const message = extractErrorMessage(error);
  const code = extractErrorCode(error);
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

  if (normalized.includes('not_authenticated')) {
    return 'يرجى تسجيل الدخول.';
  }

  if (code === '23503' && normalized.includes('tasks_') && normalized.includes('_fkey')) {
    return 'بيانات المستخدم غير متوافقة مع النظام الحالي. نفّذ آخر ترحيلات قاعدة البيانات ثم أعد المحاولة.';
  }

  return message || 'تعذر إنشاء المهمة.';
}

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  if (typeof error === 'object' && error && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') {
      return message;
    }
  }

  return '';
}

function extractErrorCode(error: unknown): string {
  if (typeof error === 'object' && error && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === 'string') {
      return code;
    }
  }
  return '';
}
