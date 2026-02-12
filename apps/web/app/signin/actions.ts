'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createSupabaseServerAuthClient } from '@/lib/supabase/server';
import {
  ACCESS_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
} from '@/lib/supabase/constants';

export async function signInAction(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');

  if (!email || !password) {
    redirect(`/signin?error=${encodeURIComponent('يرجى إدخال البريد وكلمة المرور.')}`);
  }

  const supabase = createSupabaseServerAuthClient();

  let data: Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>['data'] | null = null;
  let error: Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>['error'] | null = null;

  try {
    const result = await supabase.auth.signInWithPassword({ email, password });
    data = result.data;
    error = result.error;
  } catch {
    redirect(`/signin?error=${encodeURIComponent('تعذّر الاتصال بخدمة المصادقة.')}`);
  }

  if (!data?.session || error) {
    redirect(`/signin?error=${encodeURIComponent(toArabicAuthError(error?.message))}`);
  }

  const cookieStore = cookies();
  cookieStore.set(ACCESS_COOKIE_NAME, data.session.access_token, {
    ...SESSION_COOKIE_OPTIONS,
    maxAge: data.session.expires_in,
  });
  cookieStore.set(REFRESH_COOKIE_NAME, data.session.refresh_token, {
    ...SESSION_COOKIE_OPTIONS,
    maxAge: 60 * 60 * 24 * 30,
  });

  redirect('/app');
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
