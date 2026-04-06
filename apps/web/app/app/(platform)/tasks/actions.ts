'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { isRedirectError } from 'next/dist/client/components/redirect';
import { logAudit } from '@/lib/audit';
import { logError, logInfo } from '@/lib/logger';
import { deleteTask, setTaskArchived } from '@/lib/tasks';
import { toUserMessage } from '@/lib/shared-utils';

export async function archiveTaskAction(id: string, redirectTo = '/app/tasks') {
  try {
    await setTaskArchived(id, true);
    await logAudit({
      action: 'task.archived',
      entityType: 'task',
      entityId: id,
      meta: { changed: ['is_archived'] },
    });
    logInfo('task_archived', { taskId: id });
    revalidateTaskPaths(redirectTo);
    redirect(withToast(redirectTo, 'success', 'تمت أرشفة المهمة.'));
  } catch (error) {
    if (isRedirectError(error)) throw error;
    const message = toUserMessage(error, 'تعذر أرشفة المهمة.');
    logError('task_archive_failed', { taskId: id, message });
    redirect(withToast(redirectTo, 'error', message));
  }
}

export async function restoreTaskAction(id: string, redirectTo = '/app/tasks') {
  try {
    await setTaskArchived(id, false);
    await logAudit({
      action: 'task.restored',
      entityType: 'task',
      entityId: id,
      meta: { changed: ['is_archived'] },
    });
    logInfo('task_restored', { taskId: id });
    revalidateTaskPaths(redirectTo);
    redirect(withToast(redirectTo, 'success', 'تمت استعادة المهمة.'));
  } catch (error) {
    if (isRedirectError(error)) throw error;
    const message = toUserMessage(error, 'تعذر استعادة المهمة.');
    logError('task_restore_failed', { taskId: id, message });
    redirect(withToast(redirectTo, 'error', message));
  }
}

export async function deleteTaskAction(id: string, redirectTo = '/app/tasks') {
  try {
    await deleteTask(id);
    await logAudit({
      action: 'task.deleted',
      entityType: 'task',
      entityId: id,
      meta: {},
    });
    logInfo('task_deleted', { taskId: id });
    revalidateTaskPaths(redirectTo);
    redirect(withToast(redirectTo, 'success', 'تم حذف المهمة نهائيًا.'));
  } catch (error) {
    if (isRedirectError(error)) throw error;
    const message = toUserMessage(error, 'تعذر حذف المهمة.');
    logError('task_delete_failed', { taskId: id, message });
    redirect(withToast(redirectTo, 'error', message));
  }
}

function revalidateTaskPaths(redirectTo: string) {
  revalidatePath('/app/tasks');
  revalidatePath('/app/archive');
  const [redirectPath] = redirectTo.split('?');
  if (redirectPath.startsWith('/app/matters/')) {
    revalidatePath(redirectPath);
  }
}

function withToast(path: string, key: 'success' | 'error', message: string) {
  const [pathname, query = ''] = path.split('?');
  const params = new URLSearchParams(query);
  params.set(key, message);
  return `${pathname}?${params.toString()}`;
}
