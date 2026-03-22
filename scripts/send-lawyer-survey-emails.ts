import { config as loadEnv } from 'dotenv';
import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';

loadEnv({ path: 'apps/web/.env.local' });

type RecipientRow = {
  email: string;
  full_name: string | null;
};

const SURVEY_URL = 'https://masaralmohami.com/survey/lawyers';
const SUBJECT = 'شاركنا رأيك في تطوير مسار المحامي';
const FROM_ADDRESS = 'info@Masaralmohami.com';
const FROM_NAME = 'مسار المحامي';

async function main() {
  const env = getRequiredEnv();
  const supabase = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data, error } = await supabase
    .from('app_users')
    .select('email, full_name')
    .eq('status', 'active')
    .eq('email_verified', true)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to load recipients: ${error.message}`);
  }

  const recipients = dedupeRecipients((data as RecipientRow[] | null) ?? []);
  if (!recipients.length) {
    console.log('No active verified users found. Nothing to send.');
    return;
  }

  const transport = nodemailer.createTransport({
    host: env.smtpHost,
    port: Number(env.smtpPort),
    secure: Number(env.smtpPort) === 465,
    auth: {
      user: env.smtpUser,
      pass: env.smtpPass,
    },
  });

  const failures: Array<{ email: string; error: string }> = [];
  let successCount = 0;

  console.log(`Starting bulk send to ${recipients.length} active verified users...`);

  for (const recipient of recipients) {
    const html = buildHtml(recipient.full_name ?? '');    
    const text = buildText();

    try {
      await transport.sendMail({
        from: {
          name: FROM_NAME,
          address: FROM_ADDRESS,
        },
        envelope: {
          from: env.smtpUser,
          to: recipient.email,
        },
        to: recipient.email,
        replyTo: FROM_ADDRESS,
        subject: SUBJECT,
        text,
        html,
      });

      successCount += 1;
      console.log(`Sent ${successCount}/${recipients.length} -> ${recipient.email}`);
      await sleep(250);
    } catch (sendError) {
      const message = sendError instanceof Error ? sendError.message : String(sendError ?? 'unknown_error');
      failures.push({ email: recipient.email, error: message });
      console.error(`Failed -> ${recipient.email}: ${message}`);
      await sleep(250);
    }
  }

  console.log(
    JSON.stringify(
      {
        totalRecipients: recipients.length,
        successCount,
        failureCount: failures.length,
        failures,
      },
      null,
      2,
    ),
  );

  if (failures.length > 0) {
    process.exitCode = 1;
  }
}

function buildText() {
  return [
    'مرحبًا،',
    '',
    'نعمل حاليًا على تطوير مسار المحامي بشكل يتوافق أكثر مع احتياج المحامين والمكاتب القانونية.',
    'يسعدنا تخصيص 3 دقائق من وقتك للإجابة على استبيان قصير يساعدنا في تحسين تجربة القضايا، المستندات، المهام، الفوترة، وبوابة العميل.',
    `رابط الاستبيان: ${SURVEY_URL}`,
    'شكرًا مقدمًا لمساهمتك.',
  ].join('\n');
}

function buildHtml(fullName: string) {
  const greeting = fullName.trim() ? `مرحبًا ${escapeHtml(fullName)}،` : 'مرحبًا،';
  return `
    <div dir="rtl" style="font-family: Arial, sans-serif; background: #f8fafc; padding: 24px; color: #0f172a;">
      <div style="max-width: 640px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 32px;">
        <h1 style="margin: 0 0 20px; font-size: 24px; color: #0f172a;">${escapeHtml(SUBJECT)}</h1>
        <p style="margin: 0 0 16px; line-height: 1.9;">${greeting}</p>
        <p style="margin: 0 0 16px; line-height: 1.9;">
          نعمل حاليًا على تطوير مسار المحامي بشكل يتوافق أكثر مع احتياج المحامين والمكاتب القانونية.
        </p>
        <p style="margin: 0 0 24px; line-height: 1.9;">
          يسعدنا تخصيص 3 دقائق من وقتك للإجابة على استبيان قصير يساعدنا في تحسين تجربة القضايا،
          المستندات، المهام، الفوترة، وبوابة العميل.
        </p>
        <p style="margin: 0 0 24px;">
          <a
            href="${SURVEY_URL}"
            style="display: inline-block; background: #10b981; color: #ffffff; text-decoration: none; padding: 12px 18px; border-radius: 10px; font-weight: 700;"
          >
            فتح الاستبيان
          </a>
        </p>
        <p style="margin: 0 0 8px; line-height: 1.9;">رابط الاستبيان: <a href="${SURVEY_URL}">${SURVEY_URL}</a></p>
        <p style="margin: 0; line-height: 1.9;">شكرًا مقدمًا لمساهمتك.</p>
      </div>
    </div>
  `;
}

function dedupeRecipients(rows: RecipientRow[]) {
  const deduped = new Map<string, RecipientRow>();
  for (const row of rows) {
    const email = String(row.email ?? '').trim().toLowerCase();
    if (!email) {
      continue;
    }

    if (!deduped.has(email)) {
      deduped.set(email, {
        email,
        full_name: row.full_name ?? null,
      });
    }
  }

  return [...deduped.values()];
}

function getRequiredEnv() {
  const smtpHost = required('SMTP_HOST');
  const smtpPort = required('SMTP_PORT');
  const smtpUser = required('SMTP_USER');
  const smtpPass = required('SMTP_PASS');
  const supabaseUrl = required('NEXT_PUBLIC_SUPABASE_URL');
  const supabaseServiceRoleKey = required('SUPABASE_SERVICE_ROLE_KEY');

  return {
    smtpHost,
    smtpPort,
    smtpUser,
    smtpPass,
    supabaseUrl,
    supabaseServiceRoleKey,
  };
}

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }

  return value;
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
