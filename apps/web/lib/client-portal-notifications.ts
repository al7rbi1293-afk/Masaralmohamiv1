import 'server-only';

import { sendEmail } from '@/lib/email';
import {
  CLIENT_PORTAL_MATTER_EVENT_EMAIL_HTML,
  CLIENT_PORTAL_MATTER_EVENT_EMAIL_SUBJECT,
  CLIENT_PORTAL_MATTER_EVENT_EMAIL_TEXT,
} from '@/lib/email-templates';
import { getPublicSiteUrl, isSmtpConfigured } from '@/lib/env';
import { logError } from '@/lib/logger';

export type ClientPortalMatterEventEmailStatus =
  | 'sent'
  | 'smtp_not_configured'
  | 'skipped_no_email'
  | 'failed';

type SendClientPortalMatterEventEmailParams = {
  clientId: string;
  clientName: string;
  email: string | null;
  matterTitle: string;
  eventType: string;
  eventDate: string | null;
  note: string | null;
};

export async function sendClientPortalMatterEventEmail(
  params: SendClientPortalMatterEventEmailParams,
): Promise<ClientPortalMatterEventEmailStatus> {
  const normalizedEmail = normalizeEmail(params.email);
  if (!normalizedEmail) {
    return 'skipped_no_email';
  }

  if (!isSmtpConfigured()) {
    return 'smtp_not_configured';
  }

  const portalUrl = `${getPublicSiteUrl()}/client-portal`;
  const eventDateLabel = formatDateTime(params.eventDate);

  try {
    await sendEmail({
      to: normalizedEmail,
      subject: CLIENT_PORTAL_MATTER_EVENT_EMAIL_SUBJECT,
      text: CLIENT_PORTAL_MATTER_EVENT_EMAIL_TEXT({
        clientName: params.clientName,
        matterTitle: params.matterTitle,
        eventType: params.eventType,
        eventDateLabel,
        note: params.note,
        portalUrl,
      }),
      html: CLIENT_PORTAL_MATTER_EVENT_EMAIL_HTML({
        clientName: params.clientName,
        matterTitle: params.matterTitle,
        eventType: params.eventType,
        eventDateLabel,
        note: params.note,
        portalUrl,
      }),
    });
    return 'sent';
  } catch (error) {
    logError('client_portal_matter_event_email_failed', {
      clientId: params.clientId,
      message: error instanceof Error ? error.message : String(error ?? ''),
    });
    return 'failed';
  }
}

function normalizeEmail(value?: string | null) {
  const normalized = String(value ?? '').trim().toLowerCase();
  return normalized || null;
}

function formatDateTime(rawDate: string | null | undefined) {
  if (!rawDate) return null;
  const date = new Date(rawDate);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString('ar-SA', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}
