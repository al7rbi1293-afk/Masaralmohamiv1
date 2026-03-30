import type { OfficeCalendarItem, OfficeTask } from '../features/office/api';
import { formatDateTime } from '../lib/format';

export function matterTone(status: string) {
  if (status === 'in_progress' || status === 'doing') return 'success' as const;
  if (status === 'on_hold') return 'warning' as const;
  if (status === 'archived' || status === 'canceled') return 'danger' as const;
  return 'default' as const;
}

export function taskTone(task: OfficeTask) {
  if (task.status === 'done') return 'success' as const;
  if (task.is_overdue) return 'danger' as const;
  if (task.priority === 'high') return 'warning' as const;
  return 'default' as const;
}

export function billingTone(status: string) {
  if (status === 'paid' || status === 'accepted') return 'success' as const;
  if (status === 'partial' || status === 'sent' || status === 'draft') return 'warning' as const;
  if (status === 'void' || status === 'rejected') return 'danger' as const;
  return 'gold' as const;
}

export function notificationTone(category: string | null) {
  if (category === 'warning' || category === 'invoice_overdue') return 'warning' as const;
  if (category === 'danger' || category === 'error') return 'danger' as const;
  if (category === 'success') return 'success' as const;
  return 'gold' as const;
}

export function calendarTone(kind: OfficeCalendarItem['kind']) {
  if (kind === 'task') return 'warning' as const;
  if (kind === 'invoice') return 'gold' as const;
  if (kind === 'hearing') return 'danger' as const;
  return 'success' as const;
}

export function calendarKindLabel(kind: OfficeCalendarItem['kind']) {
  switch (kind) {
    case 'hearing':
      return 'جلسة';
    case 'meeting':
      return 'اجتماع';
    case 'task':
      return 'مهمة';
    case 'invoice':
      return 'فاتورة';
    default:
      return 'حدث';
  }
}

export function calendarItemSortValue(item: OfficeCalendarItem) {
  const raw = item.start_at || item.date || '';
  const timestamp = Date.parse(raw);
  return Number.isNaN(timestamp) ? Number.MAX_SAFE_INTEGER : timestamp;
}

export function calendarGroupKey(item: OfficeCalendarItem) {
  return (item.start_at || item.date || 'unknown').slice(0, 10);
}

export function calendarItemTimeLabel(item: OfficeCalendarItem) {
  const primary = item.start_at || item.date;
  if (!primary) return 'بدون موعد';
  if (item.end_at && item.end_at !== primary) {
    return `${formatDateTime(primary)} - ${formatDateTime(item.end_at)}`;
  }
  return formatDateTime(primary);
}

export type CalendarRangePreset = '7d' | '14d' | '30d' | '90d';

export function calendarRangeLabel(range: CalendarRangePreset) {
  switch (range) {
    case '7d':
      return '7 أيام';
    case '30d':
      return '30 يومًا';
    case '90d':
      return '90 يومًا';
    default:
      return '14 يومًا';
  }
}

export function buildCalendarQuery(range: CalendarRangePreset) {
  const from = new Date();
  const to = new Date(from.getTime());
  const rangeDays = range === '7d' ? 7 : range === '30d' ? 30 : range === '90d' ? 90 : 14;
  to.setDate(to.getDate() + rangeDays);
  return {
    from: from.toISOString(),
    to: to.toISOString(),
  };
}

export function officeRoleLabel(role: string | null) {
  switch (role) {
    case 'owner':
      return 'مالك المكتب';
    case 'admin':
      return 'إدارة المكتب';
    case 'lawyer':
      return 'محام';
    case 'assistant':
      return 'مساعد';
    default:
      return role || 'عضو فريق';
  }
}
