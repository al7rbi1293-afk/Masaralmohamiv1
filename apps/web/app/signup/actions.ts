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

  // Generate one activation link and send one welcome email.
  const { createSupabaseServerClient } = await import('@/lib/supabase/server');
  const supabaseAdmin = createSupabaseServerClient();
  const { getPublicSiteUrl } = await import('@/lib/env');
  const nextPath = token && isSafeToken(token) ? `/invite/${token}` : '/app';
  const redirectTo = `${getPublicSiteUrl()}/auth/callback?next=${encodeURIComponent(nextPath)}`;

  const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
    type: 'signup',
    email,
    password,
    options: {
      redirectTo,
      data: {
        full_name: fullName,
        phone: phone || null,
        firm_name: firmName || null,
      },
    },
  });

  if (linkError) {
    redirect(
      `/signup?error=${encodeURIComponent(toArabicAuthError(linkError.message))}${token ? `&token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}` : ''}`,
    );
  }

  const verificationLink = linkData?.properties?.action_link;

  if (!verificationLink) {
    redirect(
      `/signup?error=${encodeURIComponent('حدث خطأ أثناء إنشاء رابط التفعيل.')}`,
    );
  }

  // Send welcome + activation email
  try {
    const { sendEmail } = await import('@/lib/email');
    const { WELCOME_EMAIL_SUBJECT, WELCOME_EMAIL_HTML } = await import('@/lib/email-templates');

    await sendEmail({
      to: email,
      subject: WELCOME_EMAIL_SUBJECT,
      text: 'مرحباً بك في مسار المحامي. يرجى تفعيل حسابك للبدء.',
      html: WELCOME_EMAIL_HTML(fullName, verificationLink),
    });
  } catch (error) {
    console.error('Failed to send welcome email:', error);
  }

  // Redirect to verification pending page.
  redirect('/auth/verify');
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
