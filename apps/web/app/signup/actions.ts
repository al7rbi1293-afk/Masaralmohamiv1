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
  const token = String(formData.get('token') ?? '').trim();
  const fullName = String(formData.get('full_name') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  const phone = String(formData.get('phone') ?? '').trim();
  const firmName = String(formData.get('firm_name') ?? '').trim();

  // Password complexity regex:
  // At least 7 characters
  // At least one uppercase
  // At least one lowercase
  // At least one number
  // At least one symbol
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{7,}$/;

  if (!fullName || !email || !passwordRegex.test(password)) {
    redirect(
      `/signup?error=${encodeURIComponent('كلمة المرور يجب أن تكون 7 خانات على الأقل وتحتوي على حرف كبير، صغير، رقم، ورمز.')}${token ? `&token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}` : ''}`,
    );
  }

  const supabase = createSupabaseServerAuthClient();

  let signUpData:
    | Awaited<ReturnType<typeof supabase.auth.signUp>>['data']
    | null = null;
  let signUpError:
    | Awaited<ReturnType<typeof supabase.auth.signUp>>['error']
    | null = null;

  try {
    const { getPublicSiteUrl } = await import('@/lib/env');
    const result = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${getPublicSiteUrl()}/auth/callback`,
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
    redirect(
      `/signup?error=${encodeURIComponent('تعذّر الاتصال بخدمة المصادقة.')}${token ? `&token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}` : ''}`,
    );
  }

  if (signUpError) {
    redirect(
      `/signup?error=${encodeURIComponent(toArabicAuthError(signUpError.message))}${token ? `&token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}` : ''}`,
    );
  }

  // Send Welcome Email immediately after successful signup
  try {
    const { createSupabaseServerClient } = await import('@/lib/supabase/server');
    const { getPublicSiteUrl } = await import('@/lib/env');
    const { sendEmail } = await import('@/lib/email');
    const { WELCOME_EMAIL_SUBJECT, WELCOME_EMAIL_HTML } = await import('@/lib/email-templates');

    // Use Admin client to generate a signup link that works in production
    const supabaseAdmin = createSupabaseServerClient();
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'signup',
      email,
      password,
      options: {
        redirectTo: `${getPublicSiteUrl()}/auth/callback`,
      },
    });

    if (linkError) {
      console.error('Failed to generate verification link:', linkError);
      // Fallback: just send welcome email without link or with generic app link
    }

    const verificationLink = linkData?.properties?.action_link || `${getPublicSiteUrl()}/app`;

    await sendEmail({
      to: email,
      subject: WELCOME_EMAIL_SUBJECT,
      text: 'مرحباً بك في مسار المحامي. يرجى تفعيل حسابك للبدء.',
      html: WELCOME_EMAIL_HTML(fullName, verificationLink),
    });
  } catch (error) {
    console.error('Failed to send welcome email setup:', error);
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
      redirect(
        `/signup?error=${encodeURIComponent('هذا البريد الإلكتروني مسجل مسبقاً. يرجى تسجيل الدخول.')}${token ? `&token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}` : ''}`,
      );
    }

    if (signInError || !signInData?.session) {
      // If sign in fails after sign up, it usually means the user already exists 
      // or email confirmation is required.
      redirect(
        `/signup?error=${encodeURIComponent('هذا البريد الإلكتروني مسجل مسبقاً. يرجى تسجيل الدخول.')}${token ? `&token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}` : ''}`,
      );
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

  if (token && isSafeToken(token)) {
    redirect(`/invite/${token}`);
  }

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
    return 'كلمة المرور ضعيفة. يجب أن تكون 7 خانات، حرف كبير، صغير، رقم، ورمز.';
  }

  return `تعذر إنشاء الحساب. (${message})`;
}

function isSafeToken(value: string) {
  return /^[A-Za-z0-9_-]{20,200}$/.test(value);
}
