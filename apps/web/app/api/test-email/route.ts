import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { sendEmail } from '@/lib/email';
import { isSmtpConfigured } from '@/lib/env';
import { requireAdmin } from '@/lib/admin';
import { checkRateLimit, getRequestIp, RATE_LIMIT_MESSAGE_AR } from '@/lib/rateLimit';
import { logError, logInfo } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  to: z.string().trim().email('البريد الإلكتروني غير صحيح.'),
});

export async function POST(request: NextRequest) {
  const ip = getRequestIp(request);
  const limit = checkRateLimit({
    key: `test_email:${ip}`,
    limit: 5,
    windowMs: 10 * 60 * 1000,
  });

  if (!limit.allowed) {
    return NextResponse.json({ error: RATE_LIMIT_MESSAGE_AR }, { status: 429 });
  }

  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: 'لا تملك صلاحية تنفيذ هذا الإجراء.' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'بيانات غير صالحة.' },
      { status: 400 },
    );
  }

  if (!isSmtpConfigured()) {
    return NextResponse.json({ error: 'خدمة البريد غير مفعلة حالياً.' }, { status: 503 });
  }

  try {
    await sendEmail({
      to: parsed.data.to,
      subject: 'اختبار البريد - مسار المحامي',
      text: 'هذه رسالة اختبار للتأكد من إعدادات البريد.',
      html: '<p>هذه رسالة <strong>اختبار</strong> للتأكد من إعدادات البريد.</p>',
    });

    logInfo('test_email_sent', { to: parsed.data.to });
    return NextResponse.json({ ok: true, message: 'تم إرسال رسالة الاختبار.' }, { status: 200 });
  } catch (error) {
    logError('test_email_failed', { message: error instanceof Error ? error.message : 'unknown_error' });
    return NextResponse.json({ error: 'تعذر إرسال رسالة الاختبار.' }, { status: 500 });
  }
}
