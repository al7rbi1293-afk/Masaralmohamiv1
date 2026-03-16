import 'server-only';

import { logError, logInfo, logWarn } from '@/lib/logger';

export type ClientPortalOtpChannel = 'sms' | 'whatsapp';

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

function renderTemplate(template: string, params: { code: string; ttlMinutes: number }) {
  return template
    .replaceAll('{{CODE}}', params.code)
    .replaceAll('{{TTL_MIN}}', String(params.ttlMinutes));
}

function shouldUseMockProvider(channel: ClientPortalOtpChannel) {
  const envKey = channel === 'sms' ? 'CLIENT_PORTAL_SMS_PROVIDER' : 'CLIENT_PORTAL_WHATSAPP_PROVIDER';
  const provider = String(process.env[envKey] ?? 'mock').trim().toLowerCase();
  return provider !== 'twilio';
}

function isWhatsAppFallbackEnabled() {
  const raw = String(process.env.CLIENT_PORTAL_WHATSAPP_FALLBACK_ENABLED ?? '1').trim();
  return raw !== '0' && raw.toLowerCase() !== 'false';
}

function shouldForceMockFailure(channel: ClientPortalOtpChannel) {
  const envKey = channel === 'sms' ? 'CLIENT_PORTAL_MOCK_FAIL_SMS' : 'CLIENT_PORTAL_MOCK_FAIL_WHATSAPP';
  const raw = String(process.env[envKey] ?? '').trim().toLowerCase();
  return raw === '1' || raw === 'true';
}

async function sendViaMock(params: {
  channel: ClientPortalOtpChannel;
  phoneE164: string;
  code: string;
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
  });

  return {
    ok: true,
    provider: 'mock',
    providerMessageId: `mock-${params.channel}-${Date.now()}`,
  };
}

async function sendViaTwilio(params: {
  channel: ClientPortalOtpChannel;
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

  const to = params.channel === 'sms'
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

async function sendOtpViaChannel(params: {
  channel: ClientPortalOtpChannel;
  phoneE164: string;
  code: string;
  ttlSeconds: number;
}) : Promise<SendChannelResult> {
  if (shouldUseMockProvider(params.channel)) {
    return sendViaMock({
      channel: params.channel,
      phoneE164: params.phoneE164,
      code: params.code,
    });
  }

  return sendViaTwilio(params);
}

export async function deliverClientPortalOtp(params: {
  phoneE164: string;
  code: string;
  ttlSeconds: number;
}) : Promise<ClientPortalOtpDeliveryResult> {
  const sms = await sendOtpViaChannel({
    channel: 'sms',
    phoneE164: params.phoneE164,
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

  if (!isWhatsAppFallbackEnabled()) {
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

