'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { isRedirectError } from 'next/dist/client/components/redirect';
import { z } from 'zod';
import { createClient, getClientById, setClientStatus, updateClient, deleteClient } from '@/lib/clients';
import { logAudit } from '@/lib/audit';
import { logError, logInfo } from '@/lib/logger';
import { toUserMessage, emptyToNull, isValidUuid } from '@/lib/shared-utils';

const clientSchema = z.object({
  type: z.enum(['person', 'company']),
  name: z.string().trim().min(2, 'الاسم مطلوب ويجب أن لا يقل عن حرفين.').max(200, 'الاسم طويل جدًا.'),
  identity_no: z.string().trim().max(100, 'رقم الهوية طويل جدًا.').optional().or(z.literal('')),
  commercial_no: z.string().trim().max(100, 'رقم السجل التجاري طويل جدًا.').optional().or(z.literal('')),
  email: z
    .string()
    .trim()
    .max(255, 'البريد الإلكتروني طويل جدًا.')
    .optional()
    .or(z.literal(''))
    .refine((value) => !value || z.string().email().safeParse(value).success, {
      message: 'البريد الإلكتروني غير صحيح.',
    }),
  phone: z.string().trim().max(60, 'رقم الجوال طويل جدًا.').optional().or(z.literal('')),
  notes: z.string().trim().max(4000, 'الملاحظات طويلة جدًا.').optional().or(z.literal('')),
});

export async function createClientAction(formData: FormData) {
  const parsed = clientSchema.safeParse(toPayload(formData));
  if (!parsed.success) {
    redirect(`/app/clients/new?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? 'تعذر الحفظ. حاول مرة أخرى.')}`);
  }

  try {
    const created = await createClient(normalize(parsed.data));
    await logAudit({
      action: 'client.created',
      entityType: 'client',
      entityId: created.id,
      meta: { type: created.type },
    });
    logInfo('client_created', { clientId: created.id });
    revalidatePath('/app/clients');
    redirect(`/app/clients/${created.id}?success=${encodeURIComponent('تم إنشاء العميل.')}`);
  } catch (error) {
    if (isRedirectError(error)) throw error;
    const message = toUserMessage(error);
    logError('client_create_failed', { message });
    redirect(`/app/clients/new?error=${encodeURIComponent(message)}`);
  }
}

export async function updateClientAction(id: string, formData: FormData) {
  const parsed = clientSchema.safeParse(toPayload(formData));
  if (!parsed.success) {
    redirect(`/app/clients/${id}?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? 'تعذر الحفظ. حاول مرة أخرى.')}`);
  }

  try {
    const before = await getClientById(id).catch(() => null);
    const updated = await updateClient(id, normalize(parsed.data));

    const changed = diffClientFields(before, updated);
    await logAudit({
      action: 'client.updated',
      entityType: 'client',
      entityId: updated.id,
      meta: { changed },
    });

    logInfo('client_updated', { clientId: id });
    revalidatePath('/app/clients');
    revalidatePath(`/app/clients/${id}`);
    redirect(`/app/clients/${id}?success=${encodeURIComponent('تم تحديث بيانات العميل.')}`);
  } catch (error) {
    if (isRedirectError(error)) throw error;
    const message = toUserMessage(error);
    logError('client_update_failed', { clientId: id, message });
    redirect(`/app/clients/${id}?error=${encodeURIComponent(message)}`);
  }
}

export async function archiveClientAction(id: string, redirectTo = '/app/clients') {
  if (!isValidUuid(id)) {
    redirect(withToast(redirectTo, 'error', 'معرف العميل غير صالح.'));
  }
  try {
    await setClientStatus(id, 'archived');
    await logAudit({
      action: 'client.archived',
      entityType: 'client',
      entityId: id,
      meta: { changed: ['status'] },
    });
    logInfo('client_archived', { clientId: id });
    revalidatePath('/app/clients');
    redirect(withToast(redirectTo, 'success', 'تمت أرشفة العميل.'));
  } catch (error) {
    if (isRedirectError(error)) throw error;
    const message = toUserMessage(error);
    logError('client_archive_failed', { clientId: id, message });
    redirect(withToast(redirectTo, 'error', message));
  }
}

export async function restoreClientAction(id: string, redirectTo = '/app/clients') {
  if (!isValidUuid(id)) {
    redirect(withToast(redirectTo, 'error', 'معرف العميل غير صالح.'));
  }
  try {
    await setClientStatus(id, 'active');
    await logAudit({
      action: 'client.restored',
      entityType: 'client',
      entityId: id,
      meta: { changed: ['status'] },
    });
    logInfo('client_restored', { clientId: id });
    revalidatePath('/app/clients');
    redirect(withToast(redirectTo, 'success', 'تمت استعادة العميل.'));
  } catch (error) {
    if (isRedirectError(error)) throw error;
    const message = toUserMessage(error);
    logError('client_restore_failed', { clientId: id, message });
    redirect(withToast(redirectTo, 'error', message));
  }
}

export async function deleteClientAction(id: string, redirectTo = '/app/clients') {
  if (!isValidUuid(id)) {
    redirect(withToast(redirectTo, 'error', 'معرف العميل غير صالح.'));
  }
  try {
    await deleteClient(id);
    await logAudit({
      action: 'client.deleted',
      entityType: 'client',
      entityId: id,
      meta: {},
    });
    logInfo('client_deleted', { clientId: id });
    revalidatePath('/app/clients');
    redirect(withToast(redirectTo, 'success', 'تم حذف العميل بنجاح.'));
  } catch (error) {
    if (isRedirectError(error)) throw error;
    const message = toUserMessage(error);
    logError('client_delete_failed', { clientId: id, message });
    redirect(withToast(redirectTo, 'error', message));
  }
}

function toPayload(formData: FormData) {
  return {
    type: String(formData.get('type') ?? 'person'),
    name: String(formData.get('name') ?? ''),
    identity_no: String(formData.get('identity_no') ?? ''),
    commercial_no: String(formData.get('commercial_no') ?? ''),
    email: String(formData.get('email') ?? ''),
    phone: String(formData.get('phone') ?? ''),
    notes: String(formData.get('notes') ?? ''),
  };
}

function normalize(data: z.infer<typeof clientSchema>) {
  return {
    type: data.type,
    name: data.name.trim(),
    identity_no: emptyToNull(data.identity_no),
    commercial_no: emptyToNull(data.commercial_no),
    email: emptyToNull(data.email),
    phone: emptyToNull(data.phone),
    notes: emptyToNull(data.notes),
  };
}

function withToast(path: string, key: 'success' | 'error', message: string) {
  const [pathname] = path.split('?');
  return `${pathname}?${key}=${encodeURIComponent(message)}`;
}

function diffClientFields(before: Awaited<ReturnType<typeof getClientById>>, after: Awaited<ReturnType<typeof updateClient>>): string[] {
  if (!before || !after) return [];
  const keys = ['type', 'name', 'identity_no', 'commercial_no', 'email', 'phone', 'notes', 'status'] as const;
  const changed: string[] = [];
  for (const key of keys) {
    if ((before as any)[key] !== (after as any)[key]) changed.push(key);
  }
  return changed;
}

