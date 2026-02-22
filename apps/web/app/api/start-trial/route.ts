import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
  hashPassword,
  verifyPassword,
  generateSessionToken,
} from '@/lib/auth-custom';
import { logError, logInfo, logWarn } from '@/lib/logger';
import { checkRateLimit, getRequestIp, RATE_LIMIT_MESSAGE_AR, type RateLimitResult } from '@/lib/rateLimit';
import { createSupabaseServerClient } from '@/lib/supabase/server';
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
  const rate = await checkRateLimit({
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
    return jsonResponse({ message: RATE_LIMIT_MESSAGE_AR }, 429, requestId, rate);
  }

  const payload = await readStartTrialPayload(request);
  if (!payload.ok) {
    logWarn('trial_start_failed', {
      requestId,
      ip: requestIp,
      reason: payload.reason,
    });
    return jsonResponse({ message: payload.message }, 400, requestId, rate);
  }

  const parsed = startTrialSchema.safeParse(payload.value);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? 'تعذر التحقق من البيانات.';
    logWarn('trial_start_failed', {
      requestId,
      ip: requestIp,
      reason: 'validation_failed',
      validationMessage: message,
    });
    return jsonResponse({ message }, 400, requestId, rate);
  }

  const fullName = parsed.data.full_name;
  const email = parsed.data.email.toLowerCase();
  const password = parsed.data.password;
  const phone = emptyToNull(parsed.data.phone);
  const firmName = emptyToNull(parsed.data.firm_name);

  const db = createSupabaseServerClient();

  // Save lead
  const { error: leadError } = await db.from('leads').insert({
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
    return jsonResponse({ message: 'تعذر حفظ طلب التجربة. حاول مرة أخرى.' }, 500, requestId, rate);
  }

  // Check if user already exists
  const { data: existingUser } = await db
    .from('app_users')
    .select('id, password_hash, email_verified')
    .eq('email', email)
    .maybeSingle();

  let userId: string;

  if (existingUser) {
    // User exists — try to sign them in with provided password
    const passwordMatch = await verifyPassword(password, existingUser.password_hash);
    if (!passwordMatch) {
      return jsonResponse({
        message: 'الحساب موجود بالفعل. يرجى تسجيل الدخول بكلمة المرور الصحيحة.',
      }, 400, requestId, rate);
    }
    userId = existingUser.id;
  } else {
    // Create new user in app_users
    const passwordHash = await hashPassword(password);
    const { data: newUser, error: createError } = await db
      .from('app_users')
      .insert({
        email,
        password_hash: passwordHash,
        full_name: fullName,
        phone,
        email_verified: true,
        status: 'active',
      })
      .select('id')
      .single();

    if (createError || !newUser) {
      logError('trial_start_failed', {
        requestId,
        ip: requestIp,
        reason: 'user_create_failed',
        error: createError?.message ?? 'unknown',
      });
      return jsonResponse({ message: 'تعذر إنشاء الحساب. حاول مرة أخرى.' }, 500, requestId, rate);
    }

    userId = newUser.id;

    // Create profile for the user
    await db
      .from('profiles')
      .upsert({
        user_id: userId,
        full_name: fullName,
        phone,
      }, { onConflict: 'user_id' });
  }

  // Ensure trial provisioning
  try {
    const { isExpired } = await ensureTrialProvisionForUser({
      userId,
      firmName,
    });

    const destination = isExpired ? '/app/expired' : '/app';

    if (isExpired) {
      logWarn('trial_expired_redirect', { requestId, ip: requestIp, userId });
    } else {
      logInfo('trial_started', { requestId, ip: requestIp, userId });
    }

    // Generate JWT session
    const sessionToken = generateSessionToken({ userId, email });

    const response = NextResponse.json(
      { redirectTo: destination, requestId },
      { status: 200 },
    );

    response.cookies.set(SESSION_COOKIE_NAME, sessionToken, SESSION_COOKIE_OPTIONS);
    // Clear old Supabase cookies
    response.cookies.delete('masar-sb-access-token');
    response.cookies.delete('masar-sb-refresh-token');
    setRequestIdHeader(response, requestId);
    setRateLimitHeaders(response, rate);
    return response;
  } catch (error) {
    logError('trial_start_failed', {
      requestId,
      ip: requestIp,
      reason: 'provision_failed',
      error: toErrorMessage(error),
    });
    return jsonResponse({ message: 'تعذر تهيئة التجربة. حاول مرة أخرى.' }, 500, requestId, rate);
  }
}

// ────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────

function toText(formData: FormData, field: string) {
  const value = formData.get(field);
  return typeof value === 'string' ? value : '';
}

function toObjectText(value: unknown) {
  return typeof value === 'string' ? value : '';
}

async function readStartTrialPayload(request: NextRequest): Promise<
  | {
    ok: true;
    value: {
      full_name: string;
      email: string;
      password: string;
      phone: string;
      firm_name: string;
      website: string;
    };
  }
  | {
    ok: false;
    reason: string;
    message: string;
  }
> {
  const contentType = request.headers.get('content-type')?.toLowerCase() ?? '';

  if (contentType.includes('application/json')) {
    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return { ok: false, reason: 'invalid_json', message: 'تعذر قراءة البيانات المرسلة.' };
    }
    if (!raw || typeof raw !== 'object') {
      return { ok: false, reason: 'invalid_json_shape', message: 'تعذر قراءة البيانات المرسلة.' };
    }
    const data = raw as Record<string, unknown>;
    return {
      ok: true,
      value: {
        full_name: toObjectText(data.full_name ?? data.fullName),
        email: toObjectText(data.email),
        password: toObjectText(data.password),
        phone: toObjectText(data.phone),
        firm_name: toObjectText(data.firm_name ?? data.firmName),
        website: toObjectText(data.website),
      },
    };
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return { ok: false, reason: 'invalid_form_data', message: 'تعذر قراءة البيانات المرسلة.' };
  }

  return {
    ok: true,
    value: {
      full_name: toText(formData, 'full_name'),
      email: toText(formData, 'email'),
      password: toText(formData, 'password'),
      phone: toText(formData, 'phone'),
      firm_name: toText(formData, 'firm_name'),
      website: toText(formData, 'website'),
    },
  };
}

function emptyToNull(value?: string) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function getOrCreateRequestId(request: NextRequest) {
  const incoming = request.headers.get('x-request-id')?.trim();
  if (incoming) return incoming;
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now()}`;
}

function jsonResponse(
  body: { message: string; redirectTo?: string },
  status: number,
  requestId: string,
  rate: RateLimitResult,
) {
  const response = NextResponse.json({ ...body, requestId }, { status });
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
  if (error instanceof Error) return error.message;
  return 'unknown_error';
}
