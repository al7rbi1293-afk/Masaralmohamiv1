import { NextResponse } from 'next/server';
import { z } from 'zod';
import { logAudit } from '@/lib/audit';
import { logError, logInfo } from '@/lib/logger';
import { deleteTask } from '@/lib/tasks';
import { toUserMessage } from '@/lib/shared-utils';

const deleteTaskSchema = z.object({
  id: z.string().uuid(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = deleteTaskSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'تعذر حذف المهمة.' },
        { status: 400 },
      );
    }

    await deleteTask(parsed.data.id);
    await logAudit({
      action: 'task.deleted',
      entityType: 'task',
      entityId: parsed.data.id,
      meta: {},
    });
    logInfo('task_deleted', { taskId: parsed.data.id });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    const message = toUserMessage(error, 'تعذر حذف المهمة.');
    logError('task_delete_failed', { message });
    const status =
      message === 'لا تملك صلاحية لهذا الإجراء.'
        ? 403
        : message === 'العنصر غير موجود.'
          ? 404
          : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
