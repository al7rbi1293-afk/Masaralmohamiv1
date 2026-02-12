'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createSupabaseServerAuthClient } from '@/lib/supabase/server';
import {
  ACCESS_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
} from '@/lib/supabase/constants';

export async function signUpAction(formData: FormData) {
  const fullName = String(formData.get('full_name') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  const phone = String(formData.get('phone') ?? '').trim();
  const firmName = String(formData.get('firm_name') ?? '').trim();

  if (!fullName || !email || password.length < 8) {
    redirect(`/signup?error=${encodeURIComponent('تحقق من الاسم والبريد وكلمة المرور (8 أحرف على الأقل).')}`);
  }

  const supabase = createSupabaseServerAuthClient();

  let signUpData:
    | Awaited<ReturnType<typeof supabase.auth.signUp>>['data']
    | null = null;
  let signUpError:
    | Awaited<ReturnType<typeof supabase.auth.signUp>>['error']
    | null = null;

  try {
    const result = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          phone: phone || null,
          firm_name: firmName || null,
        },
      },
    });
    signUpData = result.data;
    signUpError = result.error;
  } catch {
    redirect(`/signup?error=${encodeURIComponent('تعذّر الاتصال بخدمة المصادقة.')}`);
  }

  if (signUpError) {
    redirect(`/signup?error=${encodeURIComponent(toArabicAuthError(signUpError.message))}`);
  }

  let session = signUpData?.session ?? null;

  if (!session) {
    let signInData:
      | Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>['data']
      | null = null;
    let signInError:
      | Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>['error']
      | null = null;

    try {
      const result = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      signInData = result.data;
      signInError = result.error;
    } catch {
      redirect(`/signin?error=${encodeURIComponent('تم إنشاء الحساب لكن تعذّر تسجيل الدخول. استخدم صفحة تسجيل الدخول.')}`);
    }

    if (signInError || !signInData?.session) {
      redirect(`/signin?error=${encodeURIComponent('تم إنشاء الحساب. سجّل الدخول للمتابعة.')}`);
    }

    session = signInData.session;
  }

  const cookieStore = cookies();
  cookieStore.set(ACCESS_COOKIE_NAME, session.access_token, {
    ...SESSION_COOKIE_OPTIONS,
    maxAge: session.expires_in,
  });
  cookieStore.set(REFRESH_COOKIE_NAME, session.refresh_token, {
    ...SESSION_COOKIE_OPTIONS,
    maxAge: 60 * 60 * 24 * 30,
  });

  redirect('/app');
}

function toArabicAuthError(message?: string) {
  if (!message) {
    return 'تعذر إنشاء الحساب. حاول مرة أخرى.';
  }

  const normalized = message.toLowerCase();

  if (normalized.includes('user already registered')) {
    return 'هذا البريد مسجل مسبقًا. استخدم تسجيل الدخول.';
  }

  if (normalized.includes('password')) {
    return 'كلمة المرور ضعيفة. استخدم 8 أحرف على الأقل.';
  }

  return 'تعذر إنشاء الحساب. تحقق من البيانات وحاول مرة أخرى.';
}
