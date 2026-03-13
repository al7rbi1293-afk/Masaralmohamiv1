import 'server-only';

import { z } from 'zod';
import { createSupabaseServerRlsClient } from '@/lib/supabase/server';
import { requireOrgIdForUser } from '@/lib/org';
import { getCurrentAuthUser } from '@/lib/supabase/auth-session';
import { queueMatterEventReminderJobs } from '@/lib/calendar-reminders';

export const matterEventTypeSchema = z.enum([
  'hearing',
  'call',
  'note',
  'email',
  'meeting',
  'other',
]);

export type MatterEventType = z.infer<typeof matterEventTypeSchema>;

export type MatterEvent = {
  id: string;
  org_id: string;
  matter_id: string;
  type: MatterEventType;
  note: string | null;
  event_date: string | null;
  created_by: string;
  created_at: string;
};

export type ListMatterEventsParams = {
  type?: MatterEventType | 'all';
  page?: number;
  limit?: number;
};

export type PaginatedResult<T> = {
  data: T[];
  page: number;
  limit: number;
  total: number;
};

export const createMatterEventSchema = z.object({
  type: matterEventTypeSchema,
  note: z.string().trim().max(5000, 'الملاحظات طويلة جدًا.').optional().or(z.literal('')),
  event_date: z.string().trim().optional().or(z.literal('')),
});

export type CreateMatterEventPayload = {
  type: MatterEventType;
  note?: string | null;
  event_date?: string | null;
};

export async function listMatterEvents(
  matterId: string,
  params: ListMatterEventsParams = {},
): Promise<PaginatedResult<MatterEvent>> {
  const orgId = await requireOrgIdForUser();
  const supabase = createSupabaseServerRlsClient();

  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(50, Math.max(5, params.limit ?? 10));
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  const type = params.type ?? 'all';

  let query = supabase
    .from('matter_events')
    .select('id, org_id, matter_id, type, note, event_date, created_by, created_at', {
      count: 'exact',
    })
    .eq('org_id', orgId)
    .eq('matter_id', matterId)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (type !== 'all') {
    query = query.eq('type', type);
  }

  const { data, error, count } = await query;
  if (error) {
    throw error;
  }

  return {
    data: (data as MatterEvent[] | null) ?? [],
    page,
    limit,
    total: count ?? 0,
  };
}

export async function createMatterEvent(
  matterId: string,
  payload: CreateMatterEventPayload,
): Promise<MatterEvent> {
  const parsed = createMatterEventSchema.safeParse({
    type: payload.type,
    note: payload.note ?? '',
    event_date: payload.event_date ?? '',
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? 'تعذر إضافة الحدث.');
  }

  const orgId = await requireOrgIdForUser();
  const currentUser = await getCurrentAuthUser();

  if (!currentUser) {
    throw new Error('not_authenticated');
  }

  const supabase = createSupabaseServerRlsClient();

  const { data, error } = await supabase
    .from('matter_events')
    .insert({
      org_id: orgId,
      matter_id: matterId,
      type: parsed.data.type,
      note: emptyToNull(parsed.data.note),
      event_date: parseEventDate(parsed.data.event_date),
      created_by: currentUser.id,
    })
    .select('id, org_id, matter_id, type, note, event_date, created_by, created_at')
    .single();

  if (error && isCreatedByForeignKeyViolation(error)) {
    throw new Error('event_creator_not_found');
  }

  if (error || !data) {
    throw error ?? new Error('تعذر إضافة الحدث.');
  }

  const created = data as MatterEvent;

  if ((created.type === 'hearing' || created.type === 'meeting') && created.event_date) {
    try {
      await queueMatterEventReminderJobs(supabase, {
        orgId,
        matterEventId: created.id,
        matterId: created.matter_id,
        eventType: created.type,
        eventDate: created.event_date,
        createdBy: created.created_by,
      });
    } catch (reminderError) {
      console.error('Failed to schedule matter event reminder jobs', reminderError);
    }
  }

  return created;
}

function emptyToNull(value?: string) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function parseEventDate(value?: string) {
  const normalized = value?.trim();
  if (!normalized) return null;

  const date = new Date(normalizeDateTimeInput(normalized));
  if (Number.isNaN(date.getTime())) {
    throw new Error('التاريخ غير صالح.');
  }

  return date.toISOString();
}

function normalizeDateTimeInput(value: string) {
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
    return `${value}:00+03:00`;
  }

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(value)) {
    return `${value}+03:00`;
  }

  return value;
}

function isCreatedByForeignKeyViolation(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const maybeError = error as { message?: string; details?: string; hint?: string };
  const text = `${maybeError.message ?? ''} ${maybeError.details ?? ''} ${maybeError.hint ?? ''}`.toLowerCase();
  return text.includes('matter_events_created_by_fkey') ||
    (text.includes('created_by') && text.includes('foreign key'));
}
