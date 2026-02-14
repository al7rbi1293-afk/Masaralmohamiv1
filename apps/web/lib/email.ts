import 'server-only';

import nodemailer from 'nodemailer';
import { getSmtpEnv, type SmtpEnv } from '@/lib/env';

export type SendEmailParams = {
  to: string;
  subject: string;
  text: string;
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
  // Do not include the password in the key. We only want to rebuild the transport if
  // host/port/user/from changes.
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
  const { transport, env } = getTransport();

  await transport.sendMail({
    from: env.from,
    to: params.to,
    subject: params.subject,
    text: params.text,
    html: params.html,
    attachments: params.attachments?.map((att) => ({
      filename: att.filename,
      content: att.content,
      contentType: att.contentType,
    })),
  });
}

