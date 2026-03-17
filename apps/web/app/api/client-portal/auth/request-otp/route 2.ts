import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { checkRateLimit, getRequestIp, RATE_LIMIT_MESSAGE_AR } from '@/lib/rateLimit';
import { normalizeClientPortalPhoneInput } from '@/lib/client-portal/phone';
import {
  generateClientPortalOtpCode,
  getClientPortalOtpMaxAttempts,
  getClientPortalOtpResendCooldownSeconds,
  getClientPortalOtpTtlSeconds,
  hashClientPortalOtpCode,
} from '@/lib/client-portal/otp';
import { deliverClientPortalOtp } from '@/lib/client-portal/delivery';

export const runtime = 'nodejs';

const bodySchema = z.object({
  phone_country: z.string().trim().max(8, 'رمز الدولة غير صالح.').optional(),
  phone_national: z.string().trim().max(32, 'رقم الجوال غير صالح.').optional(),
  phone: z.string().trim().max(40, 'رقم الجوال غير صالح.').optional(),
});

const GENERIC_RESPONSE_MESSAGE = 'إذا كان رقم الجوال مرتبطًا ببوابة العميل، سيتم إرسال رمز التحقق خلال لحظات.';

export async function POST(request: NextRequest) {
  const ip = getRequestIp(request);

  let payload: unknown = {};
  try {
    payload = await request.json();
  } catch {
    payload = {};
  }

  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'تعذر التحقق من البيانات.' },
      { status: 400 },
    );
  }

  const normalizedPhone = normalizeClientPortalPhoneInput({
    countryCode: parsed.data.phone_country,
    phoneNational: parsed.data.phone_national,
    rawPhone: parsed.data.phone,
    fieldLabel: 'رقم الجوال',
  });
  if (!normalizedPhone.ok) {
    return NextResponse.json({ error: normalizedPhone.message }, { status: 400 });
  }

  const rate = await checkRateLimit({
    key: `client_portal:request_otp:${ip}:${normalizedPhone.e164}`,
    limit: 5,
    windowMs: 10 * 60 * 1000,
  });
  if (!rate.allowed) {
    return NextResponse.json({ error: RATE_LIMIT_MESSAGE_AR }, { status: 429 });
  }

  const db = createSupabaseServerClient();
  const { data: portalUser, error: userError } = await db
    .from('client_portal_users')
    .select('id, org_id, client_id, status')
    .eq('phone_e164', normalizedPhone.e164)
    .maybeSingle();

  if (userError) {
    return NextResponse.json({ error: 'تعذر معالجة الطلب حالياً. حاول مرة أخرى.' }, { status: 500 });
  }

  if (!portalUser || String((portalUser as any).status || '') !== 'active') {
    return NextResponse.json({ ok: true, message: GENERIC_RESPONSE_MESSAGE }, { status: 200 });
  }

  let clientEmail: string | null = null;
  const clientId = String((portalUser as any).client_id || '');
  if (clientId) {
    const { data: clientRow } = await db
      .from('clients')
      .select('email')
      .eq('id', clientId)
      .maybeSingle();
    clientEmail = String((clientRow as any)?.email || '').trim().toLowerCase() || null;
  }

  const resendCooldownSeconds = getClientPortalOtpResendCooldownSeconds();
  const { data: latestOtp } = await db
    .from('client_portal_otp_codes')
    .select('created_at')
    .eq('client_portal_user_id', String((portalUser as any).id))
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestOtp?.created_at) {
    const elapsedSeconds = Math.floor(
      (Date.now() - new Date(String(latestOtp.created_at)).getTime()) / 1000,
    );
    if (Number.isFinite(elapsedSeconds) && elapsedSeconds >= 0 && elapsedSeconds < resendCooldownSeconds) {
      const waitSeconds = resendCooldownSeconds - elapsedSeconds;
      return NextResponse.json(
        { error: `يرجى الانتظار ${waitSeconds} ثانية قبل إعادة إرسال الرمز.` },
        { status: 429 },
      );
    }
  }

  const code = generateClientPortalOtpCode();
  const ttlSeconds = getClientPortalOtpTtlSeconds();
  const maxAttempts = getClientPortalOtpMaxAttempts();
  const nowIso = new Date().toISOString();
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

  await db
    .from('client_portal_otp_codes')
    .update({ consumed_at: nowIso })
    .eq('client_portal_user_id', String((portalUser as any).id))
    .is('consumed_at', null);

  const delivery = await deliverClientPortalOtp({
    phoneE164: normalizedPhone.e164,
    email: clientEmail,
    code,
    ttlSeconds,
  });

  const { error: insertError } = await db.from('client_portal_otp_codes').insert({
    client_portal_user_id: String((portalUser as any).id),
    code_hash: hashClientPortalOtpCode(code),
    channel: delivery.channel,
    delivery_provider: delivery.provider,
    provider_message_id: delivery.ok ? delivery.providerMessageId : null,
    delivery_status: delivery.ok ? 'sent' : 'failed',
    failure_reason: delivery.ok ? null : delivery.errorMessage,
    request_ip: ip,
    user_agent: request.headers.get('user-agent') || null,
    attempts: 0,
    max_attempts: maxAttempts,
    expires_at: expiresAt,
  });

  if (insertError) {
    return NextResponse.json({ error: 'تعذر إصدار رمز التحقق. حاول مرة أخرى.' }, { status: 500 });
  }

  if (!delivery.ok) {
    return NextResponse.json(
      { error: 'تعذر إرسال رمز التحقق حالياً عبر الرسائل. حاول بعد قليل.' },
      { status: 502 },
    );
  }

  await db.from('audit_logs').insert({
    org_id: String((portalUser as any).org_id),
    user_id: null,
    action: 'client_portal_otp_requested',
    entity_type: 'client',
    entity_id: String((portalUser as any).client_id),
    meta: {
      channel: delivery.channel,
      fallback_used: delivery.fallbackUsed,
      phone: normalizedPhone.e164,
    },
    ip,
    user_agent: request.headers.get('user-agent') || null,
  });

  const message = delivery.channel === 'sms'
    ? 'تم إرسال رمز التحقق عبر رسالة نصية.'
    : delivery.channel === 'whatsapp'
    ? delivery.fallbackUsed
      ? 'تعذر الإرسال عبر SMS وتم إرسال رمز التحقق عبر واتساب.'
      : 'تم إرسال رمز التحقق عبر واتساب.'
    : delivery.fallbackUsed
    ? 'تعذر الإرسال عبر واتساب وتم إرسال رمز التحقق عبر البريد الإلكتروني.'
    : 'تم إرسال رمز التحقق عبر البريد الإلكتروني.';

  return NextResponse.json({
    ok: true,
    message,
    channel: delivery.channel,
    fallback_used: delivery.fallbackUsed,
    ttl_seconds: ttlSeconds,
  }, { status: 200 });
}
