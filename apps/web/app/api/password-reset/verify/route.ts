import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkRateLimit, getRequestIp, RATE_LIMIT_MESSAGE_AR } from '@/lib/rateLimit';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { hashPassword, generateSessionToken, SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS } from '@/lib/auth-custom';

export const runtime = 'nodejs';

const bodySchema = z.object({
  email: z
    .string()
    .trim()
    .email('يرجى إدخال بريد إلكتروني صحيح.')
    .max(255, 'البريد الإلكتروني طويل جدًا.'),
  newPassword: z
    .string()
    .min(8, 'كلمة المرور يجب أن تكون 8 أحرف على الأقل.')
    .max(72, 'كلمة المرور طويلة جدًا.'),
});

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
  const newPassword = parsed.data.newPassword;

  const rate = await checkRateLimit({
    key: `password_reset:verify:${ip}:${email}`,
    limit: 10,
    windowMs: 10 * 60 * 1000,
  });

  if (!rate.allowed) {
    return NextResponse.json({ error: RATE_LIMIT_MESSAGE_AR }, { status: 429 });
  }

  const db = createSupabaseServerClient();

  // Find the user
  const { data: user } = await db
    .from('app_users')
    .select('id, email')
    .eq('email', email)
    .maybeSingle();

  if (!user) {
    return NextResponse.json({ error: 'البريد الإلكتروني غير مسجل.' }, { status: 400 });
  }

  // Update password
  const passwordHash = await hashPassword(newPassword);
  await db
    .from('app_users')
    .update({ password_hash: passwordHash, updated_at: new Date().toISOString() })
    .eq('id', user.id);

  // Generate session and sign them in
  const sessionToken = generateSessionToken({ userId: user.id, email: user.email });

  const response = NextResponse.json({ ok: true }, { status: 200 });
  response.cookies.set(SESSION_COOKIE_NAME, sessionToken, SESSION_COOKIE_OPTIONS);

  return response;
}
