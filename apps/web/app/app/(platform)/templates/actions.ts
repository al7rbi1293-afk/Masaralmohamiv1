'use server';

import { redirect } from 'next/navigation';
import { setTemplateStatus } from '@/lib/templates';
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
    redirect(withToast(redirectTo, 'success', 'تمت استعادة القالب.'));
  } catch (error) {
    const message = toUserMessage(error);
    logError('template_restore_failed', { templateId: id, message });
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
  const [pathname] = path.split('?');
  return `${pathname}?${key}=${encodeURIComponent(message)}`;
}

