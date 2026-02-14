import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkRateLimit, getRequestIp, RATE_LIMIT_MESSAGE_AR } from '@/lib/rateLimit';
import { getPublicSiteUrl } from '@/lib/env';
import { requireOrgIdForUser } from '@/lib/org';
import { getCurrentAuthUser } from '@/lib/supabase/auth-session';
import { createSupabaseServerRlsClient } from '@/lib/supabase/server';
import { logError } from '@/lib/logger';

export const runtime = 'nodejs';

const dateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'صيغة التاريخ غير صحيحة. استخدم YYYY-MM-DD.');

const querySchema = z
  .object({
    from: dateSchema,
    to: dateSchema,
  })
  .superRefine((value, ctx) => {
    const from = parseUtcDateStart(value.from);
    const to = parseUtcDateStart(value.to);

    if (!from || !to) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'صيغة التاريخ غير صحيحة.',
      });
      return;
    }

    if (to.getTime() < from.getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'نطاق التاريخ غير صحيح.',
      });
      return;
    }

    const diffDays = Math.ceil((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
    if (diffDays > 180) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'نطاق التاريخ كبير جدًا. اختر مدة أقل من 180 يومًا.',
      });
    }
  });

type CalendarIcsItem = {
  uid: string;
  start: string;
  summary: string;
  url: string;
};

export async function GET(request: NextRequest) {
  const ip = getRequestIp(request);
  const limit = checkRateLimit({
    key: `calendar-ics:${ip}`,
    limit: 20,
    windowMs: 10 * 60 * 1000,
  });

  if (!limit.allowed) {
    return NextResponse.json({ error: RATE_LIMIT_MESSAGE_AR }, { status: 429 });
  }

  const fromRaw = request.nextUrl.searchParams.get('from') ?? '';
  const toRaw = request.nextUrl.searchParams.get('to') ?? '';
  const parsed = querySchema.safeParse({ from: fromRaw, to: toRaw });

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? 'نطاق التاريخ غير صحيح.';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const user = await getCurrentAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'الرجاء تسجيل الدخول.' }, { status: 401 });
  }

  let orgId: string;
  try {
    orgId = await requireOrgIdForUser();
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('لا يوجد مكتب')) {
      return calendarResponse(buildCalendarIcs([]), 'masar-calendar.ics');
    }
    throw error;
  }

  const fromStart = parseUtcDateStart(parsed.data.from)!;
  const toEndExclusive = addDays(parseUtcDateStart(parsed.data.to)!, 1);

  const supabase = createSupabaseServerRlsClient();
  const siteUrl = getPublicSiteUrl();
  const uidDomain = safeHost(siteUrl) || 'masar.local';

  try {
    const [eventsRes, tasksRes, invoicesRes] = await Promise.all([
      supabase
        .from('matter_events')
        .select('id, type, event_date, matter_id, matters(title)')
        .eq('org_id', orgId)
        .in('type', ['hearing', 'meeting'])
        .not('event_date', 'is', null)
        .gte('event_date', fromStart.toISOString())
        .lt('event_date', toEndExclusive.toISOString())
        .order('event_date', { ascending: true })
        .limit(1500),
      supabase
        .from('tasks')
        .select('id, title, due_at, matter_id, matters(title)')
        .eq('org_id', orgId)
        .not('due_at', 'is', null)
        .gte('due_at', fromStart.toISOString())
        .lt('due_at', toEndExclusive.toISOString())
        .order('due_at', { ascending: true })
        .limit(1500),
      supabase
        .from('invoices')
        .select('id, number, due_at')
        .eq('org_id', orgId)
        .not('due_at', 'is', null)
        .gte('due_at', fromStart.toISOString())
        .lt('due_at', toEndExclusive.toISOString())
        .order('due_at', { ascending: true })
        .limit(1500),
    ]);

    if (eventsRes.error) throw eventsRes.error;
    if (tasksRes.error) throw tasksRes.error;
    if (invoicesRes.error) throw invoicesRes.error;

    const items: CalendarIcsItem[] = [];

    (eventsRes.data as any[]).forEach((row) => {
      if (!row.event_date) return;
      const kind = row.type === 'meeting' ? 'meeting' : 'hearing';
      const matterTitle = row.matters?.title ? String(row.matters.title) : 'قضية';
      const summary = kind === 'hearing' ? `جلسة: ${matterTitle}` : `اجتماع: ${matterTitle}`;
      items.push({
        uid: `${kind}-${row.id}@${uidDomain}`,
        start: String(row.event_date),
        summary,
        url: row.matter_id ? `${siteUrl}/app/matters/${row.matter_id}` : `${siteUrl}/app/matters`,
      });
    });

    (tasksRes.data as any[]).forEach((row) => {
      if (!row.due_at) return;
      const title = String(row.title ?? '').trim();
      const summary = title ? `مهمة: ${title}` : 'مهمة';
      const url = row.matter_id ? `${siteUrl}/app/matters/${row.matter_id}` : `${siteUrl}/app/tasks`;
      items.push({
        uid: `task-${row.id}@${uidDomain}`,
        start: String(row.due_at),
        summary,
        url,
      });
    });

    (invoicesRes.data as any[]).forEach((row) => {
      if (!row.due_at) return;
      const number = row.number ? String(row.number) : row.id;
      items.push({
        uid: `invoice-${row.id}@${uidDomain}`,
        start: String(row.due_at),
        summary: `استحقاق فاتورة: ${number}`,
        url: `${siteUrl}/app/billing/invoices/${row.id}`,
      });
    });

    return calendarResponse(buildCalendarIcs(items), 'masar-calendar.ics');
  } catch (error) {
    const message = toUserMessage(error);
    logError('calendar_ics_failed', { message });
    return NextResponse.json({ error: message }, { status: message === 'الرجاء تسجيل الدخول.' ? 401 : 400 });
  }
}

function calendarResponse(body: string, fileName: string) {
  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename=\"${fileName}\"`,
      'Cache-Control': 'no-store',
    },
  });
}

function parseUtcDateStart(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function buildCalendarIcs(items: CalendarIcsItem[]) {
  const dtStamp = toIcsUtc(new Date().toISOString());

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'PRODID:-//Masar Al-Muhami//Calendar//AR',
  ];

  items
    .filter((item) => Boolean(item.start))
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
    .forEach((item) => {
      const start = toIcsUtc(item.start);
      const summary = icsEscape(item.summary);
      const url = icsEscape(item.url);

      lines.push('BEGIN:VEVENT');
      lines.push(foldLine(`UID:${item.uid}`));
      lines.push(`DTSTAMP:${dtStamp}`);
      lines.push(`DTSTART:${start}`);
      lines.push(foldLine(`SUMMARY:${summary}`));
      lines.push(foldLine(`URL:${url}`));
      lines.push('END:VEVENT');
    });

  lines.push('END:VCALENDAR');
  return `${lines.join('\r\n')}\r\n`;
}

function toIcsUtc(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString().slice(0, 19).replace(/[-:]/g, '') + 'Z';
  }
  return date.toISOString().slice(0, 19).replace(/[-:]/g, '') + 'Z';
}

function icsEscape(value: string) {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/\r/g, '')
    .replace(/\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');
}

function foldLine(line: string) {
  const max = 73;
  if (line.length <= max) return line;

  let remaining = line;
  const parts: string[] = [];
  while (remaining.length > max) {
    parts.push(remaining.slice(0, max));
    remaining = remaining.slice(max);
  }
  parts.push(remaining);

  return parts.join('\r\n ');
}

function safeHost(siteUrl: string) {
  try {
    return new URL(siteUrl).host;
  } catch {
    return '';
  }
}

function toUserMessage(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  const normalized = message.toLowerCase();

  if (
    normalized.includes('permission denied') ||
    normalized.includes('violates row-level security') ||
    normalized.includes('not allowed')
  ) {
    return 'لا تملك صلاحية الوصول.';
  }

  return message || 'تعذر إنشاء ملف التقويم. حاول مرة أخرى.';
}

