import 'server-only';

import { isSmtpConfigured } from '@/lib/env';
import { sendEmail } from '@/lib/email';
import { logError, logInfo, logWarn } from '@/lib/logger';

export type ClientPortalOtpChannel = 'sms' | 'whatsapp' | 'email';
type ClientPortalOtpDeliveryMode =
  | 'sms_with_whatsapp_fallback'
  | 'sms_only'
  | 'whatsapp_only'
  | 'whatsapp_with_email_fallback'
  | 'email_only';

export type ClientPortalOtpDeliveryResult =
  | {
      ok: true;
      channel: ClientPortalOtpChannel;
      provider: string;
      providerMessageId: string | null;
      fallbackUsed: boolean;
    }
  | {
      ok: false;
      channel: ClientPortalOtpChannel;
      provider: string;
      errorMessage: string;
      fallbackTried: boolean;
    };

type SendChannelResult =
  | { ok: true; provider: string; providerMessageId: string | null }
  | { ok: false; provider: string; errorMessage: string };

const DEFAULT_SMS_TEMPLATE = 'رمز الدخول إلى بوابة العميل: {{CODE}}. صالح لمدة {{TTL_MIN}} دقائق.';
const DEFAULT_WHATSAPP_TEMPLATE = 'رمز الدخول إلى بوابة العميل: {{CODE}}. صالح لمدة {{TTL_MIN}} دقائق.';
const DEFAULT_EMAIL_SUBJECT = 'رمز الدخول إلى بوابة العميل';
const DEFAULT_EMAIL_TEMPLATE = 'رمز الدخول إلى بوابة العميل: {{CODE}}. صالح لمدة {{TTL_MIN}} دقائق.';

function renderTemplate(template: string, params: { code: string; ttlMinutes: number }) {
  return template
    .replaceAll('{{CODE}}', params.code)
    .replaceAll('{{TTL_MIN}}', String(params.ttlMinutes));
}

function getDeliveryMode(): ClientPortalOtpDeliveryMode {
  const raw = String(process.env.CLIENT_PORTAL_OTP_DELIVERY_MODE ?? 'sms_with_whatsapp_fallback')
    .trim()
    .toLowerCase();

  if (raw === 'sms_only') return 'sms_only';
  if (raw === 'whatsapp_only') return 'whatsapp_only';
  if (raw === 'whatsapp_with_email_fallback') return 'whatsapp_with_email_fallback';
  if (raw === 'email_only') return 'email_only';
  return 'sms_with_whatsapp_fallback';
}

function shouldUseMockProvider(channel: ClientPortalOtpChannel) {
  if (channel === 'email') {
    const provider = String(process.env.CLIENT_PORTAL_EMAIL_PROVIDER ?? 'mock').trim().toLowerCase();
    return provider !== 'smtp';
  }

  const envKey = channel === 'sms' ? 'CLIENT_PORTAL_SMS_PROVIDER' : 'CLIENT_PORTAL_WHATSAPP_PROVIDER';
  const provider = String(process.env[envKey] ?? 'mock').trim().toLowerCase();
  return provider !== 'twilio';
}

function isWhatsAppFallbackEnabled() {
  const raw = String(process.env.CLIENT_PORTAL_WHATSAPP_FALLBACK_ENABLED ?? '1').trim();
  return raw !== '0' && raw.toLowerCase() !== 'false';
}

function isEmailFallbackEnabled() {
  const raw = String(process.env.CLIENT_PORTAL_EMAIL_FALLBACK_ENABLED ?? '1').trim();
  return raw !== '0' && raw.toLowerCase() !== 'false';
}

function shouldForceMockFailure(channel: ClientPortalOtpChannel) {
  const envKey =
    channel === 'sms'
      ? 'CLIENT_PORTAL_MOCK_FAIL_SMS'
      : channel === 'whatsapp'
      ? 'CLIENT_PORTAL_MOCK_FAIL_WHATSAPP'
      : 'CLIENT_PORTAL_MOCK_FAIL_EMAIL';
  const raw = String(process.env[envKey] ?? '').trim().toLowerCase();
  return raw === '1' || raw === 'true';
}

async function sendViaMock(params: {
  channel: ClientPortalOtpChannel;
  phoneE164: string;
  email: string | null;
}) : Promise<SendChannelResult> {
  if (shouldForceMockFailure(params.channel)) {
    return {
      ok: false,
      provider: 'mock',
      errorMessage: `mock_${params.channel}_failed`,
    };
  }

  logInfo('client_portal_otp_mock_sent', {
    channel: params.channel,
    phone: params.phoneE164,
    email: params.email,
  });

  return {
    ok: true,
    provider: 'mock',
    providerMessageId: `mock-${params.channel}-${Date.now()}`,
  };
}

async function sendViaTwilio(params: {
  channel: 'sms' | 'whatsapp';
  phoneE164: string;
  code: string;
  ttlSeconds: number;
}) : Promise<SendChannelResult> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim() || process.env.SUPABASE_AUTH_SMS_TWILIO_AUTH_TOKEN?.trim();

  if (!accountSid || !authToken) {
    return {
      ok: false,
      provider: 'twilio',
      errorMessage: 'twilio_credentials_missing',
    };
  }

  const smsFrom = process.env.TWILIO_SMS_FROM?.trim();
  const whatsappFrom = process.env.TWILIO_WHATSAPP_FROM?.trim();
  const from = params.channel === 'sms' ? smsFrom : whatsappFrom;

  if (!from) {
    return {
      ok: false,
      provider: 'twilio',
      errorMessage: params.channel === 'sms' ? 'twilio_sms_from_missing' : 'twilio_whatsapp_from_missing',
    };
  }

  const smsTemplate = process.env.CLIENT_PORTAL_OTP_SMS_TEMPLATE?.trim() || DEFAULT_SMS_TEMPLATE;
  const whatsappTemplate = process.env.CLIENT_PORTAL_OTP_WHATSAPP_TEMPLATE?.trim() || DEFAULT_WHATSAPP_TEMPLATE;
  const body = renderTemplate(params.channel === 'sms' ? smsTemplate : whatsappTemplate, {
    code: params.code,
    ttlMinutes: Math.max(1, Math.ceil(params.ttlSeconds / 60)),
  });

  const to =
    params.channel === 'sms'
      ? params.phoneE164
      : params.phoneE164.startsWith('whatsapp:')
      ? params.phoneE164
      : `whatsapp:${params.phoneE164}`;

  const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`;
  const authHeader = `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`;

  const payload = new URLSearchParams();
  payload.set('To', to);
  payload.set('From', from);
  payload.set('Body', body);

  try {
    const response = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: payload.toString(),
      cache: 'no-store',
    });

    const responseBody = await response.json().catch(() => ({} as Record<string, unknown>));
    if (!response.ok) {
      const message = String(responseBody?.message || response.statusText || 'twilio_send_failed');
      return {
        ok: false,
        provider: 'twilio',
        errorMessage: message,
      };
    }

    return {
      ok: true,
      provider: 'twilio',
      providerMessageId: String(responseBody?.sid || ''),
    };
  } catch (error) {
    return {
      ok: false,
      provider: 'twilio',
      errorMessage: error instanceof Error ? error.message : 'twilio_network_error',
    };
  }
}

async function sendViaEmail(params: {
  email: string | null;
  code: string;
  ttlSeconds: number;
}) : Promise<SendChannelResult> {
  const to = String(params.email ?? '').trim().toLowerCase();
  if (!to) {
    return {
      ok: false,
      provider: 'smtp',
      errorMessage: 'client_email_missing',
    };
  }

  if (!isSmtpConfigured()) {
    return {
      ok: false,
      provider: 'smtp',
      errorMessage: 'smtp_not_configured',
    };
  }

  const subject = process.env.CLIENT_PORTAL_OTP_EMAIL_SUBJECT?.trim() || DEFAULT_EMAIL_SUBJECT;
  const textBody = renderTemplate(
    process.env.CLIENT_PORTAL_OTP_EMAIL_TEMPLATE?.trim() || DEFAULT_EMAIL_TEMPLATE,
    {
      code: params.code,
      ttlMinutes: Math.max(1, Math.ceil(params.ttlSeconds / 60)),
    },
  );

  try {
    await sendEmail({
      to,
      subject,
      text: textBody,
      html: `<p>${escapeHtml(textBody)}</p>`,
    });

    return {
      ok: true,
      provider: 'smtp',
      providerMessageId: null,
    };
  } catch (error) {
    return {
      ok: false,
      provider: 'smtp',
      errorMessage: error instanceof Error ? error.message : 'email_send_failed',
    };
  }
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

async function sendOtpViaChannel(params: {
  channel: ClientPortalOtpChannel;
  phoneE164: string;
  email: string | null;
  code: string;
  ttlSeconds: number;
}) : Promise<SendChannelResult> {
  if (shouldUseMockProvider(params.channel)) {
    return sendViaMock({
      channel: params.channel,
      phoneE164: params.phoneE164,
      email: params.email,
    });
  }

  if (params.channel === 'email') {
    return sendViaEmail({
      email: params.email,
      code: params.code,
      ttlSeconds: params.ttlSeconds,
    });
  }

  return sendViaTwilio({
    channel: params.channel,
    phoneE164: params.phoneE164,
    code: params.code,
    ttlSeconds: params.ttlSeconds,
  });
}

export async function deliverClientPortalOtp(params: {
  phoneE164: string;
  email?: string | null;
  code: string;
  ttlSeconds: number;
}) : Promise<ClientPortalOtpDeliveryResult> {
  const deliveryMode = getDeliveryMode();
  const clientEmail = String(params.email ?? '').trim().toLowerCase() || null;

  if (deliveryMode === 'email_only') {
    const email = await sendOtpViaChannel({
      channel: 'email',
      phoneE164: params.phoneE164,
      email: clientEmail,
      code: params.code,
      ttlSeconds: params.ttlSeconds,
    });

    if (email.ok) {
      return {
        ok: true,
        channel: 'email',
        provider: email.provider,
        providerMessageId: email.providerMessageId,
        fallbackUsed: false,
      };
    }

    return {
      ok: false,
      channel: 'email',
      provider: email.provider,
      errorMessage: email.errorMessage,
      fallbackTried: false,
    };
  }

  if (deliveryMode === 'whatsapp_only') {
    const whatsapp = await sendOtpViaChannel({
      channel: 'whatsapp',
      phoneE164: params.phoneE164,
      email: clientEmail,
      code: params.code,
      ttlSeconds: params.ttlSeconds,
    });

    if (whatsapp.ok) {
      return {
        ok: true,
        channel: 'whatsapp',
        provider: whatsapp.provider,
        providerMessageId: whatsapp.providerMessageId,
        fallbackUsed: false,
      };
    }

    logError('client_portal_otp_whatsapp_delivery_failed', {
      phone: params.phoneE164,
      provider: whatsapp.provider,
      reason: whatsapp.errorMessage,
    });

    return {
      ok: false,
      channel: 'whatsapp',
      provider: whatsapp.provider,
      errorMessage: whatsapp.errorMessage,
      fallbackTried: false,
    };
  }

  if (deliveryMode === 'whatsapp_with_email_fallback') {
    const whatsapp = await sendOtpViaChannel({
      channel: 'whatsapp',
      phoneE164: params.phoneE164,
      email: clientEmail,
      code: params.code,
      ttlSeconds: params.ttlSeconds,
    });

    if (whatsapp.ok) {
      return {
        ok: true,
        channel: 'whatsapp',
        provider: whatsapp.provider,
        providerMessageId: whatsapp.providerMessageId,
        fallbackUsed: false,
      };
    }

    logWarn('client_portal_otp_whatsapp_failed', {
      phone: params.phoneE164,
      provider: whatsapp.provider,
      reason: whatsapp.errorMessage,
    });

    if (!isEmailFallbackEnabled()) {
      return {
        ok: false,
        channel: 'whatsapp',
        provider: whatsapp.provider,
        errorMessage: whatsapp.errorMessage,
        fallbackTried: false,
      };
    }

    const email = await sendOtpViaChannel({
      channel: 'email',
      phoneE164: params.phoneE164,
      email: clientEmail,
      code: params.code,
      ttlSeconds: params.ttlSeconds,
    });

    if (email.ok) {
      logInfo('client_portal_otp_email_fallback_sent', {
        phone: params.phoneE164,
        email: clientEmail,
        provider: email.provider,
      });
      return {
        ok: true,
        channel: 'email',
        provider: email.provider,
        providerMessageId: email.providerMessageId,
        fallbackUsed: true,
      };
    }

    logError('client_portal_otp_whatsapp_email_delivery_failed', {
      phone: params.phoneE164,
      email: clientEmail,
      whatsapp_provider: whatsapp.provider,
      whatsapp_error: whatsapp.errorMessage,
      email_provider: email.provider,
      email_error: email.errorMessage,
    });

    return {
      ok: false,
      channel: 'email',
      provider: email.provider,
      errorMessage: email.errorMessage,
      fallbackTried: true,
    };
  }

  const sms = await sendOtpViaChannel({
    channel: 'sms',
    phoneE164: params.phoneE164,
    email: clientEmail,
    code: params.code,
    ttlSeconds: params.ttlSeconds,
  });

  if (sms.ok) {
    return {
      ok: true,
      channel: 'sms',
      provider: sms.provider,
      providerMessageId: sms.providerMessageId,
      fallbackUsed: false,
    };
  }

  logWarn('client_portal_otp_sms_failed', {
    phone: params.phoneE164,
    provider: sms.provider,
    reason: sms.errorMessage,
  });

  if (deliveryMode === 'sms_only' || !isWhatsAppFallbackEnabled()) {
    return {
      ok: false,
      channel: 'sms',
      provider: sms.provider,
      errorMessage: sms.errorMessage,
      fallbackTried: false,
    };
  }

  const whatsapp = await sendOtpViaChannel({
    channel: 'whatsapp',
    phoneE164: params.phoneE164,
    email: clientEmail,
    code: params.code,
    ttlSeconds: params.ttlSeconds,
  });

  if (whatsapp.ok) {
    logInfo('client_portal_otp_whatsapp_fallback_sent', {
      phone: params.phoneE164,
      provider: whatsapp.provider,
    });
    return {
      ok: true,
      channel: 'whatsapp',
      provider: whatsapp.provider,
      providerMessageId: whatsapp.providerMessageId,
      fallbackUsed: true,
    };
  }

  logError('client_portal_otp_delivery_failed', {
    phone: params.phoneE164,
    sms_provider: sms.provider,
    sms_error: sms.errorMessage,
    whatsapp_provider: whatsapp.provider,
    whatsapp_error: whatsapp.errorMessage,
  });

  return {
    ok: false,
    channel: 'whatsapp',
    provider: whatsapp.provider,
    errorMessage: whatsapp.errorMessage,
    fallbackTried: true,
  };
}
