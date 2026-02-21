import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { checkRateLimit, getRequestIp, RATE_LIMIT_MESSAGE_AR } from '@/lib/rateLimit';
import { sendEmail } from '@/lib/email';
import { PASSWORD_RESET_EMAIL_HTML, PASSWORD_RESET_EMAIL_SUBJECT } from '@/lib/email-templates';

export const runtime = 'nodejs';

const bodySchema = z.object({
  email: z
    .string()
    .trim()
    .email('يرجى إدخال بريد إلكتروني صحيح.')
    .max(255, 'البريد الإلكتروني طويل جدًا.'),
});

function isUserNotFoundError(message?: string) {
  const normalized = String(message ?? '').toLowerCase();
  return normalized.includes('user not found') || normalized.includes('user does not exist');
}

export async function POST(request: NextRequest) {
  const ip = getRequestIp(request);

  let payload: unknown = {};
  try {
    payload = await request.json();
  } catch {
    payload = {};
  }

  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'تعذر التحقق من البيانات.' },
      { status: 400 },
    );
  }

  const email = parsed.data.email.toLowerCase();
  const rate = await checkRateLimit({
    key: `password_reset:request:${ip}:${email}`,
    limit: 3,
    windowMs: 10 * 60 * 1000,
  });

  if (!rate.allowed) {
    return NextResponse.json({ error: RATE_LIMIT_MESSAGE_AR }, { status: 429 });
  }

  const origin = new URL(request.url).origin;

  try {
    const adminClient = createSupabaseServerClient();
    const { data, error } = await adminClient.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: {
        redirectTo: `${origin}/auth/callback?next=${encodeURIComponent('/signin')}`,
      },
    });

    // Do not leak whether the email exists.
    if (error) {
      if (isUserNotFoundError(error.message)) {
        return NextResponse.json({ ok: true }, { status: 200 });
      }
      return NextResponse.json({ error: 'تعذر إرسال الرمز. حاول مرة أخرى.' }, { status: 500 });
    }

    const code = (data as any)?.properties?.email_otp as string | undefined;
    if (!code) {
      return NextResponse.json({ error: 'تعذر إنشاء رمز الاستعادة. حاول مرة أخرى.' }, { status: 500 });
    }

    await sendEmail({
      to: email,
      subject: PASSWORD_RESET_EMAIL_SUBJECT,
      text: `رمز استعادة كلمة المرور: ${code}`,
      html: PASSWORD_RESET_EMAIL_HTML({
        name: 'عميلنا الكريم',
        code,
        siteUrl: origin,
      }),
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch {
    return NextResponse.json({ error: 'تعذر إرسال الرمز. حاول مرة أخرى.' }, { status: 500 });
  }
}

