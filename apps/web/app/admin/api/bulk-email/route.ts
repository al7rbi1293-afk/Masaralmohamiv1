import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin';
import { sendEmail } from '@/lib/email';
import {
  TRIAL_EXPIRED_EMAIL_HTML,
  TRIAL_EXPIRED_EMAIL_SUBJECT,
  TRIAL_EXPIRED_EMAIL_TEXT,
} from '@/lib/email-templates';
import { getPublicSiteUrl, isSmtpConfigured } from '@/lib/env';
import { buildRtlEmailHtmlFromText } from '@/lib/invoice-email-template';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const TRIAL_EXPIRED_TEMPLATE = 'trial_expired';
const TRIAL_EXPIRED_SENT_EVENT = 'trial.expired.sent';
const TRIAL_EXPIRED_REMINDER_EVENT = 'trial.expired.reminder.sent';
const ADMIN_ANNOUNCEMENT_TEMPLATE = 'admin_announcement';
const ADMIN_ANNOUNCEMENT_EVENT = 'admin.bulk.announcement.sent';
const SUPPORT_EMAIL = 'masar.almohami@outlook.sa';
const PREVIEW_LIMIT = 25;
const DEFAULT_BATCH_SIZE = 80;
const MIN_BATCH_SIZE = 20;
const MAX_BATCH_SIZE = 300;

const requestSchema = z.discriminatedUnion('campaign', [
  z.object({
    campaign: z.literal('trial_expired'),
    mode: z.enum(['preview', 'send', 'send_batch']),
    batch_index: z.number().int().min(0).optional(),
    batch_size: z.number().int().min(MIN_BATCH_SIZE).max(MAX_BATCH_SIZE).optional(),
  }),
  z.object({
    campaign: z.literal('announcement'),
    mode: z.enum(['preview', 'send', 'send_batch']),
    audience: z.enum(['users', 'offices', 'users_and_offices']),
    subject: z.string().trim().min(3, 'عنوان الرسالة قصير جدًا.').max(180, 'عنوان الرسالة طويل جدًا.'),
    message: z.string().trim().min(5, 'نص الرسالة قصير جدًا.').max(4000, 'نص الرسالة طويل جدًا.'),
    batch_index: z.number().int().min(0).optional(),
    batch_size: z.number().int().min(MIN_BATCH_SIZE).max(MAX_BATCH_SIZE).optional(),
  }),
]);

type CampaignSendMode = 'send' | 'send_batch';

type BatchWindow = {
  mode: CampaignSendMode;
  batchIndex: number;
  batchSize: number;
  start: number;
  end: number;
  total: number;
  hasMore: boolean;
  nextBatchIndex: number | null;
};

type TrialRow = {
  org_id: string;
  ends_at: string;
  status: string;
};

type OrgRow = {
  id: string;
  name: string | null;
  status: string | null;
};

type MembershipRow = {
  org_id: string;
  user_id: string;
  role: string | null;
};

type UserRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  status: string | null;
  email_verified?: boolean | null;
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
  org_id: string | null;
  to_email: string | null;
};

type TrialCampaignJob = {
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

type AnnouncementAudience = 'users' | 'offices' | 'users_and_offices';
type AnnouncementSource = AnnouncementAudience;

type AnnouncementRecipient = {
  email: string;
  fullName: string;
  orgId: string | null;
  orgName: string | null;
  source: AnnouncementSource;
};

type CampaignFeatureState = {
  subscriptionEventsTableAvailable: boolean | null;
};

type TrialCampaignPlan = {
  jobs: TrialCampaignJob[];
  stats: {
    expiredTrialRows: number;
    expiredOrgs: number;
    targetOrgs: number;
    recipients: number;
    firstTimeCount: number;
    reminderCount: number;
    skippedPaidOrgs: number;
  };
  preview: Array<{
    orgId: string;
    orgName: string;
    email: string;
    fullName: string;
    role: string;
    endedAt: string;
    kind: 'first-time' | 'reminder';
  }>;
};

type AnnouncementPlan = {
  jobs: AnnouncementRecipient[];
  stats: {
    audience: AnnouncementAudience;
    recipients: number;
    usersCount: number;
    officesCount: number;
  };
  preview: Array<{
    email: string;
    fullName: string;
    orgName: string | null;
    source: AnnouncementSource;
  }>;
};

export async function POST(request: Request) {
  let adminId: string;
  try {
    adminId = await requireAdmin();
  } catch {
    return NextResponse.json({ error: 'غير مصرح.' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'بيانات الطلب غير صحيحة.' }, { status: 400 });
  }

  const db = createSupabaseServerClient();
  const featureState: CampaignFeatureState = { subscriptionEventsTableAvailable: null };

  try {
    if (parsed.data.campaign === 'trial_expired') {
      const plan = await buildTrialExpiredCampaignPlan(db, featureState);

      if (parsed.data.mode === 'preview') {
        return NextResponse.json({
          ok: true,
          campaign: 'trial_expired',
          mode: 'preview',
          stats: plan.stats,
          preview: plan.preview,
        });
      }

      if (!isSmtpConfigured()) {
        return NextResponse.json({ error: 'خدمة البريد غير مفعلة حالياً.' }, { status: 409 });
      }

      const batch = buildBatchWindow({
        total: plan.jobs.length,
        mode: parsed.data.mode,
        batchIndex: parsed.data.batch_index,
        batchSize: parsed.data.batch_size,
      });
      const jobs = plan.jobs.slice(batch.start, batch.end);
      const sendResult = await sendTrialExpiredCampaign(db, featureState, adminId, jobs);
      return NextResponse.json({
        ok: true,
        campaign: 'trial_expired',
        mode: parsed.data.mode,
        stats: plan.stats,
        result: sendResult,
        batch,
      });
    }

    const plan = await buildAnnouncementPlan(db, parsed.data.audience);
    if (parsed.data.mode === 'preview') {
      return NextResponse.json({
        ok: true,
        campaign: 'announcement',
        mode: 'preview',
        stats: plan.stats,
        preview: plan.preview,
      });
    }

    if (!isSmtpConfigured()) {
      return NextResponse.json({ error: 'خدمة البريد غير مفعلة حالياً.' }, { status: 409 });
    }

    const batch = buildBatchWindow({
      total: plan.jobs.length,
      mode: parsed.data.mode,
      batchIndex: parsed.data.batch_index,
      batchSize: parsed.data.batch_size,
    });
    const jobs = plan.jobs.slice(batch.start, batch.end);

    const sendResult = await sendAnnouncementCampaign({
      db,
      adminId,
      featureState,
      jobs,
      audience: parsed.data.audience,
      subjectTemplate: parsed.data.subject,
      messageTemplate: parsed.data.message,
    });

    return NextResponse.json({
      ok: true,
      campaign: 'announcement',
      mode: parsed.data.mode,
      stats: plan.stats,
      result: sendResult,
      batch,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'تعذر تنفيذ الإجراء.';
    return NextResponse.json({ error: message || 'تعذر تنفيذ الإجراء.' }, { status: 500 });
  }
}

async function buildTrialExpiredCampaignPlan(
  db: ReturnType<typeof createSupabaseServerClient>,
  featureState: CampaignFeatureState,
): Promise<TrialCampaignPlan> {
  const now = new Date();
  const nowIso = now.toISOString();

  const { data: trialData, error: trialError } = await db
    .from('trial_subscriptions')
    .select('org_id, ends_at, status')
    .lte('ends_at', nowIso)
    .in('status', ['active', 'expired'])
    .order('ends_at', { ascending: true });

  if (trialError) {
    throw new Error(`تعذر تحميل الاشتراكات التجريبية المنتهية: ${trialError.message}`);
  }

  const trials = ((trialData as TrialRow[] | null) ?? []).filter((row) => row.org_id && row.ends_at);
  if (!trials.length) {
    return {
      jobs: [],
      stats: {
        expiredTrialRows: 0,
        expiredOrgs: 0,
        targetOrgs: 0,
        recipients: 0,
        firstTimeCount: 0,
        reminderCount: 0,
        skippedPaidOrgs: 0,
      },
      preview: [],
    };
  }

  const orgIds = [...new Set(trials.map((trial) => trial.org_id))];
  const [orgMap, memberships, activePaidOrgIds, sentRecipients] = await Promise.all([
    loadOrgNameMapByOrgIds(db, orgIds),
    loadMembershipsByOrgIds(db, orgIds),
    loadActivePaidOrgIds(db, orgIds, now),
    loadPreviouslySentExpiredRecipients(db, featureState, orgIds),
  ]);

  const userIds = [...new Set(memberships.map((membership) => membership.user_id).filter(Boolean))];
  const users = await loadUsersByUserIds(db, userIds);
  const userMap = new Map<string, UserRow>();
  for (const user of users) {
    userMap.set(user.id, user);
  }

  const membershipsByOrg = new Map<string, MembershipRow[]>();
  for (const membership of memberships) {
    const group = membershipsByOrg.get(membership.org_id) ?? [];
    group.push(membership);
    membershipsByOrg.set(membership.org_id, group);
  }

  const jobs: TrialCampaignJob[] = [];
  let skippedPaidOrgs = 0;

  for (const trial of trials) {
    if (activePaidOrgIds.has(trial.org_id)) {
      skippedPaidOrgs += 1;
      continue;
    }

    const orgMemberships = [...(membershipsByOrg.get(trial.org_id) ?? [])].sort(
      (left, right) => roleRank(left.role) - roleRank(right.role),
    );
    const seenEmails = new Set<string>();

    for (const membership of orgMemberships) {
      const user = userMap.get(membership.user_id);
      const email = normalizeEmail(user?.email);
      const status = String(user?.status ?? '').trim().toLowerCase();
      if (!email || status !== 'active') {
        continue;
      }

      if (seenEmails.has(email)) {
        continue;
      }
      seenEmails.add(email);

      const key = `${trial.org_id}|${email}`;
      jobs.push({
        orgId: trial.org_id,
        orgName: orgMap.get(trial.org_id) ?? 'مسار المحامي',
        endedAt: trial.ends_at,
        trialStatus: trial.status,
        userId: membership.user_id,
        email,
        fullName: normalizeFullName(user?.full_name),
        role: membership.role ?? 'member',
        previouslySentExpired: sentRecipients.has(key),
      });
    }
  }

  const reminderCount = jobs.filter((job) => job.previouslySentExpired).length;
  const firstTimeCount = jobs.length - reminderCount;
  const targetOrgIds = [...new Set(jobs.map((job) => job.orgId))];

  return {
    jobs,
    stats: {
      expiredTrialRows: trials.length,
      expiredOrgs: orgIds.length,
      targetOrgs: targetOrgIds.length,
      recipients: jobs.length,
      firstTimeCount,
      reminderCount,
      skippedPaidOrgs,
    },
    preview: jobs.slice(0, PREVIEW_LIMIT).map((job) => ({
      orgId: job.orgId,
      orgName: job.orgName,
      email: job.email,
      fullName: job.fullName,
      role: job.role,
      endedAt: job.endedAt,
      kind: job.previouslySentExpired ? 'reminder' : 'first-time',
    })),
  };
}

async function sendTrialExpiredCampaign(
  db: ReturnType<typeof createSupabaseServerClient>,
  featureState: CampaignFeatureState,
  adminId: string,
  jobs: TrialCampaignJob[],
) {
  if (!jobs.length) {
    return {
      attempted: 0,
      sent: 0,
      failed: 0,
      failures: [] as Array<{ orgId: string; email: string; error: string }>,
      updatedTrialsToExpired: 0,
    };
  }

  const activeExpiredOrgIds = [...new Set(
    jobs
      .filter((job) => job.trialStatus === 'active')
      .map((job) => job.orgId),
  )];

  let updatedTrialsToExpired = 0;
  if (activeExpiredOrgIds.length > 0) {
    const { error: markExpiredError, data: updatedRows } = await db
      .from('trial_subscriptions')
      .update({ status: 'expired', updated_at: new Date().toISOString() })
      .in('org_id', activeExpiredOrgIds)
      .eq('status', 'active')
      .select('org_id');

    if (markExpiredError) {
      console.warn('admin_bulk_email_mark_trial_expired_failed', markExpiredError.message);
    } else {
      updatedTrialsToExpired = ((updatedRows as Array<{ org_id: string }> | null) ?? []).length;
    }
  }

  let sent = 0;
  const failures: Array<{ orgId: string; email: string; error: string }> = [];
  const siteUrl = getPublicSiteUrl();

  await runWithConcurrency(jobs, 4, async (job) => {
    const endedAtLabel = formatArabicDate(job.endedAt);
    const text = TRIAL_EXPIRED_EMAIL_TEXT({
      recipientName: job.fullName,
      orgName: job.orgName,
      endedAtLabel,
      upgradeUrl: `${siteUrl}/upgrade`,
      supportEmail: SUPPORT_EMAIL,
    });
    const html = TRIAL_EXPIRED_EMAIL_HTML({
      recipientName: job.fullName,
      orgName: job.orgName,
      endedAtLabel,
      upgradeUrl: `${siteUrl}/upgrade`,
      supportEmail: SUPPORT_EMAIL,
    });

    try {
      await sendEmail({
        to: job.email,
        subject: TRIAL_EXPIRED_EMAIL_SUBJECT,
        text,
        html,
      });

      sent += 1;

      await recordTrialExpiredSend(db, featureState, {
        adminId,
        orgId: job.orgId,
        userId: job.userId,
        email: job.email,
        orgName: job.orgName,
        endedAt: job.endedAt,
        role: job.role,
        previouslySentExpired: job.previouslySentExpired,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown_error';
      failures.push({
        orgId: job.orgId,
        email: job.email,
        error: message,
      });

      await insertEmailLogBestEffort(db, {
        orgId: job.orgId,
        sentBy: adminId,
        toEmail: job.email,
        subject: TRIAL_EXPIRED_EMAIL_SUBJECT,
        template: TRIAL_EXPIRED_TEMPLATE,
        status: 'failed',
        error: message.slice(0, 240),
        meta: {
          campaign: 'trial_expired',
          role: job.role,
          ended_at: job.endedAt,
          reminder: job.previouslySentExpired,
          org_name: job.orgName,
        },
      });
    }
  });

  return {
    attempted: jobs.length,
    sent,
    failed: failures.length,
    failures: failures.slice(0, PREVIEW_LIMIT),
    updatedTrialsToExpired,
  };
}

async function recordTrialExpiredSend(
  db: ReturnType<typeof createSupabaseServerClient>,
  featureState: CampaignFeatureState,
  params: {
    adminId: string;
    orgId: string;
    userId: string;
    email: string;
    orgName: string;
    endedAt: string;
    role: string;
    previouslySentExpired: boolean;
  },
) {
  const eventType = params.previouslySentExpired ? TRIAL_EXPIRED_REMINDER_EVENT : TRIAL_EXPIRED_SENT_EVENT;
  await insertSubscriptionEventBestEffort(db, featureState, {
    org_id: params.orgId,
    type: eventType,
    meta: {
      to_email: params.email,
      recipient_user_id: params.userId,
      template: TRIAL_EXPIRED_TEMPLATE,
      subject: TRIAL_EXPIRED_EMAIL_SUBJECT,
      ends_at: params.endedAt,
      reminder: params.previouslySentExpired,
    },
  });

  await insertEmailLogBestEffort(db, {
    orgId: params.orgId,
    sentBy: params.adminId,
    toEmail: params.email,
    subject: TRIAL_EXPIRED_EMAIL_SUBJECT,
    template: TRIAL_EXPIRED_TEMPLATE,
    status: 'sent',
    meta: {
      campaign: 'trial_expired',
      role: params.role,
      ended_at: params.endedAt,
      reminder: params.previouslySentExpired,
      org_name: params.orgName,
    },
  });
}

async function buildAnnouncementPlan(
  db: ReturnType<typeof createSupabaseServerClient>,
  audience: AnnouncementAudience,
): Promise<AnnouncementPlan> {
  const [userRecipients, officeRecipients] = await Promise.all([
    audience === 'offices' ? Promise.resolve([] as AnnouncementRecipient[]) : loadAnnouncementUserRecipients(db),
    audience === 'users' ? Promise.resolve([] as AnnouncementRecipient[]) : loadAnnouncementOfficeRecipients(db),
  ]);

  const merged = mergeAnnouncementRecipients({
    users: userRecipients,
    offices: officeRecipients,
    audience,
  });

  return {
    jobs: merged,
    stats: {
      audience,
      recipients: merged.length,
      usersCount: userRecipients.length,
      officesCount: officeRecipients.length,
    },
    preview: merged.slice(0, PREVIEW_LIMIT).map((recipient) => ({
      email: recipient.email,
      fullName: recipient.fullName,
      orgName: recipient.orgName,
      source: recipient.source,
    })),
  };
}

async function sendAnnouncementCampaign(params: {
  db: ReturnType<typeof createSupabaseServerClient>;
  adminId: string;
  featureState: CampaignFeatureState;
  jobs: AnnouncementRecipient[];
  audience: AnnouncementAudience;
  subjectTemplate: string;
  messageTemplate: string;
}) {
  const { db, adminId, featureState, jobs, audience, subjectTemplate, messageTemplate } = params;
  if (!jobs.length) {
    return {
      attempted: 0,
      sent: 0,
      failed: 0,
      failures: [] as Array<{ email: string; error: string }>,
    };
  }

  const campaignId = `bulk-announcement-${Date.now()}`;
  let sent = 0;
  const failures: Array<{ email: string; error: string }> = [];

  await runWithConcurrency(jobs, 4, async (recipient) => {
    const subject = applyRecipientPlaceholders(subjectTemplate, recipient);
    const text = applyRecipientPlaceholders(messageTemplate, recipient);
    const html = buildRtlEmailHtmlFromText(text);

    try {
      await sendEmail({
        to: recipient.email,
        subject,
        text,
        html,
      });

      sent += 1;

      if (recipient.orgId) {
        await insertSubscriptionEventBestEffort(db, featureState, {
          org_id: recipient.orgId,
          type: ADMIN_ANNOUNCEMENT_EVENT,
          meta: {
            campaign_id: campaignId,
            to_email: recipient.email,
            source: recipient.source,
            audience,
            subject,
          },
        });
      }

      await insertEmailLogBestEffort(db, {
        orgId: recipient.orgId,
        sentBy: adminId,
        toEmail: recipient.email,
        subject,
        template: ADMIN_ANNOUNCEMENT_TEMPLATE,
        status: 'sent',
        meta: {
          campaign: 'announcement',
          campaign_id: campaignId,
          audience,
          source: recipient.source,
          org_name: recipient.orgName,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown_error';
      failures.push({ email: recipient.email, error: message });

      await insertEmailLogBestEffort(db, {
        orgId: recipient.orgId,
        sentBy: adminId,
        toEmail: recipient.email,
        subject,
        template: ADMIN_ANNOUNCEMENT_TEMPLATE,
        status: 'failed',
        error: message.slice(0, 240),
        meta: {
          campaign: 'announcement',
          campaign_id: campaignId,
          audience,
          source: recipient.source,
          org_name: recipient.orgName,
        },
      });
    }
  });

  return {
    attempted: jobs.length,
    sent,
    failed: failures.length,
    failures: failures.slice(0, PREVIEW_LIMIT),
  };
}

async function loadAnnouncementUserRecipients(
  db: ReturnType<typeof createSupabaseServerClient>,
): Promise<AnnouncementRecipient[]> {
  const users = await loadActiveUsers(db);
  if (!users.length) {
    return [];
  }

  const userIds = users.map((user) => user.id);
  const memberships = await loadMembershipsByUserIds(db, userIds);
  const userOrgMap = new Map<string, string>();

  for (const membership of memberships) {
    if (!membership.user_id || !membership.org_id) continue;
    if (!userOrgMap.has(membership.user_id)) {
      userOrgMap.set(membership.user_id, membership.org_id);
    }
  }

  const orgIds = [...new Set([...userOrgMap.values()])];
  const orgMap = await loadOrgNameMapByOrgIds(db, orgIds);

  const recipients: AnnouncementRecipient[] = [];
  for (const user of users) {
    const email = normalizeEmail(user.email);
    if (!email) continue;

    const orgId = userOrgMap.get(user.id) ?? null;
    recipients.push({
      email,
      fullName: normalizeFullName(user.full_name),
      orgId,
      orgName: orgId ? orgMap.get(orgId) ?? null : null,
      source: 'users',
    });
  }

  return recipients;
}

async function loadAnnouncementOfficeRecipients(
  db: ReturnType<typeof createSupabaseServerClient>,
): Promise<AnnouncementRecipient[]> {
  const { data: activeOrgData, error: activeOrgError } = await db
    .from('organizations')
    .select('id, name')
    .eq('status', 'active');

  if (activeOrgError) {
    throw new Error(`تعذر تحميل المكاتب النشطة: ${activeOrgError.message}`);
  }

  const activeOrgs = (activeOrgData as Array<{ id: string; name: string | null }> | null) ?? [];
  if (!activeOrgs.length) {
    return [];
  }

  const orgNameMap = new Map<string, string>();
  for (const org of activeOrgs) {
    orgNameMap.set(org.id, normalizeOrgName(org.name));
  }

  const orgIds = activeOrgs.map((org) => org.id);
  const memberships = await loadMembershipsByOrgIds(db, orgIds, ['owner', 'admin']);
  if (!memberships.length) {
    return [];
  }

  const userIds = [...new Set(memberships.map((membership) => membership.user_id).filter(Boolean))];
  const users = await loadUsersByUserIds(db, userIds);
  const userMap = new Map<string, UserRow>();
  for (const user of users) {
    userMap.set(user.id, user);
  }

  const officeContacts = new Map<string, AnnouncementRecipient>();

  const sortedMemberships = [...memberships].sort((left, right) => {
    if (left.org_id !== right.org_id) {
      return left.org_id.localeCompare(right.org_id);
    }
    return roleRank(left.role) - roleRank(right.role);
  });

  for (const membership of sortedMemberships) {
    if (officeContacts.has(membership.org_id)) {
      continue;
    }

    const user = userMap.get(membership.user_id);
    const email = normalizeEmail(user?.email);
    const status = String(user?.status ?? '').trim().toLowerCase();
    const emailVerified = Boolean(user?.email_verified);

    if (!email || status !== 'active' || !emailVerified) {
      continue;
    }

    officeContacts.set(membership.org_id, {
      email,
      fullName: normalizeFullName(user?.full_name),
      orgId: membership.org_id,
      orgName: orgNameMap.get(membership.org_id) ?? null,
      source: 'offices',
    });
  }

  return [...officeContacts.values()];
}

function mergeAnnouncementRecipients(params: {
  users: AnnouncementRecipient[];
  offices: AnnouncementRecipient[];
  audience: AnnouncementAudience;
}) {
  if (params.audience === 'users') {
    return dedupeAnnouncementRecipients(params.users);
  }
  if (params.audience === 'offices') {
    return dedupeAnnouncementRecipients(params.offices);
  }

  return dedupeAnnouncementRecipients([...params.offices, ...params.users]);
}

function dedupeAnnouncementRecipients(list: AnnouncementRecipient[]) {
  const deduped = new Map<string, AnnouncementRecipient>();

  for (const recipient of list) {
    const key = normalizeEmail(recipient.email);
    if (!key) continue;

    const existing = deduped.get(key);
    if (!existing) {
      deduped.set(key, { ...recipient, email: key });
      continue;
    }

    let source: AnnouncementSource = existing.source;
    if (existing.source !== recipient.source) {
      source = 'users_and_offices';
    }

    deduped.set(key, {
      ...existing,
      source,
      orgId: existing.orgId ?? recipient.orgId,
      orgName: existing.orgName ?? recipient.orgName,
      fullName: existing.fullName !== 'عميلنا الكريم' ? existing.fullName : recipient.fullName,
    });
  }

  return [...deduped.values()];
}

async function loadActivePaidOrgIds(
  db: ReturnType<typeof createSupabaseServerClient>,
  orgIds: string[],
  now: Date,
): Promise<Set<string>> {
  const active = new Set<string>();
  if (!orgIds.length) {
    return active;
  }

  const chunks = chunkArray(orgIds, 200);
  for (const chunk of chunks) {
    const { data, error } = await db
      .from('subscriptions')
      .select('org_id, status, current_period_end')
      .in('org_id', chunk);

    if (error) {
      if (isMissingTableError(error.message, 'subscriptions')) {
        return active;
      }
      console.warn('admin_bulk_email_load_subscriptions_failed', error.message);
      return active;
    }

    for (const row of ((data as SubscriptionRow[] | null) ?? [])) {
      const status = String(row.status ?? '').trim().toLowerCase();
      const periodEnd = row.current_period_end ? new Date(row.current_period_end) : null;
      const hasFuturePeriod =
        Boolean(periodEnd) && !Number.isNaN(periodEnd!.getTime()) && periodEnd!.getTime() > now.getTime();
      const activeStatus = status === 'active' || status === 'past_due' || status === 'canceled';

      if (activeStatus && hasFuturePeriod && row.org_id) {
        active.add(row.org_id);
      }
    }
  }

  return active;
}

async function loadPreviouslySentExpiredRecipients(
  db: ReturnType<typeof createSupabaseServerClient>,
  featureState: CampaignFeatureState,
  orgIds: string[],
) {
  const sent = new Set<string>();
  if (!orgIds.length) {
    return sent;
  }

  if (featureState.subscriptionEventsTableAvailable !== false) {
    const eventRows = await loadTrialEvents(db, orgIds);
    if (eventRows === null) {
      featureState.subscriptionEventsTableAvailable = false;
    } else {
      featureState.subscriptionEventsTableAvailable = true;
      for (const row of eventRows) {
        const email = normalizeEmail(String(row.meta?.to_email ?? ''));
        if (!row.org_id || !email) continue;
        sent.add(`${row.org_id}|${email}`);
      }
    }
  }

  const logRows = await loadTrialEmailLogRows(db, orgIds);
  for (const row of logRows) {
    const orgId = String(row.org_id ?? '').trim();
    const email = normalizeEmail(row.to_email);
    if (!orgId || !email) continue;
    sent.add(`${orgId}|${email}`);
  }

  return sent;
}

async function loadTrialEvents(
  db: ReturnType<typeof createSupabaseServerClient>,
  orgIds: string[],
): Promise<SubscriptionEventRow[] | null> {
  const rows: SubscriptionEventRow[] = [];
  const chunks = chunkArray(orgIds, 200);

  for (const chunk of chunks) {
    const { data, error } = await db
      .from('subscription_events')
      .select('org_id, type, meta')
      .in('org_id', chunk)
      .in('type', [TRIAL_EXPIRED_SENT_EVENT, TRIAL_EXPIRED_REMINDER_EVENT]);

    if (error) {
      if (isMissingTableError(error.message, 'subscription_events')) {
        return null;
      }
      console.warn('admin_bulk_email_load_trial_events_failed', error.message);
      return rows;
    }

    rows.push(...(((data as SubscriptionEventRow[] | null) ?? []).filter((row) => row.org_id)));
  }

  return rows;
}

async function loadTrialEmailLogRows(
  db: ReturnType<typeof createSupabaseServerClient>,
  orgIds: string[],
): Promise<EmailLogRow[]> {
  const rows: EmailLogRow[] = [];
  const chunks = chunkArray(orgIds, 200);

  for (const chunk of chunks) {
    const templateResult = await db
      .from('email_logs')
      .select('org_id, to_email')
      .in('org_id', chunk)
      .eq('template', TRIAL_EXPIRED_TEMPLATE)
      .eq('status', 'sent');

    if (!templateResult.error) {
      rows.push(...((templateResult.data as EmailLogRow[] | null) ?? []));
      continue;
    }

    if (isMissingTableError(templateResult.error.message, 'email_logs')) {
      return rows;
    }

    if (!isMissingColumnError(templateResult.error.message, 'template')) {
      console.warn('admin_bulk_email_load_email_logs_by_template_failed', templateResult.error.message);
      continue;
    }

    const emailTypeResult = await db
      .from('email_logs')
      .select('org_id, to_email')
      .in('org_id', chunk)
      .eq('email_type', TRIAL_EXPIRED_TEMPLATE)
      .eq('status', 'sent');

    if (emailTypeResult.error) {
      if (!isMissingColumnError(emailTypeResult.error.message, 'email_type')) {
        console.warn('admin_bulk_email_load_email_logs_by_email_type_failed', emailTypeResult.error.message);
      }
      continue;
    }

    rows.push(...((emailTypeResult.data as EmailLogRow[] | null) ?? []));
  }

  return rows;
}

async function insertSubscriptionEventBestEffort(
  db: ReturnType<typeof createSupabaseServerClient>,
  featureState: CampaignFeatureState,
  payload: {
    org_id: string;
    type: string;
    meta: Record<string, unknown>;
  },
) {
  if (!payload.org_id) {
    return;
  }

  if (featureState.subscriptionEventsTableAvailable === false) {
    return;
  }

  const { error } = await db.from('subscription_events').insert(payload);
  if (!error) {
    featureState.subscriptionEventsTableAvailable = true;
    return;
  }

  if (isMissingTableError(error.message, 'subscription_events')) {
    featureState.subscriptionEventsTableAvailable = false;
    return;
  }

  console.warn('admin_bulk_email_insert_subscription_event_failed', error.message);
}

async function insertEmailLogBestEffort(
  db: ReturnType<typeof createSupabaseServerClient>,
  payload: {
    orgId: string | null;
    sentBy: string;
    toEmail: string;
    subject: string;
    template: string;
    status: 'sent' | 'failed';
    meta: Record<string, unknown>;
    error?: string;
  },
) {
  if (!payload.orgId) {
    return;
  }

  const baseRecord = {
    org_id: payload.orgId,
    sent_by: payload.sentBy,
    to_email: payload.toEmail,
    subject: payload.subject,
    meta: payload.meta,
    status: payload.status,
    error: payload.error ?? null,
  };

  const candidates: Array<Record<string, unknown>> = [
    { ...baseRecord, template: payload.template, email_type: payload.template },
    { ...baseRecord, template: payload.template },
    { ...baseRecord, email_type: payload.template },
  ];

  for (const candidate of candidates) {
    const { error } = await db.from('email_logs').insert(candidate);
    if (!error) {
      return;
    }

    if (isMissingTableError(error.message, 'email_logs')) {
      return;
    }

    const recoverableSchemaError =
      isMissingColumnError(error.message, 'template') ||
      isMissingColumnError(error.message, 'email_type') ||
      isNotNullColumnError(error.message, 'template') ||
      isNotNullColumnError(error.message, 'email_type');

    if (recoverableSchemaError) {
      continue;
    }

    console.warn('admin_bulk_email_insert_email_log_failed', error.message);
    return;
  }
}

async function loadActiveUsers(db: ReturnType<typeof createSupabaseServerClient>) {
  const users: UserRow[] = [];
  const pageSize = 1000;
  let from = 0;

  while (true) {
    const { data, error } = await db
      .from('app_users')
      .select('id, email, full_name, status, email_verified, created_at')
      .eq('status', 'active')
      .eq('email_verified', true)
      .order('created_at', { ascending: false })
      .range(from, from + pageSize - 1);

    if (error) {
      throw new Error(`تعذر تحميل المستخدمين النشطين: ${error.message}`);
    }

    const rows = ((data as UserRow[] | null) ?? []).filter((row) => row.id);
    users.push(...rows);

    if (rows.length < pageSize) {
      break;
    }

    from += pageSize;
  }

  return users;
}

async function loadOrgNameMapByOrgIds(
  db: ReturnType<typeof createSupabaseServerClient>,
  orgIds: string[],
) {
  const orgMap = new Map<string, string>();
  if (!orgIds.length) {
    return orgMap;
  }

  for (const chunk of chunkArray(orgIds, 200)) {
    const { data, error } = await db.from('organizations').select('id, name').in('id', chunk);
    if (error) {
      throw new Error(`تعذر تحميل بيانات المكاتب: ${error.message}`);
    }

    for (const org of ((data as OrgRow[] | null) ?? [])) {
      orgMap.set(org.id, normalizeOrgName(org.name));
    }
  }

  return orgMap;
}

async function loadMembershipsByOrgIds(
  db: ReturnType<typeof createSupabaseServerClient>,
  orgIds: string[],
  roles?: string[],
) {
  const memberships: MembershipRow[] = [];
  if (!orgIds.length) {
    return memberships;
  }

  for (const chunk of chunkArray(orgIds, 200)) {
    let query = db.from('memberships').select('org_id, user_id, role').in('org_id', chunk);
    if (roles && roles.length > 0) {
      query = query.in('role', roles);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(`تعذر تحميل عضويات المكاتب: ${error.message}`);
    }

    memberships.push(...(((data as MembershipRow[] | null) ?? []).filter((row) => row.org_id && row.user_id)));
  }

  return memberships;
}

async function loadMembershipsByUserIds(
  db: ReturnType<typeof createSupabaseServerClient>,
  userIds: string[],
) {
  const memberships: MembershipRow[] = [];
  if (!userIds.length) {
    return memberships;
  }

  for (const chunk of chunkArray(userIds, 200)) {
    const { data, error } = await db
      .from('memberships')
      .select('org_id, user_id, role')
      .in('user_id', chunk);

    if (error) {
      throw new Error(`تعذر تحميل عضويات المستخدمين: ${error.message}`);
    }

    memberships.push(...(((data as MembershipRow[] | null) ?? []).filter((row) => row.org_id && row.user_id)));
  }

  return memberships;
}

async function loadUsersByUserIds(
  db: ReturnType<typeof createSupabaseServerClient>,
  userIds: string[],
) {
  const users: UserRow[] = [];
  if (!userIds.length) {
    return users;
  }

  for (const chunk of chunkArray(userIds, 200)) {
    const { data, error } = await db
      .from('app_users')
      .select('id, email, full_name, status, email_verified')
      .in('id', chunk);

    if (error) {
      throw new Error(`تعذر تحميل بيانات المستخدمين: ${error.message}`);
    }

    users.push(...(((data as UserRow[] | null) ?? []).filter((row) => row.id)));
  }

  return users;
}

function applyRecipientPlaceholders(template: string, recipient: AnnouncementRecipient) {
  const replacements: Record<string, string> = {
    '{{name}}': recipient.fullName,
    '{{full_name}}': recipient.fullName,
    '{{office_name}}': recipient.orgName ?? 'مكتبكم',
    '{{org_name}}': recipient.orgName ?? 'مكتبكم',
    '{{email}}': recipient.email,
  };

  let output = template;
  for (const [key, value] of Object.entries(replacements)) {
    output = output.split(key).join(value);
  }

  return output.trim();
}

function buildBatchWindow(params: {
  total: number;
  mode: CampaignSendMode;
  batchIndex?: number;
  batchSize?: number;
}): BatchWindow {
  const total = Math.max(0, Math.floor(params.total));
  if (params.mode === 'send') {
    return {
      mode: 'send',
      batchIndex: 0,
      batchSize: total || DEFAULT_BATCH_SIZE,
      start: 0,
      end: total,
      total,
      hasMore: false,
      nextBatchIndex: null,
    };
  }

  const batchSize = clampPositiveInteger(params.batchSize ?? DEFAULT_BATCH_SIZE, MIN_BATCH_SIZE, MAX_BATCH_SIZE);
  const batchIndex = Math.max(0, Math.floor(params.batchIndex ?? 0));
  const start = Math.min(total, batchIndex * batchSize);
  const end = Math.min(total, start + batchSize);
  const hasMore = end < total;

  return {
    mode: 'send_batch',
    batchIndex,
    batchSize,
    start,
    end,
    total,
    hasMore,
    nextBatchIndex: hasMore ? batchIndex + 1 : null,
  };
}

async function runWithConcurrency<T>(
  list: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<void>,
) {
  if (!list.length) {
    return;
  }

  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, list.length) }, async () => {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= list.length) {
        break;
      }
      await worker(list[index], index);
    }
  });

  await Promise.all(workers);
}

function clampPositiveInteger(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  const normalized = Math.floor(value);
  if (normalized < min) return min;
  if (normalized > max) return max;
  return normalized;
}

function normalizeEmail(value: string | null | undefined) {
  return String(value ?? '').trim().toLowerCase();
}

function normalizeFullName(value: string | null | undefined) {
  return String(value ?? '').trim() || 'عميلنا الكريم';
}

function normalizeOrgName(value: string | null | undefined) {
  return String(value ?? '').trim() || 'مسار المحامي';
}

function formatArabicDate(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;

  return new Intl.DateTimeFormat('ar-SA', { dateStyle: 'long' }).format(parsed);
}

function roleRank(role: string | null | undefined) {
  if (role === 'owner') return 0;
  if (role === 'admin') return 1;
  if (role === 'lawyer') return 2;
  return 3;
}

function chunkArray<T>(values: T[], size: number) {
  if (!values.length) return [];
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

function isMissingTableError(message: string, tableName: string) {
  const normalized = message.toLowerCase();
  const tableToken = `public.${tableName}`.toLowerCase();
  return (
    normalized.includes(tableToken) &&
    (normalized.includes('could not find the table') || normalized.includes('does not exist') || normalized.includes('relation'))
  );
}

function isMissingColumnError(message: string, columnName: string) {
  const normalized = message.toLowerCase();
  const exactToken = `column "${columnName}"`.toLowerCase();
  const qualifiedToken = `column ${columnName}`.toLowerCase();
  const schemaCacheToken = `could not find the '${columnName}' column`.toLowerCase();
  return (
    (normalized.includes(exactToken) || normalized.includes(qualifiedToken) || normalized.includes(schemaCacheToken)) &&
    (normalized.includes('does not exist') || normalized.includes('schema cache') || normalized.includes('could not find'))
  );
}

function isNotNullColumnError(message: string, columnName: string) {
  const normalized = message.toLowerCase();
  return normalized.includes(`null value in column "${columnName}"`.toLowerCase()) && normalized.includes('violates not-null');
}
