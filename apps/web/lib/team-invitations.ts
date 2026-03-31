import 'server-only';

import { randomBytes } from 'crypto';
import { getPublicSiteUrl, isSmtpConfigured } from '@/lib/env';
import { sendEmail } from '@/lib/email';
import {
  TEAM_INVITATION_EMAIL_HTML,
  TEAM_INVITATION_EMAIL_SUBJECT,
  TEAM_INVITATION_EMAIL_TEXT,
} from '@/lib/email-templates';

export type TeamInviteRole = 'owner' | 'lawyer' | 'assistant';

export type TeamInvitationRecord = {
  id: string;
  email: string;
  role: TeamInviteRole;
  token: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
};

export type TeamInviteEmailStatus = 'sent' | 'smtp_not_configured';

type SupabaseLikeClient = {
  from: (table: string) => any;
};

function generateToken() {
  return randomBytes(32).toString('base64url');
}

export function formatInviteExpiryDate(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return typeof value === 'string' ? value : value.toISOString();
  }

  return new Intl.DateTimeFormat('ar-SA', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function buildTeamInvitationLinks(params: { email: string; token: string }) {
  const siteUrl = getPublicSiteUrl();
  const normalizedEmail = params.email.trim().toLowerCase();
  const encodedToken = encodeURIComponent(params.token);
  const encodedEmail = encodeURIComponent(normalizedEmail);

  return {
    inviteUrl: `${siteUrl}/invite/${params.token}`,
    signInUrl: `${siteUrl}/signin?token=${encodedToken}&email=${encodedEmail}`,
    forgotPasswordUrl: `${siteUrl}/forgot-password?email=${encodedEmail}`,
  };
}

export async function createOrgInvitationRecord(params: {
  db: SupabaseLikeClient;
  orgId: string;
  email: string;
  role: TeamInviteRole;
  invitedBy: string;
  expiresAt: Date;
}) {
  const normalizedEmail = params.email.trim().toLowerCase();

  let inserted: TeamInvitationRecord | null = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const token = generateToken();
    const { data, error } = await params.db
      .from('org_invitations')
      .insert({
        org_id: params.orgId,
        email: normalizedEmail,
        role: params.role,
        token,
        expires_at: params.expiresAt.toISOString(),
        invited_by: params.invitedBy,
      })
      .select('id, email, role, token, expires_at, accepted_at, created_at')
      .maybeSingle();

    if (!error && data) {
      inserted = {
        id: String((data as any).id),
        email: String((data as any).email),
        role: (data as any).role as TeamInviteRole,
        token: String((data as any).token),
        expires_at: String((data as any).expires_at),
        accepted_at: (data as any).accepted_at ? String((data as any).accepted_at) : null,
        created_at: String((data as any).created_at),
      };
      break;
    }

    const code = (error as any)?.code ? String((error as any).code) : '';
    const message = String((error as any)?.message ?? '');
    const isDuplicate = code === '23505' || message.toLowerCase().includes('duplicate');
    if (!isDuplicate) {
      throw error instanceof Error ? error : new Error('تعذر إنشاء الدعوة.');
    }
  }

  if (!inserted) {
    throw new Error('تعذر إنشاء الدعوة.');
  }

  return inserted;
}

async function loadEmailContext(params: {
  db: SupabaseLikeClient;
  orgId: string;
  invitedBy: string;
}) {
  const [orgResult, profileResult, userResult] = await Promise.all([
    params.db.from('organizations').select('name').eq('id', params.orgId).maybeSingle(),
    params.db.from('profiles').select('full_name').eq('user_id', params.invitedBy).maybeSingle(),
    params.db.from('app_users').select('full_name').eq('id', params.invitedBy).maybeSingle(),
  ]);

  const orgName = String((orgResult.data as { name?: string | null } | null)?.name ?? '').trim() || 'مكتبكم';
  const invitedByName =
    String((profileResult.data as { full_name?: string | null } | null)?.full_name ?? '').trim() ||
    String((userResult.data as { full_name?: string | null } | null)?.full_name ?? '').trim() ||
    null;

  return { orgName, invitedByName };
}

export async function sendTeamInvitationEmail(params: {
  db: SupabaseLikeClient;
  orgId: string;
  invitedBy: string;
  recipientEmail: string;
  recipientName?: string | null;
  role: TeamInviteRole;
  token: string;
  expiresAt: string | Date;
}) {
  if (!isSmtpConfigured()) {
    return 'smtp_not_configured' as const;
  }

  const { orgName, invitedByName } = await loadEmailContext({
    db: params.db,
    orgId: params.orgId,
    invitedBy: params.invitedBy,
  });

  const links = buildTeamInvitationLinks({
    email: params.recipientEmail,
    token: params.token,
  });

  const expiresAtLabel = formatInviteExpiryDate(params.expiresAt);

  await sendEmail({
    to: params.recipientEmail,
    subject: TEAM_INVITATION_EMAIL_SUBJECT,
    text: TEAM_INVITATION_EMAIL_TEXT({
      recipientName: params.recipientName,
      recipientEmail: params.recipientEmail,
      orgName,
      role: params.role,
      inviteUrl: links.inviteUrl,
      signInUrl: links.signInUrl,
      forgotPasswordUrl: links.forgotPasswordUrl,
      expiresAtLabel,
      invitedByName,
    }),
    html: TEAM_INVITATION_EMAIL_HTML({
      recipientName: params.recipientName,
      recipientEmail: params.recipientEmail,
      orgName,
      role: params.role,
      inviteUrl: links.inviteUrl,
      signInUrl: links.signInUrl,
      forgotPasswordUrl: links.forgotPasswordUrl,
      expiresAtLabel,
      invitedByName,
    }),
  });

  return 'sent' as const;
}
