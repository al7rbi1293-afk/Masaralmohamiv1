import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerAuthClient } from '@/lib/supabase/server';
import {
  ACCESS_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
} from '@/lib/supabase/constants';

const signInSchema = z.object({
  email: z
    .string()
    .trim()
    .email('يرجى إدخال بريد إلكتروني صحيح.')
    .max(255, 'البريد الإلكتروني طويل جدًا.'),
  password: z.string().min(1, 'يرجى إدخال كلمة المرور.').max(72, 'كلمة المرور طويلة جدًا.'),
  next: z.string().trim().optional(),
});

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const parsed = signInSchema.safeParse({
    email: toText(formData, 'email').toLowerCase(),
    password: toText(formData, 'password'),
    next: toText(formData, 'next') || undefined,
  });

  if (!parsed.success) {
    return redirectWithError(request, parsed.error.issues[0]?.message ?? 'تعذر التحقق من البيانات.');
  }

  const supabase = createSupabaseServerAuthClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error || !data.session) {
    return redirectWithError(request, toArabicAuthError(error?.message), parsed.data.email);
  }

  const destination = safeNextPath(parsed.data.next) ?? '/app';
  const response = NextResponse.redirect(new URL(destination, request.url), 303);

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

function redirectWithError(request: NextRequest, message: string, email?: string) {
  const url = new URL('/signin', request.url);
  url.searchParams.set('error', encodeURIComponent(message));
  if (email) {
    url.searchParams.set('email', encodeURIComponent(email));
  }
  return NextResponse.redirect(url, 303);
}

function toText(formData: FormData, field: string) {
  const value = formData.get(field);
  return typeof value === 'string' ? value : '';
}

function toArabicAuthError(message?: string) {
  if (!message) {
    return 'تعذر تسجيل الدخول. حاول مرة أخرى.';
  }

  const normalized = message.toLowerCase();

  if (normalized.includes('invalid login credentials')) {
    return 'البريد الإلكتروني أو كلمة المرور غير صحيحة.';
  }

  if (normalized.includes('email not confirmed')) {
    return 'يرجى تأكيد البريد الإلكتروني أولًا.';
  }

  return 'تعذر تسجيل الدخول. تحقق من البيانات وحاول مرة أخرى.';
}

function safeNextPath(raw?: string) {
  if (!raw) {
    return null;
  }

  // Prevent open redirects. Only allow returning to /app routes.
  if (!raw.startsWith('/app')) {
    return null;
  }

  // Disallow protocol-relative or malformed values.
  if (raw.startsWith('//')) {
    return null;
  }

  return raw;
}

