import { NextResponse } from 'next/server';
import { z } from 'zod';
import { setTaskStatus } from '@/lib/tasks';
import { logError, logInfo } from '@/lib/logger';

const setStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['todo', 'doing', 'done', 'canceled']),
});

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = setStatusSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'تعذر تغيير حالة المهمة.' },
        { status: 400 },
      );
    }

    const updated = await setTaskStatus(parsed.data.id, { status: parsed.data.status });
    logInfo('task_status_changed', { taskId: updated.id, status: updated.status });

    return NextResponse.json({ task: updated }, { status: 200 });
  } catch (error) {
    const message = toUserMessage(error);
    logError('task_status_change_failed', { message });
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

  return message || 'تعذر تغيير حالة المهمة.';
}

