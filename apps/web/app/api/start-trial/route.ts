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

type MembershipRow = {
  org_id: string;
};

type TrialRow = {
  ends_at: string;
  status: 'active' | 'expired';
};

type OrgRow = {
  id: string;
};

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

    const createUserResult = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        phone,
      },
    });

    if (createUserResult.error) {
      if (isAlreadyRegistered(createUserResult.error.message)) {
        logWarn('signup_failed_existing_user', {
          requestId,
          ip: requestIp,
        });

        const redirectUrl = new URL('/signin', request.url);
        redirectUrl.searchParams.set('email', email);
        redirectUrl.searchParams.set('reason', 'exists');
        const response = NextResponse.redirect(redirectUrl, 303);
        setRequestIdHeader(response, requestId);
        setRateLimitHeaders(response, rate);
        return response;
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

    logInfo('signup_success', {
      requestId,
      ip: requestIp,
      userId: createUserResult.data.user?.id ?? null,
    });

    const secondSignInResult = await authClient.auth.signInWithPassword({ email, password });
    if (secondSignInResult.error || !secondSignInResult.data.session) {
      logWarn('trial_start_failed', {
        requestId,
        ip: requestIp,
        reason: 'post_signup_sign_in_failed',
        error: secondSignInResult.error?.message ?? null,
      });

      return jsonResponse(
        { message: 'تم إنشاء الحساب لكن تعذر تسجيل الدخول. استخدم صفحة تسجيل الدخول.' },
        500,
        requestId,
        rate,
      );
    }

    session = secondSignInResult.data.session;
  }

  try {
    const userId = session.user.id;
    const { isExpired } = await provisionTrial({
      adminClient,
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



    // Send Welcome Email
    try {
      const { sendEmail } = await import('@/lib/email');
      const { WELCOME_EMAIL_SUBJECT, WELCOME_EMAIL_HTML } = await import('@/lib/email-templates');

      await sendEmail({
        to: email,
        subject: WELCOME_EMAIL_SUBJECT,
        text: 'مرحباً بك في مسار المحامي. لقد تم إنشاء حسابك بنجاح.',
        html: WELCOME_EMAIL_HTML(fullName),
      });
    } catch (error) {
      logWarn('welcome_email_failed', {
        requestId,
        email,
        error: toErrorMessage(error),
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

async function provisionTrial(params: {
  adminClient: ReturnType<typeof createSupabaseServerClient>;
  userId: string;
  firmName: string | null;
}) {
  const { adminClient, userId, firmName } = params;

  const { data: membershipData, error: membershipError } = await adminClient
    .from('memberships')
    .select('org_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    throw membershipError;
  }

  let orgId = (membershipData as MembershipRow | null)?.org_id ?? null;

  if (!orgId) {
    const { data: organizationData, error: organizationError } = await adminClient
      .from('organizations')
      .insert({
        name: firmName ?? 'مكتب جديد',
      })
      .select('id')
      .single();

    if (organizationError) {
      throw organizationError;
    }

    orgId = (organizationData as OrgRow).id;

    const { error: membershipInsertError } = await adminClient.from('memberships').insert({
      org_id: orgId,
      user_id: userId,
      role: 'owner',
    });

    if (membershipInsertError) {
      throw membershipInsertError;
    }
  }

  const { data: trialData, error: trialError } = await adminClient
    .from('trial_subscriptions')
    .select('ends_at, status')
    .eq('org_id', orgId)
    .maybeSingle();

  if (trialError) {
    throw trialError;
  }

  const trial = trialData as TrialRow | null;

  if (!trial) {
    const now = Date.now();
    const { error: trialInsertError } = await adminClient.from('trial_subscriptions').insert({
      org_id: orgId,
      started_at: new Date(now).toISOString(),
      ends_at: new Date(now + 14 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'active',
    });

    if (trialInsertError) {
      throw trialInsertError;
    }

    return {
      orgId,
      isExpired: false,
    };
  }

  const isExpired = trial.status === 'expired' || Date.now() >= new Date(trial.ends_at).getTime();

  return {
    orgId,
    isExpired,
  };
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
  body: { message: string },
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
