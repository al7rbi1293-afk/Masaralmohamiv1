import { type AnnouncementSource, type TrialRecipientKind } from './bulk-messaging-types';

export function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('ar-SA');
}

export function sourceLabel(source: AnnouncementSource) {
  if (source === 'users') return 'مستخدم';
  if (source === 'offices') return 'مكتب';
  return 'مستخدم + مكتب';
}

export function trialRecipientKindActionLabel(kind: TrialRecipientKind) {
  if (kind === 'first-time') return 'رسائل أول إرسال';
  if (kind === 'reminder') return 'رسائل التذكير';
  return 'كل الرسائل';
}

export async function callBulkEmailApi<T>(payload: Record<string, unknown>) {
  const response = await fetch('/admin/api/bulk-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = (data as { error?: string }).error || 'تعذر تنفيذ العملية.';
    throw new Error(message);
  }

  return data as T;
}
