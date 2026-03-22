import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { sendTrialDay12Reminder, sendTrialExpiredEmail } from '@/lib/transactional';
import { logError, logInfo, logWarn } from '@/lib/logger';

// Vercel Cron: runs daily at 08:00 UTC
// Configured via vercel.json crons

const TRIAL_REMINDER_TEMPLATE = 'trial_reminder';
const TRIAL_EXPIRED_TEMPLATE = 'trial_expired';
const TRIAL_REMINDER_EVENT = 'trial.reminder.sent';
const TRIAL_EXPIRED_EVENT = 'trial.expired.sent';

type TrialRow = {
    org_id: string;
    ends_at: string;
    status: string;
};

type MembershipRow = {
    user_id: string;
    role: string;
};

type AppUserRow = {
    id: string;
    email: string;
    full_name: string;
    status: string;
};

type TrialRecipient = {
    userId: string;
    email: string;
    fullName: string;
    role: string;
};

export async function GET(request: Request) {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminClient = createSupabaseServerClient();
    const now = new Date();
    const nowIso = now.toISOString();
    const twoDaysFromNow = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString();

    let reminders = 0;
    let expired = 0;

    try {
        const { data: soonExpiring, error: soonError } = await adminClient
            .from('trial_subscriptions')
            .select('org_id, ends_at, status')
            .eq('status', 'active')
            .lte('ends_at', twoDaysFromNow)
            .gt('ends_at', nowIso);

        if (soonError) {
            logError('cron_trial_check_failed', { phase: 'fetch_soon_expiring', error: soonError.message });
        } else {
            for (const trial of ((soonExpiring as TrialRow[] | null) ?? [])) {
                reminders += await sendTrialEmailsForOrg({
                    client: adminClient,
                    trial,
                    template: TRIAL_REMINDER_TEMPLATE,
                    eventType: TRIAL_REMINDER_EVENT,
                    now,
                });
            }
        }

        const { data: expiredTrials, error: expiredError } = await adminClient
            .from('trial_subscriptions')
            .select('org_id, ends_at, status')
            .eq('status', 'active')
            .lte('ends_at', nowIso);

        if (expiredError) {
            logError('cron_trial_check_failed', { phase: 'fetch_expired', error: expiredError.message });
        } else {
            for (const trial of ((expiredTrials as TrialRow[] | null) ?? [])) {
                const { error: updateError } = await adminClient
                    .from('trial_subscriptions')
                    .update({ status: 'expired', updated_at: nowIso })
                    .eq('org_id', trial.org_id);

                if (updateError) {
                    logError('cron_trial_mark_expired_failed', {
                        orgId: trial.org_id,
                        error: updateError.message,
                    });
                }

                expired += await sendTrialEmailsForOrg({
                    client: adminClient,
                    trial,
                    template: TRIAL_EXPIRED_TEMPLATE,
                    eventType: TRIAL_EXPIRED_EVENT,
                    now,
                });
            }
        }
    } catch (error) {
        logError('cron_trial_check_failed', { phase: 'top_level', error: String(error) });
        return NextResponse.json({ ok: false, error: 'Internal error' }, { status: 500 });
    }

    logInfo('cron_trial_check_completed', { reminders, expired });

    return NextResponse.json({
        ok: true,
        reminders,
        expired,
        timestamp: nowIso,
    });
}

async function sendTrialEmailsForOrg(params: {
    client: ReturnType<typeof createSupabaseServerClient>;
    trial: TrialRow;
    template: typeof TRIAL_REMINDER_TEMPLATE | typeof TRIAL_EXPIRED_TEMPLATE;
    eventType: typeof TRIAL_REMINDER_EVENT | typeof TRIAL_EXPIRED_EVENT;
    now: Date;
}) {
    const { orgName, recipients } = await getTrialNotificationContext(params.client, params.trial.org_id);
    if (!recipients.length) {
        logWarn('cron_trial_notification_skipped', {
            orgId: params.trial.org_id,
            template: params.template,
            reason: 'no_recipients',
        });
        return 0;
    }

    let sentCount = 0;

    for (const recipient of recipients) {
        const alreadySent = await hasNotificationEventBeenRecorded(
            params.client,
            params.trial.org_id,
            params.eventType,
            recipient.email,
        );

        if (alreadySent) {
            continue;
        }

        try {
            const result =
                params.template === TRIAL_REMINDER_TEMPLATE
                    ? await sendTrialDay12Reminder({
                          to: recipient.email,
                          fullName: recipient.fullName,
                          daysLeft: calculateDaysLeft(params.trial.ends_at, params.now),
                          orgName,
                          endsAt: params.trial.ends_at,
                      })
                    : await sendTrialExpiredEmail({
                          to: recipient.email,
                          fullName: recipient.fullName,
                          orgName,
                          endedAt: params.trial.ends_at,
                      });

            if (!result.sent) {
                continue;
            }

            await recordNotificationEvent(params.client, {
                orgId: params.trial.org_id,
                eventType: params.eventType,
                toEmail: recipient.email,
                recipientUserId: recipient.userId,
                template: params.template,
                subject: result.subject,
                endsAt: params.trial.ends_at,
                daysLeft:
                    params.template === TRIAL_REMINDER_TEMPLATE
                        ? calculateDaysLeft(params.trial.ends_at, params.now)
                        : null,
            });

            await insertEmailLogBestEffort(params.client, {
                orgId: params.trial.org_id,
                sentBy: recipient.userId,
                toEmail: recipient.email,
                subject: result.subject,
                template: params.template,
                meta: {
                    automated: true,
                    org_name: orgName,
                    role: recipient.role,
                    ends_at: params.trial.ends_at,
                    days_left:
                        params.template === TRIAL_REMINDER_TEMPLATE
                            ? calculateDaysLeft(params.trial.ends_at, params.now)
                            : null,
                },
            });

            sentCount += 1;
        } catch (error) {
            logError('cron_email_failed', {
                type: params.template,
                orgId: params.trial.org_id,
                to: recipient.email,
                error: String(error),
            });
        }
    }

    return sentCount;
}

async function getTrialNotificationContext(
    client: ReturnType<typeof createSupabaseServerClient>,
    orgId: string,
): Promise<{ orgName: string; recipients: TrialRecipient[] }> {
    const [{ data: orgData, error: orgError }, { data: membershipData, error: membershipError }] = await Promise.all([
        client.from('organizations').select('name').eq('id', orgId).maybeSingle(),
        client.from('memberships').select('user_id, role').eq('org_id', orgId),
    ]);

    if (orgError) {
        throw orgError;
    }

    if (membershipError) {
        throw membershipError;
    }

    const memberships = ((membershipData as MembershipRow[] | null) ?? []).filter((row) => row.user_id);
    if (!memberships.length) {
        return {
            orgName: normalizeOrgName((orgData as { name?: string | null } | null)?.name),
            recipients: [],
        };
    }

    const orderedMemberships = [...memberships].sort((left, right) => roleRank(left.role) - roleRank(right.role));
    const userIds = [...new Set(orderedMemberships.map((membership) => membership.user_id))];

    const { data: userData, error: userError } = await client
        .from('app_users')
        .select('id, email, full_name, status')
        .in('id', userIds);

    if (userError) {
        throw userError;
    }

    const userMap = new Map<string, AppUserRow>();
    for (const user of (userData as AppUserRow[] | null) ?? []) {
        userMap.set(user.id, user);
    }

    const recipientsByEmail = new Map<string, TrialRecipient>();

    for (const membership of orderedMemberships) {
        const user = userMap.get(membership.user_id);
        const email = String(user?.email ?? '').trim().toLowerCase();
        const status = String(user?.status ?? '').trim().toLowerCase();
        if (!email || status !== 'active') {
            continue;
        }

        if (!recipientsByEmail.has(email)) {
            recipientsByEmail.set(email, {
                userId: membership.user_id,
                email,
                fullName: String(user?.full_name ?? '').trim() || 'عميلنا الكريم',
                role: membership.role,
            });
        }
    }

    return {
        orgName: normalizeOrgName((orgData as { name?: string | null } | null)?.name),
        recipients: [...recipientsByEmail.values()],
    };
}

async function hasNotificationEventBeenRecorded(
    client: ReturnType<typeof createSupabaseServerClient>,
    orgId: string,
    eventType: string,
    toEmail: string,
) {
    const { data, error } = await client
        .from('subscription_events')
        .select('id')
        .eq('org_id', orgId)
        .eq('type', eventType)
        .contains('meta', { to_email: toEmail })
        .limit(1);

    if (error) {
        logWarn('cron_trial_notification_dedupe_failed', {
            orgId,
            eventType,
            to: toEmail,
            error: error.message,
        });
        return false;
    }

    return ((data as Array<{ id: string }> | null) ?? []).length > 0;
}

async function recordNotificationEvent(
    client: ReturnType<typeof createSupabaseServerClient>,
    params: {
        orgId: string;
        eventType: string;
        toEmail: string;
        recipientUserId: string;
        template: string;
        subject: string;
        endsAt: string;
        daysLeft: number | null;
    },
) {
    const { error } = await client.from('subscription_events').insert({
        org_id: params.orgId,
        type: params.eventType,
        meta: {
            to_email: params.toEmail,
            recipient_user_id: params.recipientUserId,
            template: params.template,
            subject: params.subject,
            ends_at: params.endsAt,
            days_left: params.daysLeft,
        },
    });

    if (error) {
        throw error;
    }
}

async function insertEmailLogBestEffort(
    client: ReturnType<typeof createSupabaseServerClient>,
    params: {
        orgId: string;
        sentBy: string;
        toEmail: string;
        subject: string;
        template: string;
        meta: Record<string, unknown>;
    },
) {
    const { error } = await client.from('email_logs').insert({
        org_id: params.orgId,
        sent_by: params.sentBy,
        to_email: params.toEmail,
        subject: params.subject,
        template: params.template,
        meta: params.meta,
        status: 'sent',
    });

    if (error) {
        logWarn('cron_trial_email_log_failed', {
            orgId: params.orgId,
            template: params.template,
            to: params.toEmail,
            error: error.message,
        });
    }
}

function calculateDaysLeft(endsAt: string, now: Date) {
    const msRemaining = new Date(endsAt).getTime() - now.getTime();
    return Math.max(1, Math.ceil(msRemaining / (1000 * 60 * 60 * 24)));
}

function normalizeOrgName(value: string | null | undefined) {
    return value?.trim() || 'مسار المحامي';
}

function roleRank(role: string) {
    if (role === 'owner') return 0;
    if (role === 'lawyer') return 1;
    return 2;
}
