import { config as loadEnv } from 'dotenv';
import nodemailer from 'nodemailer';
import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import {
  TEAM_INVITATION_EMAIL_HTML,
  TEAM_INVITATION_EMAIL_SUBJECT,
  TEAM_INVITATION_EMAIL_TEXT,
} from '../apps/web/lib/email-templates';

type MembershipRow = {
  org_id: string;
  user_id: string;
  role: string;
  created_at: string;
};

type UserRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  status: string | null;
  email_verified: boolean | null;
};

type OrganizationRow = {
  id: string;
  name: string | null;
};

type RecipientJob = {
  orgId: string;
  orgName: string;
  userId: string;
  email: string;
  fullName: string | null;
  role: 'lawyer' | 'assistant';
  invitedBy: string;
  invitedByName: string | null;
  emailVerified: boolean;
};

loadEnv({ path: 'apps/web/.env.local' });

const SHOULD_SEND = process.argv.includes('--send');
const LIMIT = readNumericFlag('--limit');

async function main() {
  const env = getRequiredEnv();
  const siteUrl = getSiteUrl();
  const supabase = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data: memberRows, error: memberError } = await supabase
    .from('memberships')
    .select('org_id, user_id, role, created_at')
    .in('role', ['lawyer', 'assistant'])
    .order('created_at', { ascending: true });

  if (memberError) {
    throw new Error(`Failed to load team members: ${memberError.message}`);
  }

  const members = (memberRows as MembershipRow[] | null) ?? [];
  if (!members.length) {
    console.log('No non-owner team members found.');
    return;
  }

  const orgIds = [...new Set(members.map((row) => row.org_id))];
  const memberUserIds = [...new Set(members.map((row) => row.user_id))];

  const [orgResult, ownerResult, userResult] = await Promise.all([
    supabase.from('organizations').select('id, name').in('id', orgIds),
    supabase
      .from('memberships')
      .select('org_id, user_id, role, created_at')
      .eq('role', 'owner')
      .in('org_id', orgIds)
      .order('created_at', { ascending: true }),
    supabase
      .from('app_users')
      .select('id, email, full_name, status, email_verified')
      .in('id', memberUserIds),
  ]);

  if (orgResult.error) {
    throw new Error(`Failed to load organizations: ${orgResult.error.message}`);
  }

  if (ownerResult.error) {
    throw new Error(`Failed to load organization owners: ${ownerResult.error.message}`);
  }

  if (userResult.error) {
    throw new Error(`Failed to load member users: ${userResult.error.message}`);
  }

  const owners = (ownerResult.data as MembershipRow[] | null) ?? [];
  const users = (userResult.data as UserRow[] | null) ?? [];
  const ownerIds = [...new Set(owners.map((row) => row.user_id))];

  const { data: ownerUsers, error: ownerUsersError } = ownerIds.length
    ? await supabase
        .from('app_users')
        .select('id, full_name')
        .in('id', ownerIds)
    : { data: [], error: null };

  if (ownerUsersError) {
    throw new Error(`Failed to load owner users: ${ownerUsersError.message}`);
  }

  const orgNameById = new Map<string, string>();
  for (const org of ((orgResult.data as OrganizationRow[] | null) ?? [])) {
    orgNameById.set(org.id, normalizeOrgName(org.name));
  }

  const ownerByOrg = new Map<string, string>();
  for (const owner of owners) {
    if (!ownerByOrg.has(owner.org_id)) {
      ownerByOrg.set(owner.org_id, owner.user_id);
    }
  }

  const ownerNameById = new Map<string, string>();
  for (const ownerUser of ((ownerUsers as Array<{ id: string; full_name: string | null }> | null) ?? [])) {
    ownerNameById.set(ownerUser.id, String(ownerUser.full_name ?? '').trim());
  }

  const userById = new Map<string, UserRow>();
  for (const user of users) {
    userById.set(user.id, user);
  }

  let skippedMissingOwner = 0;
  let skippedMissingEmail = 0;
  let skippedInactive = 0;

  const jobs: RecipientJob[] = [];
  for (const member of members) {
    const user = userById.get(member.user_id);
    if (!user) {
      skippedMissingEmail += 1;
      continue;
    }

    const ownerId = ownerByOrg.get(member.org_id);
    if (!ownerId) {
      skippedMissingOwner += 1;
      continue;
    }

    const email = String(user.email ?? '').trim().toLowerCase();
    if (!email) {
      skippedMissingEmail += 1;
      continue;
    }

    const status = String(user.status ?? '').trim().toLowerCase();
    if (status !== 'active') {
      skippedInactive += 1;
      continue;
    }

    jobs.push({
      orgId: member.org_id,
      orgName: orgNameById.get(member.org_id) ?? 'مكتبكم',
      userId: member.user_id,
      email,
      fullName: String(user.full_name ?? '').trim() || null,
      role: member.role === 'assistant' ? 'assistant' : 'lawyer',
      invitedBy: ownerId,
      invitedByName: ownerNameById.get(ownerId) || null,
      emailVerified: Boolean(user.email_verified),
    });
  }

  const limitedJobs = LIMIT ? jobs.slice(0, LIMIT) : jobs;

  console.log(
    JSON.stringify(
      {
        mode: SHOULD_SEND ? 'send' : 'dry-run',
        candidates: members.length,
        recipients: limitedJobs.length,
        skippedMissingOwner,
        skippedMissingEmail,
        skippedInactive,
        skippedUnverified: limitedJobs.filter((job) => !job.emailVerified).length,
        limit: LIMIT ?? null,
      },
      null,
      2,
    ),
  );

  if (!limitedJobs.length) {
    console.log('No recipients eligible after filtering.');
    return;
  }

  console.log('Preview recipients (max 20):');
  console.log(
    JSON.stringify(
      limitedJobs.slice(0, 20).map((job) => ({
        orgId: job.orgId,
        orgName: job.orgName,
        email: job.email,
        role: job.role,
        emailVerified: job.emailVerified,
      })),
      null,
      2,
    ),
  );

  if (!SHOULD_SEND) {
    console.log('Dry-run complete. Re-run with --send to send emails.');
    return;
  }

  const transport = nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpPort === 465,
    auth: {
      user: env.smtpUser,
      pass: env.smtpPass,
    },
  });

  let sent = 0;
  let failed = 0;

  for (const job of limitedJobs) {
    try {
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const invitation = await createInvitationRecord(supabase, {
        orgId: job.orgId,
        email: job.email,
        role: job.role,
        invitedBy: job.invitedBy,
        expiresAt,
      });

      const links = buildLinks(siteUrl, job.email, invitation.token);
      const expiresAtLabel = formatInviteExpiry(expiresAt);

      await transport.sendMail({
        from: {
          name: 'مسار المحامي',
          address: env.smtpFrom,
        },
        to: job.email,
        subject: TEAM_INVITATION_EMAIL_SUBJECT,
        text: TEAM_INVITATION_EMAIL_TEXT({
          recipientName: job.fullName,
          recipientEmail: job.email,
          orgName: job.orgName,
          role: job.role,
          inviteUrl: links.inviteUrl,
          signInUrl: links.signInUrl,
          forgotPasswordUrl: links.forgotPasswordUrl,
          expiresAtLabel,
          invitedByName: job.invitedByName,
        }),
        html: TEAM_INVITATION_EMAIL_HTML({
          recipientName: job.fullName,
          recipientEmail: job.email,
          orgName: job.orgName,
          role: job.role,
          inviteUrl: links.inviteUrl,
          signInUrl: links.signInUrl,
          forgotPasswordUrl: links.forgotPasswordUrl,
          expiresAtLabel,
          invitedByName: job.invitedByName,
        }),
      });

      sent += 1;
      console.log(`[sent] ${job.email} <- ${job.orgName}`);
    } catch (error) {
      failed += 1;
      console.error(`[failed] ${job.email}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  console.log(
    JSON.stringify(
      {
        sent,
        failed,
        attempted: limitedJobs.length,
      },
      null,
      2,
    ),
  );
}

function readNumericFlag(flag: string) {
  const index = process.argv.findIndex((arg) => arg === flag);
  if (index === -1) return null;

  const raw = process.argv[index + 1];
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : null;
}

function normalizeOrgName(value: string | null) {
  return String(value ?? '').trim() || 'مكتبكم';
}

function getSiteUrl() {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() ||
    'https://masaralmohami.com';

  return raw.replace(/\/$/, '');
}

function formatInviteExpiry(date: Date) {
  return new Intl.DateTimeFormat('ar-SA', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function buildLinks(siteUrl: string, email: string, token: string) {
  return {
    inviteUrl: `${siteUrl}/invite/${token}`,
    signInUrl: `${siteUrl}/signin?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`,
    forgotPasswordUrl: `${siteUrl}/forgot-password?email=${encodeURIComponent(email)}`,
  };
}

function generateToken() {
  return randomBytes(32).toString('base64url');
}

async function createInvitationRecord(
  client: ReturnType<typeof createClient>,
  params: {
    orgId: string;
    email: string;
    role: 'lawyer' | 'assistant';
    invitedBy: string;
    expiresAt: Date;
  },
) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const token = generateToken();
    const { data, error } = await client
      .from('org_invitations')
      .insert({
        org_id: params.orgId,
        email: params.email,
        role: params.role,
        token,
        expires_at: params.expiresAt.toISOString(),
        invited_by: params.invitedBy,
      })
      .select('id, token')
      .maybeSingle();

    if (!error && data) {
      return {
        id: String((data as any).id),
        token: String((data as any).token),
      };
    }

    const code = (error as any)?.code ? String((error as any).code) : '';
    const message = String((error as any)?.message ?? '');
    const isDuplicate = code === '23505' || message.toLowerCase().includes('duplicate');
    if (!isDuplicate) {
      throw new Error(`Failed creating invitation: ${message || 'unknown error'}`);
    }
  }

  throw new Error('Failed creating invitation after multiple attempts.');
}

function getRequiredEnv() {
  const smtpHost = requireEnv('SMTP_HOST');
  const smtpPort = Number(requireEnv('SMTP_PORT'));
  const smtpUser = requireEnv('SMTP_USER');
  const smtpPass = requireEnv('SMTP_PASS');
  const smtpFrom = requireEnv('SMTP_FROM');
  const supabaseUrl = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
  const supabaseServiceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

  if (!Number.isFinite(smtpPort) || smtpPort <= 0) {
    throw new Error('SMTP_PORT is invalid.');
  }

  return {
    smtpHost,
    smtpPort,
    smtpUser,
    smtpPass,
    smtpFrom,
    supabaseUrl,
    supabaseServiceRoleKey,
  };
}

function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
