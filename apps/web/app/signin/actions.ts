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
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  if (!email || !password) {
    redirect('/signin?error=يرجى_إدخال_البريد_وكلمة_المرور');
  }

  try {
    const supabase = createSupabaseServerAuthClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error || !data.session) {
      const message = encodeURIComponent(error?.message ?? 'تعذر تسجيل الدخول');
      redirect(`/signin?error=${message}`);
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
  } catch {
    redirect('/signin?error=تهيئة_Supabase_غير_مكتملة');
  }
}
