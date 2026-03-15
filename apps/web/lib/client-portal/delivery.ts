import 'server-only';

import { isSmtpConfigured } from '@/lib/env';
import { sendEmail } from '@/lib/email';

export type ClientPortalOtpChannel = 'email';

export type ClientPortalOtpDeliveryResult =
  | {
      ok: true;
      channel: 'email';
      provider: 'smtp' | 'mock';
      providerMessageId: string | null;
      fallbackUsed: false;
    }
  | {
      ok: false;
      channel: 'email';
      provider: 'smtp' | 'mock';
      errorMessage: string;
      fallbackTried: false;
    };

const DEFAULT_EMAIL_SUBJECT = 'رمز الدخول إلى بوابة العميل';
const DEFAULT_EMAIL_TEMPLATE = 'رمز الدخول إلى بوابة العميل: {{CODE}}. صالح لمدة {{TTL_MIN}} دقائق.';

function renderTemplate(template: string, params: { code: string; ttlMinutes: number }) {
  return template
    .replaceAll('{{CODE}}', params.code)
    .replaceAll('{{TTL_MIN}}', String(params.ttlMinutes));
}

function shouldUseMockProvider() {
  const provider = String(process.env.CLIENT_PORTAL_EMAIL_PROVIDER ?? 'smtp').trim().toLowerCase();
  return provider !== 'smtp';
}

function shouldForceMockFailure() {
  const raw = String(process.env.CLIENT_PORTAL_MOCK_FAIL_EMAIL ?? '').trim().toLowerCase();
  return raw === '1' || raw === 'true';
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

async function sendViaMock(params: { email: string | null }) : Promise<ClientPortalOtpDeliveryResult> {
  if (shouldForceMockFailure()) {
    return {
      ok: false,
      channel: 'email',
      provider: 'mock',
      errorMessage: 'mock_email_failed',
      fallbackTried: false,
    };
  }

  if (!params.email) {
    return {
      ok: false,
      channel: 'email',
      provider: 'mock',
      errorMessage: 'client_email_missing',
      fallbackTried: false,
    };
  }

  return {
    ok: true,
    channel: 'email',
    provider: 'mock',
    providerMessageId: `mock-email-${Date.now()}`,
    fallbackUsed: false,
  };
}

async function sendViaEmail(params: {
  email: string | null;
  code: string;
  ttlSeconds: number;
}) : Promise<ClientPortalOtpDeliveryResult> {
  const to = String(params.email ?? '').trim().toLowerCase();
  if (!to) {
    return {
      ok: false,
      channel: 'email',
      provider: 'smtp',
      errorMessage: 'client_email_missing',
      fallbackTried: false,
    };
  }

  if (!isSmtpConfigured()) {
    return {
      ok: false,
      channel: 'email',
      provider: 'smtp',
      errorMessage: 'smtp_not_configured',
      fallbackTried: false,
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
      channel: 'email',
      provider: 'smtp',
      providerMessageId: null,
      fallbackUsed: false,
    };
  } catch (error) {
    return {
      ok: false,
      channel: 'email',
      provider: 'smtp',
      errorMessage: error instanceof Error ? error.message : 'email_send_failed',
      fallbackTried: false,
    };
  }
}

export async function deliverClientPortalOtp(params: {
  email?: string | null;
  code: string;
  ttlSeconds: number;
}) : Promise<ClientPortalOtpDeliveryResult> {
  const clientEmail = String(params.email ?? '').trim().toLowerCase() || null;

  if (shouldUseMockProvider()) {
    return sendViaMock({ email: clientEmail });
  }

  return sendViaEmail({
    email: clientEmail,
    code: params.code,
    ttlSeconds: params.ttlSeconds,
  });
}
