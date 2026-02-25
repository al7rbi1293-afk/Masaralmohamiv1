import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkRateLimit, getRequestIp, RATE_LIMIT_MESSAGE_AR } from '@/lib/rateLimit';
import { ACCESS_COOKIE_NAME, REFRESH_COOKIE_NAME, SESSION_COOKIE_OPTIONS } from '@/lib/supabase/constants';
import { getSupabasePublicEnv } from '@/lib/env';

export const runtime = 'nodejs';

const bodySchema = z.object({
  email: z
    .string()
    .trim()
    .email('يرجى إدخال بريد إلكتروني صحيح.')
    .max(255, 'البريد الإلكتروني طويل جدًا.'),
  code: z
    .string()
    .trim()
    .min(4, 'رمز التحقق غير صالح.')
    .max(12, 'رمز التحقق غير صالح.'),
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
  const code = parsed.data.code;

  const rate = await checkRateLimit({
    key: `password_reset:verify:${ip}:${email}`,
    limit: 10,
    windowMs: 10 * 60 * 1000,
  });

  if (!rate.allowed) {
    return NextResponse.json({ error: RATE_LIMIT_MESSAGE_AR }, { status: 429 });
  }

  const { url, anonKey } = getSupabasePublicEnv();
  const verifyResponse = await fetch(`${url}/auth/v1/verify`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: 'recovery',
      email,
      token: code,
    }),
  });

  if (!verifyResponse.ok) {
    return NextResponse.json({ error: 'رمز الاستعادة غير صحيح أو منتهي الصلاحية.' }, { status: 400 });
  }

  const verifyData = (await verifyResponse.json().catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    session?: {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
    };
  };

  const accessToken = verifyData.access_token ?? verifyData.session?.access_token;
  const refreshToken = verifyData.refresh_token ?? verifyData.session?.refresh_token;
  const accessExpiresIn = verifyData.expires_in ?? verifyData.session?.expires_in ?? 3600;

  if (!accessToken || !refreshToken) {
    return NextResponse.json({ error: 'تعذر إنشاء جلسة الاستعادة. حاول مرة أخرى.' }, { status: 500 });
  }

  const response = NextResponse.json({ ok: true }, { status: 200 });
  response.cookies.set(ACCESS_COOKIE_NAME, accessToken, {
    ...SESSION_COOKIE_OPTIONS,
    maxAge: Math.max(60, accessExpiresIn),
  });
  response.cookies.set(REFRESH_COOKIE_NAME, refreshToken, {
    ...SESSION_COOKIE_OPTIONS,
    maxAge: 7 * 24 * 60 * 60,
  });

  return response;
}
