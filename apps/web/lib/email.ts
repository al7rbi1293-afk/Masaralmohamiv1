import 'server-only';

import nodemailer from 'nodemailer';
import { getSmtpEnv, type SmtpEnv, isSmtpConfigured } from '@/lib/env';
import { WELCOME_EMAIL_HTML, INVOICE_EMAIL_HTML } from './email-templates';

export type SendEmailParams = {
  to: string;
  subject: string;
  text?: string;
  html?: string;
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
    console.warn('SMTP not configured, skipping email to', params.to);
    return;
  }
  const { transport, env } = getTransport();

  await transport.sendMail({
    from: `"مسار المحامي" <${env.from}>`,
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
