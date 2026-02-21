import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { checkRateLimit, getRequestIp, RATE_LIMIT_MESSAGE_AR } from '@/lib/rateLimit';
import {
  ACCESS_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
} from '@/lib/supabase/constants';
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
    .min(4, 'يرجى إدخال الرمز.')
    .max(12, 'الرمز غير صالح.'),
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
  const supabase = createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token: code,
    type: 'recovery',
  });

  if (error || !data.session) {
    return NextResponse.json({ error: 'الرمز غير صحيح أو منتهي.' }, { status: 400 });
  }

  const response = NextResponse.json({ ok: true }, { status: 200 });
  response.cookies.set(ACCESS_COOKIE_NAME, data.session.access_token, {
    ...SESSION_COOKIE_OPTIONS,
    maxAge: data.session.expires_in,
  });
  response.cookies.set(REFRESH_COOKIE_NAME, data.session.refresh_token, {
    ...SESSION_COOKIE_OPTIONS,
    maxAge: 60 * 60 * 24 * 30,
  });

  return response;
}

