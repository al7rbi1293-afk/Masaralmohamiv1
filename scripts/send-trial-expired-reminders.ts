import { config as loadEnv } from 'dotenv';
import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';
import {
  TRIAL_EXPIRED_EMAIL_HTML,
  TRIAL_EXPIRED_EMAIL_SUBJECT,
  TRIAL_EXPIRED_EMAIL_TEXT,
} from '../apps/web/lib/email-templates';

type TrialRow = {
  org_id: string;
  ends_at: string;
  status: string;
};

type OrgRow = {
  id: string;
  name: string | null;
};

type MembershipRow = {
  org_id: string;
  user_id: string;
  role: string;
};

type UserRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  status: string | null;
};

type SubscriptionRow = {
  org_id: string;
  status: string | null;
  current_period_end: string | null;
};

type SubscriptionEventRow = {
  org_id: string;
  type: string;
  meta: Record<string, unknown> | null;
};

type EmailLogRow = {
  org_id: string;
  to_email: string;
};

type RecipientJob = {
  orgId: string;
  orgName: string;
  endedAt: string;
  trialStatus: string;
  userId: string;
  email: string;
  fullName: string;
  role: string;
  previouslySentExpired: boolean;
};

loadEnv({ path: 'apps/web/.env.local' });

const SHOULD_SEND = process.argv.includes('--send');
const LOG_ONLY = process.argv.includes('--log-only');
let subscriptionEventsTableAvailable: boolean | null = null;

async function main() {
  const env = getRequiredEnv();
  const siteUrl = getSiteUrl();

  const supabase = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const now = new Date();
  const nowIso = now.toISOString();

  const { data: trialData, error: trialError } = await supabase
    .from('trial_subscriptions')
    .select('org_id, ends_at, status')
    .lte('ends_at', nowIso)
    .in('status', ['active', 'expired'])
    .order('ends_at', { ascending: true });

  if (trialError) {
    throw new Error(`Failed to load trial subscriptions: ${trialError.message}`);
  }

  const trials = (trialData as TrialRow[] | null) ?? [];
  if (!trials.length) {
    console.log('No expired trial subscriptions found.');
    return;
  }

  const orgIds = [...new Set(trials.map((t) => t.org_id))];

  const [orgResult, membershipResult] = await Promise.all([
    supabase.from('organizations').select('id, name').in('id', orgIds),
    supabase.from('memberships').select('org_id, user_id, role').in('org_id', orgIds),
  ]);

  if (orgResult.error) {
    throw new Error(`Failed to load organizations: ${orgResult.error.message}`);
  }

  if (membershipResult.error) {
    throw new Error(`Failed to load memberships: ${membershipResult.error.message}`);
  }

  const organizations = ((orgResult.data as OrgRow[] | null) ?? []).reduce<Map<string, string>>((map, row) => {
    map.set(row.id, normalizeOrgName(row.name));
    return map;
  }, new Map());

  const memberships = (membershipResult.data as MembershipRow[] | null) ?? [];
  const uniqueUserIds = [...new Set(memberships.map((m) => m.user_id).filter(Boolean))];

  const userMap = new Map<string, UserRow>();
  if (uniqueUserIds.length) {
    const { data: userData, error: userError } = await supabase
      .from('app_users')
      .select('id, email, full_name, status')
      .in('id', uniqueUserIds);

    if (userError) {
      throw new Error(`Failed to load users: ${userError.message}`);
    }

    for (const user of ((userData as UserRow[] | null) ?? [])) {
      userMap.set(user.id, user);
    }
  }

  const activePaidOrgIds = await loadActivePaidOrgIds(supabase, orgIds, now);

  const previouslySentExpired = await loadPreviouslySentExpiredRecipients(supabase, orgIds);

  const jobs: RecipientJob[] = [];
  let skippedPaidOrgs = 0;

  const membershipsByOrg = new Map<string, MembershipRow[]>();
  for (const membership of memberships) {
    const current = membershipsByOrg.get(membership.org_id) ?? [];
    current.push(membership);
    membershipsByOrg.set(membership.org_id, current);
  }

  for (const trial of trials) {
    if (activePaidOrgIds.has(trial.org_id)) {
      skippedPaidOrgs += 1;
      continue;
    }

    const orgName = organizations.get(trial.org_id) ?? 'مسار المحامي';
    const orgMemberships = (membershipsByOrg.get(trial.org_id) ?? []).sort(
      (a, b) => roleRank(a.role) - roleRank(b.role),
    );

    const seenEmails = new Set<string>();

    for (const membership of orgMemberships) {
      const user = userMap.get(membership.user_id);
      const email = String(user?.email ?? '').trim().toLowerCase();
      const status = String(user?.status ?? '').trim().toLowerCase();

      if (!email || status !== 'active') continue;
      if (seenEmails.has(email)) continue;
      seenEmails.add(email);

      jobs.push({
        orgId: trial.org_id,
        orgName,
        endedAt: trial.ends_at,
        trialStatus: trial.status,
        userId: membership.user_id,
        email,
        fullName: String(user?.full_name ?? '').trim() || 'عميلنا الكريم',
        role: membership.role,
        previouslySentExpired: previouslySentExpired.has(`${trial.org_id}|${email}`),
      });
    }
  }

  const uniqueOrgJobs = [...new Set(jobs.map((j) => j.orgId))];
  const previouslySentCount = jobs.filter((j) => j.previouslySentExpired).length;
  const firstTimeCount = jobs.length - previouslySentCount;

  console.log(
    JSON.stringify(
      {
        mode: SHOULD_SEND ? 'send' : LOG_ONLY ? 'log-only' : 'dry-run',
        now: nowIso,
        expiredTrialRows: trials.length,
        expiredOrgs: orgIds.length,
        skippedPaidOrgs,
        targetOrgs: uniqueOrgJobs.length,
        recipients: jobs.length,
        previouslySentCount,
        firstTimeCount,
      },
      null,
      2,
    ),
  );

  if (!jobs.length) {
    console.log('No recipients eligible after filtering.');
    return;
  }

  const preview = jobs.slice(0, 15).map((j) => ({
    orgId: j.orgId,
    orgName: j.orgName,
    email: j.email,
    role: j.role,
    endedAt: j.endedAt,
    previouslySentExpired: j.previouslySentExpired,
  }));

  console.log('Preview recipients (max 15):');
  console.log(JSON.stringify(preview, null, 2));

  if (!SHOULD_SEND && !LOG_ONLY) {
    console.log('Dry-run complete. Re-run with --send to send emails.');
    return;
  }

  if (LOG_ONLY) {
    let logged = 0;
    for (const job of jobs) {
      await recordReminderEventAndEmailLog(supabase, {
        orgId: job.orgId,
        userId: job.userId,
        email: job.email,
        subject: TRIAL_EXPIRED_EMAIL_SUBJECT,
        orgName: job.orgName,
        endedAt: job.endedAt,
        role: job.role,
        previouslySentExpired: job.previouslySentExpired,
      });
      logged += 1;
    }

    console.log(
      JSON.stringify(
        {
          mode: 'log-only',
          attempted: jobs.length,
          logged,
        },
        null,
        2,
      ),
    );
    return;
  }

  const fromAddress = normalizeFromAddress(env.smtpFrom);

  const transport = nodemailer.createTransport({
    host: env.smtpHost,
    port: Number(env.smtpPort),
    secure: Number(env.smtpPort) === 465,
    auth: {
      user: env.smtpUser,
      pass: env.smtpPass,
    },
  });

  const activeExpiredOrgIds = [...new Set(trials.filter((t) => t.status === 'active').map((t) => t.org_id))]
    .filter((id) => uniqueOrgJobs.includes(id));

  if (activeExpiredOrgIds.length) {
    const { error: markExpiredError } = await supabase
      .from('trial_subscriptions')
      .update({ status: 'expired', updated_at: nowIso })
      .in('org_id', activeExpiredOrgIds)
      .eq('status', 'active');

    if (markExpiredError) {
      console.warn(`Failed to mark some trials as expired: ${markExpiredError.message}`);
    } else {
      console.log(`Marked ${activeExpiredOrgIds.length} org trials as expired.`);
    }
  }

  let successCount = 0;
  const failures: Array<{ orgId: string; email: string; error: string }> = [];

  for (const job of jobs) {
    const endedAtLabel = formatArabicDate(job.endedAt);
    const text = TRIAL_EXPIRED_EMAIL_TEXT({
      recipientName: job.fullName,
      orgName: job.orgName,
      endedAtLabel,
      upgradeUrl: `${siteUrl}/upgrade`,
      supportEmail: 'masar.almohami@outlook.sa',
    });
    const html = TRIAL_EXPIRED_EMAIL_HTML({
      recipientName: job.fullName,
      orgName: job.orgName,
      endedAtLabel,
      upgradeUrl: `${siteUrl}/upgrade`,
      supportEmail: 'masar.almohami@outlook.sa',
    });

    try {
      await transport.sendMail({
        from: {
          name: 'مسار المحامي',
          address: fromAddress,
        },
        envelope: {
          from: env.smtpUser,
          to: job.email,
        },
        to: job.email,
        subject: TRIAL_EXPIRED_EMAIL_SUBJECT,
        text,
        html,
      });

      successCount += 1;

      await recordReminderEventAndEmailLog(supabase, {
        orgId: job.orgId,
        userId: job.userId,
        email: job.email,
        subject: TRIAL_EXPIRED_EMAIL_SUBJECT,
        orgName: job.orgName,
        endedAt: job.endedAt,
        role: job.role,
        previouslySentExpired: job.previouslySentExpired,
      });

      console.log(
        `Sent ${successCount}/${jobs.length} -> ${job.email} (${job.orgName})${
          job.previouslySentExpired ? ' [reminder]' : ' [first-time]'
        }`,
      );

      await sleep(200);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error ?? 'unknown_error');
      failures.push({ orgId: job.orgId, email: job.email, error: message });
      console.error(`Failed -> ${job.email} (${job.orgName}): ${message}`);
      await sleep(200);
    }
  }

  console.log(
    JSON.stringify(
      {
        mode: 'send',
        attempted: jobs.length,
        successCount,
        failureCount: failures.length,
        failures,
      },
      null,
      2,
    ),
  );

  if (failures.length) {
    process.exitCode = 1;
  }
}

async function loadActivePaidOrgIds(
  supabase: ReturnType<typeof createClient>,
  orgIds: string[],
  now: Date,
): Promise<Set<string>> {
  if (!orgIds.length) return new Set();

  const active = new Set<string>();
  const { data, error } = await supabase
    .from('subscriptions')
    .select('org_id, status, current_period_end')
    .in('org_id', orgIds);

  if (error) {
    console.warn(`Could not load subscriptions table (continuing without paid filter): ${error.message}`);
    return active;
  }

  for (const row of ((data as SubscriptionRow[] | null) ?? [])) {
    const status = String(row.status ?? '').trim().toLowerCase();
    const periodEnd = row.current_period_end ? new Date(row.current_period_end) : null;
    const hasFuturePeriod = Boolean(periodEnd) && !Number.isNaN(periodEnd!.getTime()) && periodEnd!.getTime() > now.getTime();
    const activeStatus = status === 'active' || status === 'past_due' || status === 'canceled';

    if (activeStatus && hasFuturePeriod && row.org_id) {
      active.add(row.org_id);
    }
  }

  return active;
}

async function loadPreviouslySentExpiredRecipients(
  supabase: ReturnType<typeof createClient>,
  orgIds: string[],
): Promise<Set<string>> {
  const sent = new Set<string>();
  if (!orgIds.length) return sent;

  if (subscriptionEventsTableAvailable !== false) {
    const { data, error } = await supabase
      .from('subscription_events')
      .select('org_id, type, meta')
      .in('org_id', orgIds)
      .in('type', ['trial.expired.sent', 'trial.expired.reminder.sent']);

    if (!error) {
      subscriptionEventsTableAvailable = true;
      for (const row of ((data as SubscriptionEventRow[] | null) ?? [])) {
        const email = String((row.meta?.to_email as string | undefined) ?? '').trim().toLowerCase();
        if (!row.org_id || !email) continue;
        sent.add(`${row.org_id}|${email}`);
      }
      return sent;
    }

    if (isMissingTableError(error.message, 'subscription_events')) {
      subscriptionEventsTableAvailable = false;
      console.warn('subscription_events table is not available, falling back to email_logs history.');
    } else {
      console.warn(`Could not load previous subscription events: ${error.message}`);
    }
  }

  const { data: emailLogData, error: emailLogError } = await supabase
    .from('email_logs')
    .select('org_id, to_email')
    .in('org_id', orgIds)
    .eq('template', 'trial_expired')
    .eq('status', 'sent');

  if (emailLogError) {
    console.warn(`Could not load previous email logs: ${emailLogError.message}`);
    return sent;
  }

  for (const row of ((emailLogData as EmailLogRow[] | null) ?? [])) {
    const orgId = String(row.org_id ?? '').trim();
    const email = String(row.to_email ?? '').trim().toLowerCase();
    if (!orgId || !email) continue;
    sent.add(`${orgId}|${email}`);
  }

  return sent;
}

async function recordReminderEventAndEmailLog(
  supabase: ReturnType<typeof createClient>,
  params: {
    orgId: string;
    userId: string;
    email: string;
    subject: string;
    orgName: string;
    endedAt: string;
    role: string;
    previouslySentExpired: boolean;
  },
) {
  const eventMeta = {
    to_email: params.email,
    recipient_user_id: params.userId,
    template: 'trial_expired',
    subject: params.subject,
    ends_at: params.endedAt,
    reminder: true,
    previously_sent_expired: params.previouslySentExpired,
  };

  if (subscriptionEventsTableAvailable !== false) {
    const { error: eventError } = await supabase.from('subscription_events').insert({
      org_id: params.orgId,
      type: 'trial.expired.reminder.sent',
      meta: eventMeta,
    });

    if (eventError) {
      if (isMissingTableError(eventError.message, 'subscription_events')) {
        subscriptionEventsTableAvailable = false;
      } else {
        console.warn(`Failed to record subscription event for ${params.email}: ${eventError.message}`);
      }
    } else {
      subscriptionEventsTableAvailable = true;
    }
  }

  const { error: emailLogError } = await supabase.from('email_logs').insert({
    org_id: params.orgId,
    sent_by: params.userId,
    to_email: params.email,
    subject: params.subject,
    email_type: 'trial_expired',
    template: 'trial_expired',
    meta: {
      automated: true,
      reminder: true,
      org_name: params.orgName,
      role: params.role,
      ends_at: params.endedAt,
      previously_sent_expired: params.previouslySentExpired,
    },
    status: 'sent',
  });

  if (emailLogError) {
    console.warn(`Failed to record email_log for ${params.email}: ${emailLogError.message}`);
  }
}

function isMissingTableError(message: string, table: string) {
  return message.includes(`Could not find the table 'public.${table}'`);
}

function roleRank(role: string) {
  if (role === 'owner') return 0;
  if (role === 'lawyer') return 1;
  return 2;
}

function normalizeOrgName(value: string | null | undefined) {
  return value?.trim() || 'مسار المحامي';
}

function formatArabicDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat('ar-SA', {
    dateStyle: 'long',
  }).format(date);
}

function getSiteUrl() {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() ||
    'https://masaralmohami.com';

  const withProtocol = raw.startsWith('http://') || raw.startsWith('https://') ? raw : `https://${raw}`;
  return withProtocol.replace(/\/$/, '');
}

function normalizeFromAddress(rawFrom: string) {
  const trimmed = rawFrom.trim();
  const bracketMatch = trimmed.match(/<([^>]+)>/);
  const extracted = (bracketMatch?.[1] ?? trimmed).trim();
  return extracted.replaceAll('<', '').replaceAll('>', '').replaceAll('"', '');
}

function getRequiredEnv() {
  return {
    supabaseUrl: required('NEXT_PUBLIC_SUPABASE_URL'),
    supabaseServiceRoleKey: required('SUPABASE_SERVICE_ROLE_KEY'),
    smtpHost: required('SMTP_HOST'),
    smtpPort: required('SMTP_PORT'),
    smtpUser: required('SMTP_USER'),
    smtpPass: required('SMTP_PASS'),
    smtpFrom: required('SMTP_FROM'),
  };
}

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
