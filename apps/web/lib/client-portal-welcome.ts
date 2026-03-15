import 'server-only';

import { sendEmail } from '@/lib/email';
import {
  CLIENT_PORTAL_WELCOME_EMAIL_HTML,
  CLIENT_PORTAL_WELCOME_EMAIL_SUBJECT,
  CLIENT_PORTAL_WELCOME_EMAIL_TEXT,
} from '@/lib/email-templates';
import { getPublicSiteUrl, isSmtpConfigured } from '@/lib/env';
import { logError } from '@/lib/logger';
export { shouldSendClientPortalWelcomeEmail } from './client-portal-welcome-utils';

export type ClientPortalWelcomeEmailStatus = 'sent' | 'smtp_not_configured' | 'failed';

type SendClientPortalWelcomeEmailParams = {
  clientId: string;
  clientName: string;
  email: string;
};

export async function sendClientPortalWelcomeEmail(
  params: SendClientPortalWelcomeEmailParams,
): Promise<ClientPortalWelcomeEmailStatus> {
  const email = normalizeEmail(params.email);
  if (!email) {
    return 'failed';
  }

  if (!isSmtpConfigured()) {
    return 'smtp_not_configured';
  }

  try {
    const portalUrl = `${getPublicSiteUrl()}/client-portal/signin`;
    await sendEmail({
      to: email,
      subject: CLIENT_PORTAL_WELCOME_EMAIL_SUBJECT,
      text: CLIENT_PORTAL_WELCOME_EMAIL_TEXT({
        clientName: params.clientName,
        portalUrl,
      }),
      html: CLIENT_PORTAL_WELCOME_EMAIL_HTML({
        clientName: params.clientName,
        portalUrl,
      }),
    });
    return 'sent';
  } catch (emailError) {
    logError('client_portal_welcome_email_failed', {
      clientId: params.clientId,
      message: emailError instanceof Error ? emailError.message : String(emailError ?? ''),
    });
    return 'failed';
  }
}

function normalizeEmail(value?: string | null) {
  const normalized = String(value ?? '').trim().toLowerCase();
  return normalized || null;
}
