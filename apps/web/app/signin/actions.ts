'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
  verifyPassword,
  generateSessionToken,
} from '@/lib/auth-custom';

export async function signInAction(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');

  if (!email || !password) {
    redirect(`/signin?error=${encodeURIComponent('يرجى إدخال البريد وكلمة المرور.')}`);
  }

  const db = createSupabaseServerClient();

  // Look up user in app_users
  const { data: user, error: userError } = await db
    .from('app_users')
    .select('id, email, password_hash, status')
    .eq('email', email)
    .maybeSingle();

  if (userError || !user) {
    redirect(`/signin?error=${encodeURIComponent('البريد الإلكتروني أو كلمة المرور غير صحيحة.')}`);
  }

  if (user.status === 'suspended') {
    redirect(`/signin?error=${encodeURIComponent('تم تعليق الحساب. تواصل مع الإدارة.')}`);
  }

  const passwordMatch = await verifyPassword(password, user.password_hash);
  if (!passwordMatch) {
    redirect(`/signin?error=${encodeURIComponent('البريد الإلكتروني أو كلمة المرور غير صحيحة.')}`);
  }

  // Generate custom JWT session
  const sessionToken = generateSessionToken({ userId: user.id, email: user.email });

  const cookieStore = cookies();
  cookieStore.set(SESSION_COOKIE_NAME, sessionToken, SESSION_COOKIE_OPTIONS);
  // Clear old Supabase cookies
  cookieStore.delete('masar-sb-access-token');
  cookieStore.delete('masar-sb-refresh-token');

  redirect('/app');
}
