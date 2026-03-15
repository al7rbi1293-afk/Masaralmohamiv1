import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkRateLimit, getRequestIp, RATE_LIMIT_MESSAGE_AR } from '@/lib/rateLimit';
import { requireOrgIdForUser } from '@/lib/org';
import { createSupabaseServerRlsClient } from '@/lib/supabase/server';
import { getCurrentAuthUser } from '@/lib/supabase/auth-session';
import { sendEmail } from '@/lib/email';
import {
  TASK_REMINDER_EMAIL_HTML,
  TASK_REMINDER_EMAIL_SUBJECT,
  TASK_REMINDER_EMAIL_TEXT,
} from '@/lib/email-templates';
import { logError, logInfo } from '@/lib/logger';

export const runtime = 'nodejs';

const bodySchema = z.object({
  task_id: z.string().uuid('معرّف المهمة غير صحيح.'),
  to_email: z.string().trim().email('البريد الإلكتروني غير صحيح.'),
  message_optional: z.string().trim().max(800, 'الرسالة طويلة جدًا.').optional(),
});

export async function POST(request: NextRequest) {
  const ip = getRequestIp(request);
  const limit = await checkRateLimit({
    key: `email:task:${ip}`,
    limit: 15,
    windowMs: 10 * 60 * 1000,
  });

  if (!limit.allowed) {
    return NextResponse.json({ error: RATE_LIMIT_MESSAGE_AR }, { status: 429 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'تعذر إرسال البريد.' },
      { status: 400 },
    );
  }

  const rls = createSupabaseServerRlsClient();
  let orgId = '';
  let currentUserId = '';

  try {
    orgId = await requireOrgIdForUser();
    const currentUser = await getCurrentAuthUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'الرجاء تسجيل الدخول.' }, { status: 401 });
    }
    currentUserId = currentUser.id;

    const { data: task, error } = await rls
      .from('tasks')
      .select('id, title, status, due_at, matter_id, matters(title)')
      .eq('org_id', orgId)
      .eq('is_archived', false)
      .eq('id', parsed.data.task_id)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!task) {
      return NextResponse.json({ error: 'المهمة غير موجودة.' }, { status: 404 });
    }

    const title = String((task as any).title ?? '').trim() || 'مهمة';
    const dueAt = (task as any).due_at ? new Date(String((task as any).due_at)) : null;
    const dueLabel =
      dueAt && !Number.isNaN(dueAt.getTime())
        ? dueAt.toLocaleString('ar-SA', {
            timeZone: 'Asia/Riyadh',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })
        : '';

    const subject = TASK_REMINDER_EMAIL_SUBJECT(title);
    const matterTitle = (task as any).matters?.title ? String((task as any).matters.title) : '';
    const statusLabel = formatTaskStatusLabel(String((task as any).status ?? ''));

    const textBody = TASK_REMINDER_EMAIL_TEXT({
      taskTitle: title,
      matterTitle,
      dueLabel,
      statusLabel,
      message: parsed.data.message_optional ?? null,
    });
    const htmlBody = TASK_REMINDER_EMAIL_HTML({
      taskTitle: title,
      matterTitle,
      dueLabel,
      statusLabel,
      message: parsed.data.message_optional ?? null,
    });

    await sendEmail({
      to: parsed.data.to_email,
      subject,
      text: textBody,
      html: htmlBody,
    });

    const { error: insertLogError } = await rls.from('email_logs').insert({
      org_id: orgId,
      sent_by: currentUserId,
      to_email: parsed.data.to_email,
      subject,
      template: 'task_reminder',
      meta: { task_id: parsed.data.task_id, status: (task as any).status ?? null, due_at: (task as any).due_at ?? null },
      status: 'sent',
    });

    if (insertLogError) {
      logError('email_log_insert_failed', { message: insertLogError.message });
    }

    logInfo('email_sent_task_reminder', { taskId: parsed.data.task_id });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    const message = toUserMessage(error);
    logError('email_send_task_failed', { message });

    if (orgId && currentUserId) {
      await rls.from('email_logs').insert({
        org_id: orgId,
        sent_by: currentUserId,
        to_email: parsed.data.to_email,
        subject: `تذكير مهمة - ${parsed.data.task_id}`,
        template: 'task_reminder',
        meta: { task_id: parsed.data.task_id },
        status: 'failed',
        error: message.slice(0, 240),
      });
    }

    return NextResponse.json({ error: message }, { status: message === 'الرجاء تسجيل الدخول.' ? 401 : 400 });
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

  if (normalized.includes('smtp_') || normalized.includes('missing required environment variable')) {
    return 'خدمة البريد غير مفعلة حالياً.';
  }

  if (normalized.includes('authentication failed') || normalized.includes('invalid login')) {
    return 'تعذر إرسال البريد (إعدادات SMTP غير صحيحة).';
  }

  return message || 'تعذر إرسال البريد.';
}

function formatTaskStatusLabel(status: string) {
  if (status === 'todo') return 'للإنجاز';
  if (status === 'doing') return 'قيد التنفيذ';
  if (status === 'done') return 'مكتملة';
  if (status === 'canceled') return 'ملغاة';
  return status || 'غير محددة';
}
