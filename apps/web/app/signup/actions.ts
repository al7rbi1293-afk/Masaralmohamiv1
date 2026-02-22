'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { checkRateLimit, RATE_LIMIT_MESSAGE_AR } from '@/lib/rateLimit';
import { hashPassword } from '@/lib/auth-custom';
import { verifyCsrfToken } from '@/lib/csrf';

export async function signUpAction(formData: FormData) {
  const isCsrfValid = await verifyCsrfToken(formData);
  if (!isCsrfValid) {
    redirect(`/signup?error=${encodeURIComponent('انتهت صلاحية الجلسة. أعد تحميل الصفحة.')}`);
  }

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

  const db = createSupabaseServerClient();
  const siteUrl = getRequestSiteUrl();
  const nextPath = token && isSafeToken(token) ? `/invite/${token}` : '/app';

  // Check if user already exists
  const { data: existingUser } = await db.from('app_users').select('id, email_verified').eq('email', email).maybeSingle();
  if (existingUser) {
    if (existingUser.email_verified) {
      redirect(`/signin?error=${encodeURIComponent('هذا البريد مسجل مسبقًا. استخدم تسجيل الدخول.')}&email=${encodeURIComponent(email)}`);
    } else {
      redirect(buildPendingActivationHref(email, token));
    }
  }

  const passwordHash = await hashPassword(password);
  const verificationToken = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24);

  const { data: newUser, error: createError } = await db.from('app_users').insert({
    email,
    password_hash: passwordHash,
    full_name: fullName,
    phone: phone || null,
    status: 'active',
    email_verified: false,
    email_verification_token: verificationToken,
    email_verification_expires_at: expiresAt.toISOString(),
  }).select('id').single();

  if (createError || !newUser) {
    redirect(
      `/signup?error=${encodeURIComponent('تعذر إنشاء الحساب. حاول مرة أخرى.')}${token ? `&token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}` : ''}`,
    );
  }

  await db.from('profiles').upsert({
    user_id: newUser.id,
    full_name: fullName,
    phone: phone || null,
  }, { onConflict: 'user_id' });

  const verificationLink = `${siteUrl}/api/verify-email?token=${verificationToken}&email=${encodeURIComponent(email)}&next=${encodeURIComponent(nextPath)}`;

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
  redirect(buildPendingActivationHref(email, token));
}

export async function resendActivationAction(formData: FormData) {
  const token = String(formData.get('token') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim().toLowerCase();

  if (!email) {
    redirect(`/signup?error=${encodeURIComponent('يرجى إدخال البريد الإلكتروني.')}`);
  }

  const ip = getServerActionIp();
  const rate = await checkRateLimit({
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
  const db = createSupabaseServerClient();

  const nextPath = token && isSafeToken(token) ? `/invite/${token}` : '/app';

  const { data: user } = await db.from('app_users').select('id, email_verified').eq('email', email).maybeSingle();
  if (!user) {
    redirect(`/signup?error=${encodeURIComponent('الحساب غير موجود.')}&email=${encodeURIComponent(email)}${token ? `&token=${encodeURIComponent(token)}` : ''}`);
  }
  if (user.email_verified) {
    redirect(`/signin?success=${encodeURIComponent('الحساب مفعل مسبقاً، يمكنك تسجيل الدخول.')}&email=${encodeURIComponent(email)}`);
  }

  const verificationToken = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24);

  const { error: updateError } = await db.from('app_users').update({
    email_verification_token: verificationToken,
    email_verification_expires_at: expiresAt.toISOString(),
  }).eq('id', user.id);

  if (updateError) {
    redirect(
      `/signup?error=${encodeURIComponent('تعذر إعادة إرسال رسالة التفعيل. حاول مرة أخرى.')}&email=${encodeURIComponent(email)}${token ? `&token=${encodeURIComponent(token)}` : ''}`,
    );
  }

  const verificationLink = `${siteUrl}/api/verify-email?token=${verificationToken}&email=${encodeURIComponent(email)}&next=${encodeURIComponent(nextPath)}`;

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

  return process.env.NEXT_PUBLIC_SITE_URL || 'https://masaralmohami.com';
}
