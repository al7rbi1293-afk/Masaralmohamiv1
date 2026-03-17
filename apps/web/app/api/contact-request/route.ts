import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logError, logInfo, logWarn } from '@/lib/logger';
import { SESSION_COOKIE_NAME, verifySessionToken } from '@/lib/auth-custom';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/email';
import { getSignupAlertEmails } from '@/lib/env';

const contactRequestSchema = z.object({
  full_name: z.string().trim().max(120, 'الاسم طويل جدًا.').optional(),
  email: z
    .string()
    .trim()
    .email('يرجى إدخال بريد إلكتروني صحيح.')
    .max(255, 'البريد الإلكتروني طويل جدًا.'),
  phone: z.string().trim().max(40, 'رقم الجوال طويل جدًا.').optional(),
  firm_name: z.string().trim().max(120, 'اسم المكتب طويل جدًا.').optional(),
  message: z.string().trim().max(2000, 'الرسالة طويلة جدًا.').optional(),
  source: z.enum(['app', 'landing', 'contact', 'subscription']).default('contact'),
  website: z.string().trim().max(0, 'تم رفض الطلب.').optional(),
});

type MembershipRow = {
  org_id: string;
};

type AuthUser = {
  id: string;
  email: string;
};

type ContactRequestSource = z.infer<typeof contactRequestSchema>['source'];

export async function POST(request: NextRequest) {
  const requestId = getOrCreateRequestId(request);
  const requestIp = getRequestIp(request);
  const rate = await checkRateLimit({
    key: `contact-request:${requestIp}`,
    limit: 10,
    windowMs: 10 * 60 * 1000,
  });

  if (!rate.allowed) {
    logWarn('contact_request_rate_limited', {
      requestId,
      ip: requestIp,
      limit: rate.limit,
      remaining: rate.remaining,
    });
    return jsonResponse({ message: RATE_LIMIT_MESSAGE_AR }, 429, requestId, rate);
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    logWarn('contact_request_failed', {
      requestId,
      ip: requestIp,
      reason: 'invalid_json',
    });
    return jsonResponse({ message: 'تعذر قراءة البيانات المرسلة.' }, 400, requestId, rate);
  }

  const parsed = contactRequestSchema.safeParse(payload);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? 'تعذر التحقق من البيانات.';
    logWarn('contact_request_failed', {
      requestId,
      ip: requestIp,
      reason: 'validation_failed',
      validationMessage: message,
    });
    return jsonResponse({ message }, 400, requestId, rate);
  }

  const db = createSupabaseServerClient();

  // Resolve current user from custom JWT
  const currentUser = await resolveCurrentUser(request);

  let orgId: string | null = null;
  if (currentUser) {
    const { data: membershipData } = await db
      .from('memberships')
      .select('org_id')
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    orgId = (membershipData as MembershipRow | null)?.org_id ?? null;
  }

  const insertBase = {
    org_id: orgId,
    full_name: emptyToNull(parsed.data.full_name),
    email: parsed.data.email.toLowerCase(),
    phone: emptyToNull(parsed.data.phone),
    firm_name: emptyToNull(parsed.data.firm_name),
    message: emptyToNull(parsed.data.message),
  };

  const insertWithSource = async (
    source: ContactRequestSource,
    includeTypeColumn: boolean,
    includeUserId: boolean,
  ) => {
    const payload: Record<string, unknown> = {
      ...insertBase,
      source,
      user_id: includeUserId ? currentUser?.id ?? null : null,
    };

    // Some deployments have the "type" column required, others still don't have it.
    if (includeTypeColumn) {
      payload.type = 'activation_request';
    }

    return db.from('full_version_requests').insert(payload);
  };

  let includeTypeColumn = true;
  let includeUserId = true;
  let persistedSource: ContactRequestSource = parsed.data.source;
  let error: { message?: string } | null = null;

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const result = await insertWithSource(persistedSource, includeTypeColumn, includeUserId);
    error = result.error;

    if (!error) {
      break;
    }

    if (includeTypeColumn && isMissingColumnError(error.message)) {
      includeTypeColumn = false;
      continue;
    }

    if (persistedSource === 'subscription' && isLegacySourceConstraintError(error.message)) {
      persistedSource = 'contact';
      logWarn('contact_request_source_fallback', {
        requestId,
        ip: requestIp,
        requestedSource: parsed.data.source,
        persistedSource,
      });
      continue;
    }

    if (includeUserId && isLegacyUserIdForeignKeyError(error.message)) {
      includeUserId = false;
      logWarn('contact_request_user_fk_fallback', {
        requestId,
        ip: requestIp,
        requestedSource: parsed.data.source,
        persistedSource,
      });
      continue;
    }

    break;
  }

  if (error) {
    logError('contact_request_failed', {
      requestId,
      ip: requestIp,
      source: parsed.data.source,
      error: error.message,
    });
    return jsonResponse({ message: 'تعذر إرسال طلبك. حاول مرة أخرى.' }, 500, requestId, rate);
  }

  logInfo('contact_request_created', {
    requestId,
    ip: requestIp,
    source: persistedSource,
    requestedSource: parsed.data.source,
    orgId,
    userId: currentUser?.id ?? null,
  });

  const notifyAdmin = async () => {
    if (!SIGNUP_ALERT_EMAILS) return;
    const adminEmails = SIGNUP_ALERT_EMAILS.split(',').map((e) => e.trim()).filter(Boolean);
    if (!adminEmails.length) return;

    try {
      await sendEmail({
        to: adminEmails[0],
        cc: adminEmails.slice(1),
        subject: `طلب تفعيل / تواصل جديد (مسار المحامي) - ${parsed.data.full_name || 'بدون اسم'}`,
        html: `
          <div dir="rtl" style="font-family: sans-serif; line-height: 1.6;">
            <h2 style="color: #0284c7;">تفاصيل الطلب</h2>
            <p><strong>الاسم:</strong> ${parsed.data.full_name || 'غير محدد'}</p>
            <p><strong>البريد:</strong> ${parsed.data.email}</p>
            <p><strong>الجوال:</strong> ${parsed.data.phone || 'غير محدد'}</p>
            <p><strong>اسم المكتب/الشركة:</strong> ${parsed.data.firm_name || 'غير محدد'}</p>
            <p><strong>المصدر:</strong> ${parsed.data.source}</p>
            <br/>
            <p><strong>الرسالة:</strong></p>
            <div style="background: #f8fafc; padding: 12px; border-radius: 6px; border: 1px solid #e2e8f0; white-space: pre-wrap;">
              ${parsed.data.message || 'لا توجد رسالة.'}
            </div>
          </div>
        `,
      });
      logInfo('contact_request_admin_notified', { requestId, emails: adminEmails });
    } catch (notifyError) {
      logWarn('contact_request_admin_notify_failed', {
        requestId,
        error: notifyError instanceof Error ? notifyError.message : String(notifyError),
      });
    }
  };

  // Dispatch background notification
  void notifyAdmin();

  return jsonResponse(
    {
      success: true,
      message: 'تم استلام طلبك. سنتواصل معك قريبًا.',
    },
    200,
    requestId,
    rate,
  );
}

async function resolveCurrentUser(request: NextRequest): Promise<AuthUser | null> {
  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionToken) return null;

  const payload = await verifySessionToken(sessionToken);
  if (!payload) return null;

  return { id: payload.userId, email: payload.email };
}

function emptyToNull(value?: string) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function isMissingColumnError(message?: string) {
  const normalized = String(message ?? '').toLowerCase();
  return (
    (normalized.includes('column') && normalized.includes('does not exist')) ||
    (normalized.includes('could not find') && normalized.includes('column'))
  );
}

function isLegacySourceConstraintError(message?: string) {
  const normalized = String(message ?? '').toLowerCase();
  return (
    normalized.includes('full_version_requests_source_check') ||
    (normalized.includes('check constraint') && normalized.includes('source'))
  );
}

function isLegacyUserIdForeignKeyError(message?: string) {
  const normalized = String(message ?? '').toLowerCase();
  return (
    normalized.includes('full_version_requests_user_id_fkey') ||
    (normalized.includes('foreign key') && normalized.includes('user_id'))
  );
}

function getOrCreateRequestId(request: NextRequest) {
  const incoming = request.headers.get('x-request-id')?.trim();
  if (incoming) return incoming;
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now()}`;
}

function jsonResponse(
  body: { message: string; success?: boolean },
  status: number,
  requestId: string,
  rate: RateLimitResult,
) {
  const response = NextResponse.json({ ...body, requestId }, { status });
  response.headers.set('x-request-id', requestId);
  response.headers.set('x-ratelimit-limit', String(rate.limit));
  response.headers.set('x-ratelimit-remaining', String(rate.remaining));
  response.headers.set('x-ratelimit-reset', String(Math.floor(rate.resetAt / 1000)));
  return response;
}
