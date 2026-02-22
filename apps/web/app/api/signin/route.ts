import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  verifyPassword,
  generateSessionToken,
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
} from '@/lib/auth-custom';
import { ensureTrialProvisionForUser } from '@/lib/onboarding';

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

  const db = createSupabaseServerClient();

  // Look up user in app_users
  const { data: user, error: userError } = await db
    .from('app_users')
    .select('id, email, password_hash, full_name, status, email_verified')
    .eq('email', parsed.data.email)
    .maybeSingle();

  if (userError || !user) {
    return redirectWithError(
      request,
      'البريد الإلكتروني أو كلمة المرور غير صحيحة.',
      parsed.data.email,
      parsed.data.next,
    );
  }

  if (user.status === 'suspended') {
    return redirectWithError(
      request,
      'تم تعليق الحساب. تواصل مع الإدارة.',
      parsed.data.email,
      parsed.data.next,
    );
  }

  if (!user.email_verified) {
    return redirectWithError(
      request,
      'الحساب موجود ولكنه غير مفعل. يرجى مراجعة بريدك الإلكتروني لتفعيل الحساب.',
      parsed.data.email,
      parsed.data.next,
    );
  }

  // Verify password
  const passwordMatch = await verifyPassword(parsed.data.password, user.password_hash);
  if (!passwordMatch) {
    return redirectWithError(
      request,
      'البريد الإلكتروني أو كلمة المرور غير صحيحة.',
      parsed.data.email,
      parsed.data.next,
    );
  }

  // Generate custom JWT session
  const sessionToken = await generateSessionToken({ userId: user.id, email: user.email });

  // Check admin status
  let defaultRedirect = '/app';
  const { data: adminRecord } = await db
    .from('app_admins')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (adminRecord) {
    defaultRedirect = '/admin';
  }

  let destination = safeNextPath(parsed.data.next) ?? defaultRedirect;

  // Ensure trial provisioning for non-admin accounts
  if (!adminRecord && destination.startsWith('/app') && !destination.startsWith('/app/api')) {
    try {
      const provision = await ensureTrialProvisionForUser({ userId: user.id, firmName: null });
      if (provision.isExpired && !destination.startsWith('/app/expired')) {
        destination = '/app/expired';
      }
    } catch {
      // Keep login working even if provisioning fails.
    }
  }

  const response = NextResponse.redirect(new URL(destination, request.url), 303);

  response.cookies.set(SESSION_COOKIE_NAME, sessionToken, SESSION_COOKIE_OPTIONS);

  // Clear old Supabase cookies if they exist
  response.cookies.delete('masar-sb-access-token');
  response.cookies.delete('masar-sb-refresh-token');

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

function safeNextPath(raw?: string) {
  if (!raw) return null;
  const value = raw.trim();
  if (!value.startsWith('/') || value.startsWith('//')) return null;
  if (value.includes('\n') || value.includes('\r')) return null;
  if (value.startsWith('/app')) {
    if (value.startsWith('/app/api')) return null;
    return value;
  }
  if (value.startsWith('/admin')) {
    if (value.startsWith('/admin/api')) return null;
    return value;
  }
  return null;
}
