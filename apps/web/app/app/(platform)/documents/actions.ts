'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { isRedirectError } from 'next/dist/client/components/redirect';
import { logAudit } from '@/lib/audit';
import { deleteDocument, setDocumentArchived } from '@/lib/documents';
import { logError, logInfo } from '@/lib/logger';
import { toUserMessage } from '@/lib/shared-utils';

export async function archiveDocumentAction(id: string, redirectTo = '/app/documents') {
  try {
    await setDocumentArchived(id, true);
    await logAudit({
      action: 'document.archived',
      entityType: 'document',
      entityId: id,
      meta: { changed: ['is_archived'] },
    });
    logInfo('document_archived', { documentId: id });
    revalidateDocumentPaths(id, redirectTo);
    redirect(withToast(redirectTo, 'success', 'تمت أرشفة المستند.'));
  } catch (error) {
    if (isRedirectError(error)) throw error;
    const message = toUserMessage(error, 'تعذر أرشفة المستند.');
    logError('document_archive_failed', { documentId: id, message });
    redirect(withToast(redirectTo, 'error', message));
  }
}

export async function restoreDocumentAction(id: string, redirectTo = '/app/documents') {
  try {
    await setDocumentArchived(id, false);
    await logAudit({
      action: 'document.restored',
      entityType: 'document',
      entityId: id,
      meta: { changed: ['is_archived'] },
    });
    logInfo('document_restored', { documentId: id });
    revalidateDocumentPaths(id, redirectTo);
    redirect(withToast(redirectTo, 'success', 'تمت استعادة المستند.'));
  } catch (error) {
    if (isRedirectError(error)) throw error;
    const message = toUserMessage(error, 'تعذر استعادة المستند.');
    logError('document_restore_failed', { documentId: id, message });
    redirect(withToast(redirectTo, 'error', message));
  }
}

export async function deleteDocumentAction(id: string, redirectTo = '/app/documents') {
  try {
    await deleteDocument(id);
    await logAudit({
      action: 'document.deleted',
      entityType: 'document',
      entityId: id,
      meta: {},
    });
    logInfo('document_deleted', { documentId: id });
    revalidateDocumentPaths(id, redirectTo);
    redirect(withToast(redirectTo, 'success', 'تم حذف المستند نهائيًا.'));
  } catch (error) {
    if (isRedirectError(error)) throw error;
    const message = toUserMessage(error, 'تعذر حذف المستند.');
    logError('document_delete_failed', { documentId: id, message });
    redirect(withToast(redirectTo, 'error', message));
  }
}

function revalidateDocumentPaths(id: string, redirectTo: string) {
  revalidatePath('/app/documents');
  revalidatePath(`/app/documents/${id}`);
  revalidatePath('/app/matters');
  const [redirectPath] = redirectTo.split('?');
  if (redirectPath.startsWith('/app/matters/')) {
    revalidatePath(redirectPath);
  }
}

function withToast(path: string, key: 'success' | 'error', message: string) {
  const [pathname] = path.split('?');
  return `${pathname}?${key}=${encodeURIComponent(message)}`;
}
