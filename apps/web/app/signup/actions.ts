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
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const phone = String(formData.get('phone') ?? '').trim();
  const firmName = String(formData.get('firm_name') ?? '').trim();

  if (!fullName || !email || password.length < 8) {
    redirect(`/signup?error=${encodeURIComponent('تحقق من الاسم والبريد وكلمة المرور (8 أحرف على الأقل).')}`);
  }

  try {
    const supabase = createSupabaseServerAuthClient();
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
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

    if (signUpError) {
      const message = encodeURIComponent(toArabicAuthError(signUpError.message));
      redirect(`/signup?error=${message}`);
    }

    let session = signUpData.session;

    if (!session) {
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError || !signInData.session) {
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
  } catch {
    redirect(`/signup?error=${encodeURIComponent('تعذّر إنشاء الحساب. حاول مرة أخرى.')}`);
  }
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
