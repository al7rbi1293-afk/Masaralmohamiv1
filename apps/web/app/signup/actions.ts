'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { checkRateLimit, RATE_LIMIT_MESSAGE_AR } from '@/lib/rateLimit';
import { getPublicSiteUrl } from '@/lib/env';

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

  const supabaseAdmin = createSupabaseServerClient();
  const siteUrl = getRequestSiteUrl();
  const nextPath = token && isSafeToken(token) ? `/invite/${token}` : '/app';
  const redirectTo = `${siteUrl}/auth/callback?next=${encodeURIComponent(nextPath)}`;

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
    if (isAlreadyRegisteredError(linkError.message)) {
      redirect(buildPendingActivationHref(email, token));
    }

    redirect(
      `/signup?error=${encodeURIComponent(toArabicAuthError(linkError.message))}${token ? `&token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}` : ''}`,
    );
  }

  const verificationLink = buildVerificationLink({
    siteUrl,
    nextPath,
    otpType: 'signup',
    tokenHash: linkData?.properties?.hashed_token ?? null,
    fallbackActionLink: linkData?.properties?.action_link ?? null,
  });

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

export async function resendActivationAction(formData: FormData) {
  const token = String(formData.get('token') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim().toLowerCase();

  if (!email) {
    redirect(`/signup?error=${encodeURIComponent('يرجى إدخال البريد الإلكتروني.')}`);
  }

  const ip = getServerActionIp();
  const rate = checkRateLimit({
    key: `signup:resend:${ip}:${email}`,
    limit: 3,
    windowMs: 10 * 60 * 1000,
  });

  if (!rate.allowed) {
    redirect(
      `/signup?error=${encodeURIComponent(RATE_LIMIT_MESSAGE_AR)}&email=${encodeURIComponent(email)}${token ? `&token=${encodeURIComponent(token)}` : ''}`,
    );
  }

  const siteUrl = getRequestSiteUrl();
  const supabaseAdmin = createSupabaseServerClient();

  const nextPath = token && isSafeToken(token) ? `/invite/${token}` : '/app';
  const redirectTo = `${siteUrl}/auth/callback?next=${encodeURIComponent(nextPath)}`;

  const linkResult = await supabaseAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: {
      redirectTo,
    },
  });

  const verificationLink = buildVerificationLink({
    siteUrl,
    nextPath,
    otpType: 'magiclink',
    tokenHash: linkResult.data?.properties?.hashed_token ?? null,
    fallbackActionLink: linkResult.data?.properties?.action_link ?? null,
  });

  if (linkResult.error || !verificationLink) {
    redirect(
      `/signup?error=${encodeURIComponent('تعذر إعادة إرسال رسالة التفعيل. حاول مرة أخرى.')}&email=${encodeURIComponent(email)}${token ? `&token=${encodeURIComponent(token)}` : ''}`,
    );
  }

  try {
    const { sendEmail } = await import('@/lib/email');
    const { WELCOME_EMAIL_SUBJECT, WELCOME_EMAIL_HTML } = await import('@/lib/email-templates');

    await sendEmail({
      to: email,
      subject: WELCOME_EMAIL_SUBJECT,
      text: 'مرحباً بك في مسار المحامي. يرجى تفعيل حسابك للبدء.',
      html: WELCOME_EMAIL_HTML('عميلنا الكريم', verificationLink),
    });
  } catch {
    redirect(
      `/signup?error=${encodeURIComponent('تم إنشاء رابط التفعيل لكن تعذر إرسال البريد. حاول مرة أخرى.')}&email=${encodeURIComponent(email)}${token ? `&token=${encodeURIComponent(token)}` : ''}`,
    );
  }

  redirect(
    `/signup?status=activation_resent&email=${encodeURIComponent(email)}${token ? `&token=${encodeURIComponent(token)}` : ''}`,
  );
}

function toArabicAuthError(message?: string) {
  if (!message) {
    return 'تعذر إنشاء الحساب. حاول مرة أخرى.';
  }

  const normalized = message.toLowerCase();

  if (normalized.includes('user already registered') || normalized.includes('already been registered')) {
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

function isAlreadyRegisteredError(message?: string) {
  const normalized = String(message ?? '').toLowerCase();
  return normalized.includes('user already registered') || normalized.includes('already been registered');
}

function getServerActionIp() {
  const h = headers();
  const forwardedFor = h.get('x-forwarded-for');
  if (forwardedFor) {
    const [first] = forwardedFor.split(',');
    if (first?.trim()) {
      return first.trim();
    }
  }
  const realIp = h.get('x-real-ip');
  return realIp?.trim() || 'unknown';
}

function buildPendingActivationHref(email: string, token: string) {
  return `/signup?status=pending_activation&email=${encodeURIComponent(email)}${token ? `&token=${encodeURIComponent(token)}` : ''}`;
}

function getRequestSiteUrl() {
  const h = headers();
  const forwardedHost = h
    .get('x-forwarded-host')
    ?.split(',')[0]
    ?.trim();
  const host = forwardedHost || h.get('host')?.trim();
  const forwardedProto = h
    .get('x-forwarded-proto')
    ?.split(',')[0]
    ?.trim();
  const proto = forwardedProto || (host?.includes('localhost') ? 'http' : 'https');

  if (host) {
    return `${proto}://${host}`;
  }

  return getPublicSiteUrl();
}

function buildVerificationLink(params: {
  siteUrl: string;
  nextPath: string;
  otpType: 'signup' | 'magiclink';
  tokenHash: string | null;
  fallbackActionLink: string | null;
}) {
  if (params.tokenHash) {
    return `${params.siteUrl}/auth/callback?token_hash=${encodeURIComponent(params.tokenHash)}&type=${encodeURIComponent(params.otpType)}&next=${encodeURIComponent(params.nextPath)}`;
  }

  return params.fallbackActionLink;
}
