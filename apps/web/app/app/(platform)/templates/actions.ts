'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { deleteTemplate, setTemplateStatus } from '@/lib/templates';
import { logAudit } from '@/lib/audit';
import { logError, logInfo } from '@/lib/logger';

export async function archiveTemplateAction(id: string, redirectTo = '/app/templates') {
  try {
    await setTemplateStatus(id, 'archived');
    await logAudit({
      action: 'template.archived',
      entityType: 'template',
      entityId: id,
      meta: { changed: ['status'] },
    });
    logInfo('template_archived', { templateId: id });
    revalidatePath('/app/templates');
    revalidatePath(`/app/templates/${id}`);
    revalidatePath('/app/archive');
    redirect(withToast(redirectTo, 'success', 'تمت أرشفة القالب.'));
  } catch (error) {
    const message = toUserMessage(error);
    logError('template_archive_failed', { templateId: id, message });
    redirect(withToast(redirectTo, 'error', message));
  }
}

export async function restoreTemplateAction(id: string, redirectTo = '/app/templates') {
  try {
    await setTemplateStatus(id, 'active');
    await logAudit({
      action: 'template.restored',
      entityType: 'template',
      entityId: id,
      meta: { changed: ['status'] },
    });
    logInfo('template_restored', { templateId: id });
    revalidatePath('/app/templates');
    revalidatePath(`/app/templates/${id}`);
    revalidatePath('/app/archive');
    redirect(withToast(redirectTo, 'success', 'تمت استعادة القالب.'));
  } catch (error) {
    const message = toUserMessage(error);
    logError('template_restore_failed', { templateId: id, message });
    redirect(withToast(redirectTo, 'error', message));
  }
}

export async function deleteTemplateAction(id: string, redirectTo = '/app/templates') {
  try {
    await deleteTemplate(id);
    await logAudit({
      action: 'template.deleted',
      entityType: 'template',
      entityId: id,
      meta: {},
    });
    logInfo('template_deleted', { templateId: id });
    revalidatePath('/app/templates');
    revalidatePath(`/app/templates/${id}`);
    revalidatePath('/app/archive');
    redirect(withToast(redirectTo, 'success', 'تم حذف القالب نهائيًا.'));
  } catch (error) {
    const message = toUserMessage(error);
    logError('template_delete_failed', { templateId: id, message });
    redirect(withToast(redirectTo, 'error', message));
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
  if (normalized.includes('no rows') || normalized.includes('not found') || normalized.includes('not_found')) {
    return 'القالب غير موجود.';
  }
  return 'تعذر تنفيذ العملية. حاول مرة أخرى.';
}

function withToast(path: string, key: 'success' | 'error', message: string) {
  const [pathname, query = ''] = path.split('?');
  const params = new URLSearchParams(query);
  params.set(key, message);
  return `${pathname}?${params.toString()}`;
}
