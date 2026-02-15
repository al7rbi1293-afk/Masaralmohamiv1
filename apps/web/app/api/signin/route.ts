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
  const rawNext = toText(formData, 'next') || undefined;
  const parsed = signInSchema.safeParse({
    email: toText(formData, 'email').toLowerCase(),
    password: toText(formData, 'password'),
    next: rawNext,
  });

  if (!parsed.success) {
    return redirectWithError(
      request,
      parsed.error.issues[0]?.message ?? 'تعذر التحقق من البيانات.',
      undefined,
      rawNext,
    );
  }

  const supabase = createSupabaseServerAuthClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error || !data.session) {
    return redirectWithError(request, toArabicAuthError(error?.message), parsed.data.email, parsed.data.next);
  }

  // Check if user is an admin to potentially redirect to /admin
  let defaultRedirect = '/app';
  const { data: adminRecord } = await supabase
    .from('app_admins')
    .select('user_id')
    .eq('user_id', data.session.user.id)
    .maybeSingle();

  if (adminRecord) {
    defaultRedirect = '/admin';
  }

  // Some users might come with old bookmarked routes (e.g. legacy /app/[tenantId] pages).
  // Only allow returning to the current trial platform pages.
  const destination = safeNextPath(parsed.data.next) ?? defaultRedirect;
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

function redirectWithError(request: NextRequest, message: string, email?: string, next?: string) {
  const url = new URL('/signin', request.url);
  url.searchParams.set('error', encodeURIComponent(message));
  if (email) {
    url.searchParams.set('email', encodeURIComponent(email));
  }
  const nextPath = safeNextPath(next);
  if (nextPath) {
    url.searchParams.set('next', encodeURIComponent(nextPath));
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

  const value = raw.trim();

  // Disallow protocol-relative or malformed values.
  if (!value.startsWith('/') || value.startsWith('//')) {
    return null;
  }

  // Basic hardening against header injection.
  if (value.includes('\n') || value.includes('\r')) {
    return null;
  }

  // Allow returning to the platform (avoid open redirects).
  if (value.startsWith('/app')) {
    // Disallow returning to API endpoints.
    if (value.startsWith('/app/api')) {
      return null;
    }
    return value;
  }

  // Allow returning to admin panel.
  if (value.startsWith('/admin')) {
    if (value.startsWith('/admin/api')) {
      return null;
    }
    return value;
  }

  // Allow returning to invite acceptance flow.
  if (value.startsWith('/invite/')) {
    return value;
  }

  return null;
}
