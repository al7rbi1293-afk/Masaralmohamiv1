import { NextRequest, NextResponse } from 'next/server';
import type { Session } from '@supabase/supabase-js';
import { z } from 'zod';
import {
  ACCESS_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
} from '@/lib/supabase/constants';
import { logError, logInfo, logWarn } from '@/lib/logger';
import { checkRateLimit, getRequestIp, RATE_LIMIT_MESSAGE_AR, type RateLimitResult } from '@/lib/rateLimit';
import { createSupabaseServerAuthClient, createSupabaseServerClient } from '@/lib/supabase/server';
import { getPublicSiteUrl } from '@/lib/env';
import { ensureTrialProvisionForUser } from '@/lib/onboarding';

const startTrialSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(1, 'يرجى إدخال الاسم الكامل.')
    .max(120, 'الاسم طويل جدًا.'),
  email: z
    .string()
    .trim()
    .email('يرجى إدخال بريد إلكتروني صحيح.')
    .max(255, 'البريد الإلكتروني طويل جدًا.'),
  password: z
    .string()
    .min(8, 'كلمة المرور يجب أن تكون 8 أحرف على الأقل.')
    .max(72, 'كلمة المرور طويلة جدًا.'),
  phone: z.string().trim().max(40, 'رقم الجوال طويل جدًا.').optional(),
  firm_name: z.string().trim().max(120, 'اسم المكتب طويل جدًا.').optional(),
  website: z.string().trim().max(0, 'تم رفض الطلب.'),
});

export async function POST(request: NextRequest) {
  const requestId = getOrCreateRequestId(request);
  const requestIp = getRequestIp(request);
  const rate = checkRateLimit({
    key: `start-trial:${requestIp}`,
    limit: 5,
    windowMs: 10 * 60 * 1000,
  });

  if (!rate.allowed) {
    logWarn('trial_start_failed', {
      requestId,
      ip: requestIp,
      reason: 'rate_limited',
      limit: rate.limit,
      remaining: rate.remaining,
    });

    return jsonResponse(
      {
        message: RATE_LIMIT_MESSAGE_AR,
      },
      429,
      requestId,
      rate,
    );
  }

  const formData = await request.formData();
  const parsed = startTrialSchema.safeParse({
    full_name: toText(formData, 'full_name'),
    email: toText(formData, 'email'),
    password: toText(formData, 'password'),
    phone: toText(formData, 'phone'),
    firm_name: toText(formData, 'firm_name'),
    website: toText(formData, 'website'),
  });

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? 'تعذر التحقق من البيانات.';
    logWarn('trial_start_failed', {
      requestId,
      ip: requestIp,
      reason: 'validation_failed',
      validationMessage: message,
    });

    return jsonResponse(
      { message },
      400,
      requestId,
      rate,
    );
  }

  const fullName = parsed.data.full_name;
  const email = parsed.data.email.toLowerCase();
  const password = parsed.data.password;
  const phone = emptyToNull(parsed.data.phone);
  const firmName = emptyToNull(parsed.data.firm_name);

  const adminClient = createSupabaseServerClient();
  const authClient = createSupabaseServerAuthClient();

  const { error: leadError } = await adminClient.from('leads').insert({
    full_name: fullName,
    email,
    phone,
    firm_name: firmName,
  });

  if (leadError) {
    logError('trial_start_failed', {
      requestId,
      ip: requestIp,
      reason: 'lead_insert_failed',
      error: leadError.message,
    });

    return jsonResponse(
      { message: 'تعذر حفظ طلب التجربة. حاول مرة أخرى.' },
      500,
      requestId,
      rate,
    );
  }

  const signInResult = await authClient.auth.signInWithPassword({ email, password });
  let session = signInResult.data.session;

  if (!session) {
    if (!isInvalidCredentials(signInResult.error?.message)) {
      logWarn('trial_start_failed', {
        requestId,
        ip: requestIp,
        reason: 'sign_in_failed',
        error: signInResult.error?.message ?? null,
      });

      return jsonResponse(
        { message: 'تعذر بدء التجربة. حاول مرة أخرى.' },
        401,
        requestId,
        rate,
      );
    }

    const siteUrl = getRequestSiteUrl(request);

    const { data: existingAuthUser, error: existingAuthUserError } = await adminClient
      .schema('auth')
      .from('users')
      .select('id, email_confirmed_at')
      .eq('email', email)
      .maybeSingle();

    if (existingAuthUserError) {
      logError('trial_start_failed', {
        requestId,
        ip: requestIp,
        reason: 'existing_auth_user_lookup_failed',
        error: existingAuthUserError.message,
      });

      return jsonResponse(
        { message: 'تعذر بدء التجربة. حاول مرة أخرى.' },
        500,
        requestId,
        rate,
      );
    }

    if (existingAuthUser && !(existingAuthUser as any).email_confirmed_at) {
      const nextPath = '/app';
      const redirectTo = `${siteUrl}/auth/callback?next=${encodeURIComponent(nextPath)}`;
      const magicLinkResult = await adminClient.auth.admin.generateLink({
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
        tokenHash: magicLinkResult.data?.properties?.hashed_token ?? null,
        fallbackActionLink: magicLinkResult.data?.properties?.action_link ?? null,
      });

      if (magicLinkResult.error || !verificationLink) {
        logError('trial_start_failed', {
          requestId,
          ip: requestIp,
          reason: 'activation_link_regeneration_failed',
          error: magicLinkResult.error?.message ?? null,
        });

        return jsonResponse(
          { message: 'تعذر إعادة إرسال رابط التفعيل. حاول مرة أخرى.' },
          500,
          requestId,
          rate,
        );
      }

      await sendWelcomeActivationEmail({
        email,
        fullName,
        verificationLink,
        requestId,
      });

      return jsonResponse(
        {
          message: 'الحساب موجود لكنه غير مفعّل. أعدنا إرسال رابط التفعيل إلى بريدك الإلكتروني.',
          redirectTo: '/auth/verify',
        },
        200,
        requestId,
        rate,
      );
    }

    if (existingAuthUser) {
      return jsonResponse(
        { message: 'هذا البريد مسجل بالفعل. استخدم تسجيل الدخول.' },
        409,
        requestId,
        rate,
      );
    }

    const nextPath = '/app';
    const redirectTo = `${siteUrl}/auth/callback?next=${encodeURIComponent(nextPath)}`;
    const createUserResult = await adminClient.auth.admin.generateLink({
      type: 'signup',
      email,
      password,
      options: {
        redirectTo,
        data: {
          full_name: fullName,
          phone,
          firm_name: firmName,
        },
      },
    });

    if (createUserResult.error) {
      if (isAlreadyRegistered(createUserResult.error.message)) {
        logWarn('signup_failed_existing_user', {
          requestId,
          ip: requestIp,
        });

        return jsonResponse(
          { message: 'هذا البريد مسجل بالفعل. استخدم تسجيل الدخول.' },
          409,
          requestId,
          rate,
        );
      }

      logError('trial_start_failed', {
        requestId,
        ip: requestIp,
        reason: 'signup_create_failed',
        error: createUserResult.error.message,
      });

      return jsonResponse(
        { message: 'تعذر إنشاء الحساب. حاول مرة أخرى.' },
        500,
        requestId,
        rate,
      );
    }

    const verificationLink = buildVerificationLink({
      siteUrl,
      nextPath,
      otpType: 'signup',
      tokenHash: createUserResult.data?.properties?.hashed_token ?? null,
      fallbackActionLink: createUserResult.data?.properties?.action_link ?? null,
    });

    if (!verificationLink) {
      return jsonResponse(
        { message: 'تعذر إنشاء رابط التفعيل. حاول مرة أخرى.' },
        500,
        requestId,
        rate,
      );
    }

    await sendWelcomeActivationEmail({
      email,
      fullName,
      verificationLink,
      requestId,
    });

    logInfo('signup_activation_sent', {
      requestId,
      ip: requestIp,
      email,
    });

    return jsonResponse(
      {
        message: 'تم إنشاء الحساب. تحقق من بريدك الإلكتروني لتفعيل الحساب.',
        redirectTo: '/auth/verify',
      },
      200,
      requestId,
      rate,
    );
  }

  try {
    const userId = session.user.id;
    const { isExpired } = await ensureTrialProvisionForUser({
      userId,
      firmName,
    });

    const destination = isExpired ? '/app/expired' : '/app';
    if (isExpired) {
      logWarn('trial_expired_redirect', {
        requestId,
        ip: requestIp,
        userId,
      });
    } else {
      logInfo('trial_started', {
        requestId,
        ip: requestIp,
        userId,
      });
    }

    return buildSessionSuccessResponse(destination, session, requestId, rate);
  } catch (error) {
    logError('trial_start_failed', {
      requestId,
      ip: requestIp,
      reason: 'provision_failed',
      error: toErrorMessage(error),
    });

    return jsonResponse(
      { message: 'تعذر تهيئة التجربة. حاول مرة أخرى.' },
      500,
      requestId,
      rate,
    );
  }
}

function buildSessionSuccessResponse(
  destination: '/app' | '/app/expired',
  session: Session,
  requestId: string,
  rate: RateLimitResult,
) {
  // Important: don't issue an HTTP redirect here because `fetch()` follows redirects
  // before processing `Set-Cookie`, which causes the redirected request to miss auth cookies.
  // Return JSON + cookies, then the client navigates to `redirectTo`.
  const response = NextResponse.json(
    {
      redirectTo: destination,
      requestId,
    },
    { status: 200 },
  );

  response.cookies.set(ACCESS_COOKIE_NAME, session.access_token, {
    ...SESSION_COOKIE_OPTIONS,
    maxAge: session.expires_in,
  });
  response.cookies.set(REFRESH_COOKIE_NAME, session.refresh_token, {
    ...SESSION_COOKIE_OPTIONS,
    maxAge: 60 * 60 * 24 * 30,
  });
  setRequestIdHeader(response, requestId);
  setRateLimitHeaders(response, rate);
  return response;
}

function toText(formData: FormData, field: string) {
  const value = formData.get(field);
  return typeof value === 'string' ? value : '';
}

function emptyToNull(value?: string) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function isInvalidCredentials(message?: string) {
  if (!message) {
    return false;
  }

  return message.toLowerCase().includes('invalid login credentials');
}

function isAlreadyRegistered(message?: string) {
  if (!message) {
    return false;
  }

  const normalized = message.toLowerCase();
  return normalized.includes('already') || normalized.includes('registered');
}

function getRequestSiteUrl(request: NextRequest) {
  const forwardedHost = request.headers
    .get('x-forwarded-host')
    ?.split(',')[0]
    ?.trim();
  const host = forwardedHost || request.headers.get('host')?.trim();
  const forwardedProto = request.headers
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

async function sendWelcomeActivationEmail(params: {
  email: string;
  fullName: string;
  verificationLink: string;
  requestId: string;
}) {
  try {
    const { sendEmail } = await import('@/lib/email');
    const { WELCOME_EMAIL_SUBJECT, WELCOME_EMAIL_HTML } = await import('@/lib/email-templates');
    await sendEmail({
      to: params.email,
      subject: WELCOME_EMAIL_SUBJECT,
      text: 'مرحباً بك في مسار المحامي. يرجى تفعيل حسابك عبر الرابط المرفق.',
      html: WELCOME_EMAIL_HTML(params.fullName, params.verificationLink),
    });
  } catch (error) {
    logWarn('welcome_email_failed', {
      requestId: params.requestId,
      email: params.email,
      error: toErrorMessage(error),
    });
    throw error;
  }
}

function getOrCreateRequestId(request: NextRequest) {
  const incoming = request.headers.get('x-request-id')?.trim();
  if (incoming) {
    return incoming;
  }

  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}`;
}

function jsonResponse(
  body: { message: string; redirectTo?: string },
  status: number,
  requestId: string,
  rate: RateLimitResult,
) {
  const response = NextResponse.json(
    {
      ...body,
      requestId,
    },
    { status },
  );

  setRequestIdHeader(response, requestId);
  setRateLimitHeaders(response, rate);
  return response;
}

function setRequestIdHeader(response: NextResponse, requestId: string) {
  response.headers.set('x-request-id', requestId);
}

function setRateLimitHeaders(response: NextResponse, rate: RateLimitResult) {
  response.headers.set('x-ratelimit-limit', String(rate.limit));
  response.headers.set('x-ratelimit-remaining', String(rate.remaining));
  response.headers.set('x-ratelimit-reset', String(Math.floor(rate.resetAt / 1000)));
}

function toErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return 'unknown_error';
}
