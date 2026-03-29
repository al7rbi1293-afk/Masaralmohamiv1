import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getPublicSiteUrl, getSignupAlertEmails } from '@/lib/env';
import { sendEmail } from '@/lib/email';
import { logError, logInfo, logWarn } from '@/lib/logger';
import { checkRateLimit, getRequestIp, RATE_LIMIT_MESSAGE_AR, type RateLimitResult } from '@/lib/rateLimit';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const leadSchema = z.object({
    name: z
        .string()
        .trim()
        .min(1, 'يرجى إدخال الاسم.')
        .max(120, 'الاسم طويل جدًا.'),
    email: z
        .string()
        .trim()
        .email('يرجى إدخال بريد إلكتروني صحيح.')
        .max(255, 'البريد الإلكتروني طويل جدًا.'),
    firm_name: z.string().trim().max(120, 'اسم المكتب طويل جدًا.').optional(),
    phone: z.string().trim().max(40, 'رقم الجوال طويل جدًا.').optional(),
    topic: z.string().trim().max(120, 'الموضوع طويل جدًا.').optional(),
    message: z.string().trim().max(2000, 'الرسالة طويلة جدًا.').optional(),
    utm: z
        .object({
            source: z.string().max(200).optional(),
            medium: z.string().max(200).optional(),
            campaign: z.string().max(200).optional(),
            term: z.string().max(200).optional(),
            content: z.string().max(200).optional(),
        })
        .optional(),
    referrer: z.string().trim().max(500, 'الرابط المرجعي طويل جدًا.').optional(),
    // honeypot — must be empty
    website: z.string().trim().max(0, 'تم رفض الطلب.').optional(),
});

export async function POST(request: NextRequest) {
    const requestId = getOrCreateRequestId(request);
    const requestIp = getRequestIp(request);
    const rate = await checkRateLimit({
        key: `leads:${requestIp}`,
        limit: 10,
        windowMs: 10 * 60 * 1000,
    });

    if (!rate.allowed) {
        logWarn('lead_rate_limited', {
            requestId,
            ip: requestIp,
            limit: rate.limit,
            remaining: rate.remaining,
        });

        return jsonResponse(
            { message: RATE_LIMIT_MESSAGE_AR },
            429,
            requestId,
            rate,
        );
    }

    let payload: unknown;
    try {
        payload = await request.json();
    } catch {
        logWarn('lead_submit_failed', {
            requestId,
            ip: requestIp,
            reason: 'invalid_json',
        });

        return jsonResponse(
            { message: 'تعذر قراءة البيانات المرسلة.' },
            400,
            requestId,
            rate,
        );
    }

    const parsed = leadSchema.safeParse(payload);
    if (!parsed.success) {
        const message = parsed.error.issues[0]?.message ?? 'تعذر التحقق من البيانات.';
        logWarn('lead_submit_failed', {
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

    const adminClient = createSupabaseServerClient();

    const { error } = await adminClient.from('leads').insert({
        full_name: parsed.data.name,
        email: parsed.data.email.toLowerCase(),
        phone: emptyToNull(parsed.data.phone),
        firm_name: emptyToNull(parsed.data.firm_name),
        topic: emptyToNull(parsed.data.topic),
        message: emptyToNull(parsed.data.message),
        utm: parsed.data.utm ?? null,
        referrer: emptyToNull(parsed.data.referrer),
    });

    if (error) {
        logError('lead_submit_failed', {
            requestId,
            ip: requestIp,
            error: error.message,
        });

        return jsonResponse(
            { message: 'تعذر إرسال طلبك. حاول مرة أخرى.' },
            500,
            requestId,
            rate,
        );
    }

    logInfo('lead_created', {
        requestId,
        ip: requestIp,
        topic: parsed.data.topic ?? null,
    });

    const normalizedTopic = String(parsed.data.topic ?? '').trim().toLowerCase();
    if (normalizedTopic === 'lawyer_survey_v1') {
        const recipients = getSignupAlertEmails();
        if (recipients.length) {
            const submittedAt = new Date().toISOString();
            const adminUrl = `${getPublicSiteUrl()}/admin/surveys/lawyers`;
            const safeMessage = parsed.data.message?.trim() || '—';

            try {
                await sendEmail({
                    to: recipients.join(','),
                    subject: 'رد جديد على استبيان المحامين - مسار المحامي',
                    text: [
                        'تم استلام رد جديد على استبيان المحامين.',
                        `الاسم: ${parsed.data.name}`,
                        `البريد: ${parsed.data.email.toLowerCase()}`,
                        `الجوال: ${emptyToNull(parsed.data.phone) || 'غير مذكور'}`,
                        `المكتب: ${emptyToNull(parsed.data.firm_name) || 'غير مذكور'}`,
                        `وقت الإرسال: ${submittedAt}`,
                        `الرابط المرجعي: ${emptyToNull(parsed.data.referrer) || 'غير مذكور'}`,
                        '',
                        'ملخص الإجابات:',
                        safeMessage,
                        '',
                        `لوحة الإدارة: ${adminUrl}`,
                    ].join('\n'),
                });

                logInfo('lead_survey_admin_notified', {
                    requestId,
                    ip: requestIp,
                    emails: recipients,
                });
            } catch (notifyError) {
                logWarn('lead_survey_admin_notify_failed', {
                    requestId,
                    ip: requestIp,
                    error: notifyError instanceof Error ? notifyError.message : String(notifyError),
                });
            }
        }
    }

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

function emptyToNull(value?: string) {
    const normalized = value?.trim();
    return normalized ? normalized : null;
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
    body: { message: string; success?: boolean },
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

    response.headers.set('x-request-id', requestId);
    response.headers.set('x-ratelimit-limit', String(rate.limit));
    response.headers.set('x-ratelimit-remaining', String(rate.remaining));
    response.headers.set('x-ratelimit-reset', String(Math.floor(rate.resetAt / 1000)));
    return response;
}
