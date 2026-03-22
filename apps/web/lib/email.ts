import 'server-only';

import nodemailer from 'nodemailer';
import { getSmtpEnv, type SmtpEnv, isSmtpConfigured, getSignupAlertEmails } from '@/lib/env';
import {
  WELCOME_EMAIL_HTML,
  INVOICE_EMAIL_HTML,
  NEW_SIGNUP_ALERT_SUBJECT,
  NEW_SIGNUP_ALERT_HTML,
  CLIENT_QUESTION_EMAIL_SUBJECT,
  CLIENT_QUESTION_EMAIL_HTML,
  LAWYER_REPLY_EMAIL_SUBJECT,
  LAWYER_REPLY_EMAIL_HTML,
} from './email-templates';

export type SendEmailParams = {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  requireConfigured?: boolean;
  attachments?: Array<{
    filename: string;
    content: Buffer;
    contentType?: string;
  }>;
};

let cachedTransport: nodemailer.Transporter | null = null;
let cachedEnvKey = '';

function envCacheKey(env: SmtpEnv) {
  return `${env.host}:${env.port}:${env.user}:${env.from}`;
}

function getTransport() {
  const env = getSmtpEnv();
  const key = envCacheKey(env);

  if (cachedTransport && cachedEnvKey === key) {
    return { transport: cachedTransport, env };
  }

  const transport = nodemailer.createTransport({
    host: env.host,
    port: env.port,
    secure: env.port === 465,
    auth: {
      user: env.user,
      pass: env.pass,
    },
  });

  cachedTransport = transport;
  cachedEnvKey = key;

  return { transport, env };
}

export async function sendEmail(params: SendEmailParams) {
  if (!isSmtpConfigured()) {
    if (params.requireConfigured) {
      throw new Error('smtp_not_configured');
    }
    console.warn('SMTP not configured, skipping email to', params.to);
    return;
  }
  const { transport, env } = getTransport();
  const fromAddress = normalizeFromAddress(env.from);

  await transport.sendMail({
    from: {
      name: 'مسار المحامي',
      address: fromAddress,
    },
    to: params.to,
    subject: params.subject,
    text: params.text,
    html: params.html,
    attachments: params.attachments,
  });
}

export async function sendWelcomeEmail(to: string, name: string) {
  if (!isSmtpConfigured()) return;

  try {
    const { getPublicSiteUrl } = await import('@/lib/env');
    await sendEmail({
      to,
      subject: 'أهلاً بك في مسار المحامي',
      html: WELCOME_EMAIL_HTML(name, `${getPublicSiteUrl()}/app`),
    });
  } catch (e) {
    console.error('Failed to send welcome email', e);
  }
}

export async function sendInvoiceEmail(
  to: string,
  name: string,
  planName: string,
  amount: string,
  pdfBuffer: Buffer,
) {
  if (!isSmtpConfigured()) {
    console.log('Skipping invoice email (SMTP not configured)');
    return;
  }

  try {
    await sendEmail({
      to,
      subject: 'فاتورة الاشتراك - مسار المحامي',
      html: INVOICE_EMAIL_HTML(name, planName, amount),
      attachments: [
        {
          filename: 'invoice.pdf',
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    });
    console.log(`Invoice email sent to ${to}`);
  } catch (error) {
    console.error('Failed to send invoice email:', error);
  }
}

export async function sendNewSignupAlertEmail(params: {
  fullName: string;
  email: string;
  phone?: string | null;
  firmName?: string | null;
  source: 'trial' | 'invite';
}) {
  if (!isSmtpConfigured()) {
    console.log('Skipping signup alert email (SMTP not configured)');
    return;
  }

  const recipients = getSignupAlertEmails();
  if (!recipients.length) {
    return;
  }

  const sourceLabel = params.source === 'trial' ? 'نموذج التجربة' : 'صفحة الدعوة (/signup)';
  const createdAt = new Date().toISOString();

  try {
    await sendEmail({
      to: recipients.join(','),
      subject: NEW_SIGNUP_ALERT_SUBJECT,
      text: [
        'تم تسجيل مستخدم جديد في مسار المحامي.',
        `الاسم: ${params.fullName}`,
        `البريد: ${params.email}`,
        `الجوال: ${params.phone || 'غير مذكور'}`,
        `اسم المكتب: ${params.firmName || 'غير مذكور'}`,
        `المصدر: ${sourceLabel}`,
        `وقت التسجيل: ${createdAt}`,
      ].join('\n'),
      html: NEW_SIGNUP_ALERT_HTML({
        fullName: escapeHtml(params.fullName),
        email: escapeHtml(params.email),
        phone: params.phone ? escapeHtml(params.phone) : null,
        firmName: params.firmName ? escapeHtml(params.firmName) : null,
        source: escapeHtml(sourceLabel),
        createdAt: escapeHtml(createdAt),
      }),
    });
  } catch (error) {
    console.error('Failed to send signup alert email:', error);
  }
}

export async function sendClientQuestionEmail(params: {
  to: string;
  clientName: string;
  matterTitle: string;
  question: string;
  platformUrl: string;
}) {
  if (!isSmtpConfigured()) return;
  
  try {
    await sendEmail({
      to: params.to,
      subject: CLIENT_QUESTION_EMAIL_SUBJECT,
      html: CLIENT_QUESTION_EMAIL_HTML(params),
    });
  } catch (error) {
    console.error('Failed to send client question email:', error);
  }
}

export async function sendLawyerReplyEmail(params: {
  to: string;
  matterTitle: string;
  reply: string;
  portalUrl: string;
}) {
  if (!isSmtpConfigured()) return;
  
  try {
    await sendEmail({
      to: params.to,
      subject: LAWYER_REPLY_EMAIL_SUBJECT,
      html: LAWYER_REPLY_EMAIL_HTML(params),
    });
  } catch (error) {
    console.error('Failed to send lawyer reply email:', error);
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

function normalizeFromAddress(rawFrom: string) {
  const trimmed = rawFrom.trim();
  const bracketMatch = trimmed.match(/<([^>]+)>/);
  const extracted = (bracketMatch?.[1] ?? trimmed).trim();
  return extracted.replaceAll('<', '').replaceAll('>', '').replaceAll('"', '');
}
