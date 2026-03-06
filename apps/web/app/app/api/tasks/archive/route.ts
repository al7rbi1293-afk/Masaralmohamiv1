import { NextResponse } from 'next/server';
import { z } from 'zod';
import { logAudit } from '@/lib/audit';
import { logError, logInfo } from '@/lib/logger';
import { setTaskArchived } from '@/lib/tasks';
import { toUserMessage } from '@/lib/shared-utils';

const archiveTaskSchema = z.object({
  id: z.string().uuid(),
  archived: z.boolean(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = archiveTaskSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'تعذر تحديث المهمة.' },
        { status: 400 },
      );
    }

    const updated = await setTaskArchived(parsed.data.id, parsed.data.archived);
    await logAudit({
      action: parsed.data.archived ? 'task.archived' : 'task.restored',
      entityType: 'task',
      entityId: updated.id,
      meta: { changed: ['is_archived'] },
    });
    logInfo(parsed.data.archived ? 'task_archived' : 'task_restored', { taskId: updated.id });

    return NextResponse.json({ task: updated }, { status: 200 });
  } catch (error) {
    const message = toUserMessage(error, 'تعذر تحديث المهمة.');
    logError('task_archive_failed', { message });
    const status =
      message === 'لا تملك صلاحية لهذا الإجراء.'
        ? 403
        : message === 'العنصر غير موجود.'
          ? 404
          : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
