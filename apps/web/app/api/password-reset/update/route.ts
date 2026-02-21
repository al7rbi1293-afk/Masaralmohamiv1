import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { cookies } from 'next/headers';
import { checkRateLimit, getRequestIp, RATE_LIMIT_MESSAGE_AR } from '@/lib/rateLimit';
import { ACCESS_COOKIE_NAME, REFRESH_COOKIE_NAME } from '@/lib/supabase/constants';
import { getSupabasePublicEnv } from '@/lib/env';

export const runtime = 'nodejs';

const bodySchema = z.object({
  password: z
    .string()
    .min(7, 'كلمة المرور يجب أن تكون 7 خانات على الأقل.')
    .max(72, 'كلمة المرور طويلة جدًا.'),
});

// Same policy used on signup.
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{7,}$/;

export async function POST(request: NextRequest) {
  const ip = getRequestIp(request);
  const rate = await checkRateLimit({
    key: `password_reset:update:${ip}`,
    limit: 15,
    windowMs: 10 * 60 * 1000,
  });

  if (!rate.allowed) {
    return NextResponse.json({ error: RATE_LIMIT_MESSAGE_AR }, { status: 429 });
  }

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

  if (!passwordRegex.test(parsed.data.password)) {
    return NextResponse.json(
      { error: 'كلمة المرور يجب أن تكون 7 خانات على الأقل وتحتوي على حرف كبير، صغير، رقم، ورمز.' },
      { status: 400 },
    );
  }

  const cookieStore = cookies();
  const accessToken = cookieStore.get(ACCESS_COOKIE_NAME)?.value?.trim();

  if (!accessToken) {
    return NextResponse.json(
      { error: 'انتهت جلسة التحقق. أعد إدخال رمز الاستعادة.' },
      { status: 401 },
    );
  }

  const { url, anonKey } = getSupabasePublicEnv();

  const resp = await fetch(`${url}/auth/v1/user`, {
    method: 'PUT',
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      password: parsed.data.password,
    }),
  });

  if (!resp.ok) {
    if (resp.status === 401) {
      const response = NextResponse.json(
        { error: 'انتهت جلسة التحقق. أعد إدخال رمز الاستعادة.' },
        { status: 401 },
      );
      response.cookies.delete(ACCESS_COOKIE_NAME);
      response.cookies.delete(REFRESH_COOKIE_NAME);
      return response;
    }

    return NextResponse.json({ error: 'تعذر تحديث كلمة المرور. حاول مرة أخرى.' }, { status: 500 });
  }

  // Force a fresh sign-in after password reset.
  const response = NextResponse.json({ ok: true }, { status: 200 });
  response.cookies.delete(ACCESS_COOKIE_NAME);
  response.cookies.delete(REFRESH_COOKIE_NAME);
  return response;
}

