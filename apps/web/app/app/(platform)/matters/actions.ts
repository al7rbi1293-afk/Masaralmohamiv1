'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { archiveMatter, createMatter, restoreMatter, updateMatter } from '@/lib/matters';
import { createMatterEvent, createMatterEventSchema } from '@/lib/matterEvents';
import { logError, logInfo } from '@/lib/logger';

const matterSchema = z.object({
  title: z.string().trim().min(2, 'العنوان مطلوب ويجب أن لا يقل عن حرفين.').max(200, 'العنوان طويل جدًا.'),
  client_id: z.string().uuid('يرجى اختيار الموكل.'),
  status: z.enum(['new', 'in_progress', 'on_hold', 'closed', 'archived']),
  summary: z.string().trim().max(5000, 'الملخص طويل جدًا.').optional().or(z.literal('')),
  is_private: z.boolean(),
});

export async function createMatterAction(formData: FormData) {
  const parsed = matterSchema.safeParse(toPayload(formData));
  if (!parsed.success) {
    redirect(
      `/app/matters/new?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? 'تعذر الحفظ. حاول مرة أخرى.')}`,
    );
  }

  try {
    const created = await createMatter(normalize(parsed.data));
    logInfo('matter_created', { matterId: created.id });
    redirect(`/app/matters/${created.id}?success=${encodeURIComponent('تم إنشاء القضية.')}`);
  } catch (error) {
    const message = toUserMessage(error);
    logError('matter_create_failed', { message });
    redirect(`/app/matters/new?error=${encodeURIComponent(message)}`);
  }
}

export async function updateMatterAction(id: string, formData: FormData) {
  const parsed = matterSchema.safeParse(toPayload(formData));
  if (!parsed.success) {
    redirect(
      `/app/matters/${id}?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? 'تعذر الحفظ. حاول مرة أخرى.')}`,
    );
  }

  try {
    await updateMatter(id, normalize(parsed.data));
    logInfo('matter_updated', { matterId: id });
    redirect(`/app/matters/${id}?success=${encodeURIComponent('تم تحديث القضية.')}`);
  } catch (error) {
    const message = toUserMessage(error);
    logError('matter_update_failed', { matterId: id, message });
    redirect(`/app/matters/${id}?error=${encodeURIComponent(message)}`);
  }
}

export async function archiveMatterAction(id: string, redirectTo = '/app/matters') {
  try {
    await archiveMatter(id);
    logInfo('matter_archived', { matterId: id });
    redirect(withToast(redirectTo, 'success', 'تمت أرشفة القضية.'));
  } catch (error) {
    const message = toUserMessage(error);
    logError('matter_archive_failed', { matterId: id, message });
    redirect(withToast(redirectTo, 'error', message));
  }
}

export async function restoreMatterAction(id: string, redirectTo = '/app/matters') {
  try {
    await restoreMatter(id);
    logInfo('matter_restored', { matterId: id });
    redirect(withToast(redirectTo, 'success', 'تمت استعادة القضية.'));
  } catch (error) {
    const message = toUserMessage(error);
    logError('matter_restore_failed', { matterId: id, message });
    redirect(withToast(redirectTo, 'error', message));
  }
}

export async function createMatterEventAction(matterId: string, formData: FormData) {
  const parsed = createMatterEventSchema.safeParse(toEventPayload(formData));
  if (!parsed.success) {
    redirect(
      `/app/matters/${matterId}?tab=timeline&error=${encodeURIComponent(
        parsed.error.issues[0]?.message ?? 'تعذر إضافة الحدث.',
      )}`,
    );
  }

  try {
    const created = await createMatterEvent(matterId, {
      type: parsed.data.type,
      note: emptyToNull(parsed.data.note),
      event_date: emptyToNull(parsed.data.event_date),
    });
    logInfo('matter_event_created', { matterId, type: created.type });
    redirect(`/app/matters/${matterId}?tab=timeline&success=${encodeURIComponent('تمت إضافة الحدث.')}`);
  } catch (error) {
    const message = toEventUserMessage(error);
    logError('matter_event_create_failed', { matterId, message });
    redirect(`/app/matters/${matterId}?tab=timeline&error=${encodeURIComponent(message)}`);
  }
}

function toPayload(formData: FormData) {
  return {
    title: String(formData.get('title') ?? ''),
    client_id: String(formData.get('client_id') ?? ''),
    status: String(formData.get('status') ?? 'new'),
    summary: String(formData.get('summary') ?? ''),
    is_private: formData.get('is_private') === 'on',
  };
}

function toEventPayload(formData: FormData) {
  return {
    type: String(formData.get('type') ?? 'note'),
    note: String(formData.get('note') ?? ''),
    event_date: String(formData.get('event_date') ?? ''),
  };
}

function normalize(data: z.infer<typeof matterSchema>) {
  return {
    title: data.title.trim(),
    client_id: data.client_id,
    status: data.status,
    summary: emptyToNull(data.summary),
    is_private: data.is_private,
  };
}

function emptyToNull(value?: string) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
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
    return 'لا تملك صلاحية لهذا الإجراء.';
  }

  if (normalized.includes('client_not_found')) {
    return 'تعذر الحفظ. حاول مرة أخرى.';
  }

  if (message.includes('لا يوجد مكتب مفعّل')) {
    return message;
  }

  return 'تعذر الحفظ. حاول مرة أخرى.';
}

function withToast(path: string, key: 'success' | 'error', message: string) {
  const [pathname] = path.split('?');
  return `${pathname}?${key}=${encodeURIComponent(message)}`;
}

function toEventUserMessage(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  const normalized = message.toLowerCase();

  if (
    normalized.includes('permission denied') ||
    normalized.includes('not allowed') ||
    normalized.includes('violates row-level security') ||
    normalized.includes('not_found') ||
    normalized.includes('no rows')
  ) {
    return 'لا تملك صلاحية إضافة أحداث لهذه القضية.';
  }

  return 'تعذر إضافة الحدث.';
}
