import 'server-only';

import { type SupabaseClient } from '@supabase/supabase-js';
import { getPublicSiteUrl, isSmtpConfigured } from '@/lib/env';
import { sendEmail } from '@/lib/email';
import { enrichOrgMembers } from '@/lib/matter-members';

const REMINDER_OFFSETS = [
  { label: '24h', offsetMs: 24 * 60 * 60 * 1000 },
  { label: '2h', offsetMs: 2 * 60 * 60 * 1000 },
] as const;

type ReminderJobInsert = {
  org_id: string;
  type: string;
  payload: Record<string, unknown>;
  run_at: string;
  status: 'queued';
};

export type NotificationJobRecord = {
  id: string;
  org_id: string;
  type: string;
  payload: Record<string, unknown> | null;
  run_at: string;
  status: string;
  created_at: string;
};

type ReminderEmailRecipient = {
  userId: string;
  name: string;
  email: string;
};

export async function queueMatterEventReminderJobs(
  adminClient: SupabaseClient,
  params: {
    orgId: string;
    matterEventId: string;
    matterId: string;
    eventType: 'hearing' | 'meeting';
    eventDate: string;
    createdBy: string;
  },
) {
  const jobs = buildReminderJobs({
    orgId: params.orgId,
    type: 'matter_event_reminder',
    startAt: params.eventDate,
    payload: {
      matter_event_id: params.matterEventId,
      matter_id: params.matterId,
      event_type: params.eventType,
      created_by: params.createdBy,
    },
  });

  if (!jobs.length) {
    return 0;
  }

  const { error } = await adminClient.from('notification_jobs').insert(jobs);
  if (error) {
    throw error;
  }

  return jobs.length;
}

export async function queueCalendarEventReminderJobs(
  adminClient: SupabaseClient,
  params: {
    orgId: string;
    eventId: string;
    startAt: string;
    createdBy: string;
  },
) {
  const jobs = buildReminderJobs({
    orgId: params.orgId,
    type: 'event_reminder',
    startAt: params.startAt,
    payload: {
      event_id: params.eventId,
      user_id: params.createdBy,
    },
  });

  if (!jobs.length) {
    return 0;
  }

  const { error } = await adminClient.from('notification_jobs').insert(jobs);
  if (error) {
    throw error;
  }

  return jobs.length;
}

export async function processCalendarReminderJob(
  adminClient: SupabaseClient,
  job: NotificationJobRecord,
) {
  if (job.type === 'event_reminder') {
    return sendStandaloneCalendarReminder(adminClient, job);
  }

  if (job.type === 'matter_event_reminder') {
    return sendMatterEventReminder(adminClient, job);
  }

  throw new Error(`unsupported_notification_job:${job.type}`);
}

function buildReminderJobs(params: {
  orgId: string;
  type: string;
  startAt: string;
  payload: Record<string, unknown>;
}) {
  const startDate = new Date(params.startAt);
  if (Number.isNaN(startDate.getTime())) {
    throw new Error('invalid_reminder_start_at');
  }

  return REMINDER_OFFSETS.map((entry): ReminderJobInsert | null => {
    const runAt = new Date(startDate.getTime() - entry.offsetMs);
    if (runAt.getTime() <= Date.now()) {
      return null;
    }

    return {
      org_id: params.orgId,
      type: params.type,
      payload: {
        ...params.payload,
        reminder_label: entry.label,
      },
      run_at: runAt.toISOString(),
      status: 'queued' as const,
    };
  }).filter((job): job is ReminderJobInsert => Boolean(job));
}

async function sendStandaloneCalendarReminder(
  adminClient: SupabaseClient,
  job: NotificationJobRecord,
) {
  const payload = asRecord(job.payload);
  const eventId = readRequiredString(payload, 'event_id');

  const [{ data: event, error: eventError }, { data: attendeeRows, error: attendeesError }] =
    await Promise.all([
      adminClient
        .from('calendar_events')
        .select('id, title, description, location, start_at, matter_id, created_by')
        .eq('org_id', job.org_id)
        .eq('id', eventId)
        .maybeSingle(),
      adminClient
        .from('event_attendees')
        .select('user_id')
        .eq('org_id', job.org_id)
        .eq('event_id', eventId),
    ]);

  if (eventError) {
    throw eventError;
  }
  if (attendeesError) {
    throw attendeesError;
  }
  if (!event) {
    return { kind: 'event_reminder', recipients: 0, skipped: true };
  }

  const recipientIds = uniqueStrings([
    String(event.created_by ?? ''),
    ...(((attendeeRows as any[]) ?? []).map((row) => String(row.user_id ?? ''))),
  ]);
  const recipients = await resolveRecipients(job.org_id, recipientIds);
  if (!recipients.length) {
    throw new Error('no_event_reminder_recipients');
  }

  const siteUrl = getPublicSiteUrl();
  const reminderLabel = toReminderCopy(readOptionalString(payload, 'reminder_label'));
  const startLabel = formatSaudiDateTime(String(event.start_at));
  const eventTitle = String(event.title ?? 'موعد');
  const detailUrl = event.matter_id
    ? `${siteUrl}/app/matters/${event.matter_id}`
    : `${siteUrl}/app/calendar?type=events`;

  const lines = [
    'مرحباً،',
    '',
    `هذا تذكير بموعد: ${eventTitle}`,
    `موعد التنبيه: ${reminderLabel}`,
    `وقت البداية: ${startLabel}`,
    event.location ? `الموقع: ${String(event.location)}` : '',
    event.description ? `الوصف: ${String(event.description)}` : '',
    `التفاصيل: ${detailUrl}`,
    '',
    'مع التحية،',
    'مسار المحامي',
  ].filter(Boolean);

  const sentCount = await sendReminderEmails(recipients, {
    subject: `تذكير موعد - ${eventTitle}`,
    text: lines.join('\n'),
  });

  return { kind: 'event_reminder', recipients: sentCount, skipped: false };
}

async function sendMatterEventReminder(
  adminClient: SupabaseClient,
  job: NotificationJobRecord,
) {
  const payload = asRecord(job.payload);
  const matterEventId = readRequiredString(payload, 'matter_event_id');

  const { data: event, error: eventError } = await adminClient
    .from('matter_events')
    .select('id, type, note, event_date, matter_id, created_by')
    .eq('org_id', job.org_id)
    .eq('id', matterEventId)
    .maybeSingle();

  if (eventError) {
    throw eventError;
  }
  if (!event || !event.event_date || !event.matter_id) {
    return { kind: 'matter_event_reminder', recipients: 0, skipped: true };
  }

  const { data: matter, error: matterError } = await adminClient
    .from('matters')
    .select('id, title, assigned_user_id')
    .eq('org_id', job.org_id)
    .eq('id', event.matter_id)
    .maybeSingle();

  if (matterError) {
    throw matterError;
  }

  const recipientIds = uniqueStrings([
    String(event.created_by ?? ''),
    String(matter?.assigned_user_id ?? ''),
  ]);
  const recipients = await resolveRecipients(job.org_id, recipientIds);
  if (!recipients.length) {
    throw new Error('no_matter_event_recipients');
  }

  const siteUrl = getPublicSiteUrl();
  const kind = event.type === 'meeting' ? 'اجتماع' : 'جلسة';
  const reminderLabel = toReminderCopy(readOptionalString(payload, 'reminder_label'));
  const matterTitle = String(matter?.title ?? 'قضية');
  const eventDateLabel = formatSaudiDateTime(String(event.event_date));
  const detailUrl = `${siteUrl}/app/matters/${event.matter_id}`;

  const lines = [
    'مرحباً،',
    '',
    `هذا تذكير بموعد ${kind.toLowerCase()}: ${matterTitle}`,
    `فترة التذكير: ${reminderLabel}`,
    `وقت الموعد: ${eventDateLabel}`,
    event.note ? `ملاحظات: ${String(event.note)}` : '',
    `التفاصيل: ${detailUrl}`,
    '',
    'مع التحية،',
    'مسار المحامي',
  ].filter(Boolean);

  const sentCount = await sendReminderEmails(recipients, {
    subject: `تذكير ${kind} - ${matterTitle}`,
    text: lines.join('\n'),
  });

  return { kind: 'matter_event_reminder', recipients: sentCount, skipped: false };
}

async function resolveRecipients(orgId: string, userIds: string[]) {
  const members = await enrichOrgMembers(orgId, userIds);
  const deduped = new Map<string, ReminderEmailRecipient>();

  for (const member of members) {
    const email = String(member.email ?? '').trim();
    if (!email) continue;
    if (deduped.has(email)) continue;
    deduped.set(email, {
      userId: member.user_id,
      name: member.full_name || member.email || 'عضو المكتب',
      email,
    });
  }

  return Array.from(deduped.values());
}

async function sendReminderEmails(
  recipients: ReminderEmailRecipient[],
  params: {
    subject: string;
    text: string;
  },
) {
  if (!isSmtpConfigured()) {
    throw new Error('smtp_not_configured');
  }

  let sentCount = 0;
  let firstError: unknown = null;

  for (const recipient of recipients) {
    try {
      await sendEmail({
        to: recipient.email,
        subject: params.subject,
        text: params.text,
      });
      sentCount += 1;
    } catch (error) {
      firstError ??= error;
    }
  }

  if (!sentCount && firstError) {
    throw firstError;
  }

  return sentCount;
}

function asRecord(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function readRequiredString(value: Record<string, unknown>, key: string) {
  const normalized = readOptionalString(value, key);
  if (!normalized) {
    throw new Error(`missing_job_payload:${key}`);
  }
  return normalized;
}

function readOptionalString(value: Record<string, unknown>, key: string) {
  const raw = value[key];
  return typeof raw === 'string' ? raw.trim() : '';
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function toReminderCopy(label: string) {
  if (label === '24h') return 'قبل الموعد بـ 24 ساعة';
  if (label === '2h') return 'قبل الموعد بساعتين';
  return 'قبل الموعد بوقت قريب';
}

function formatSaudiDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString('ar-SA', {
    timeZone: 'Asia/Riyadh',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
