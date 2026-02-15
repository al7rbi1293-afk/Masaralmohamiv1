import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { sendTrialDay12Reminder, sendTrialExpiredEmail } from '@/lib/transactional';
import { logError, logInfo, logWarn } from '@/lib/logger';

// Vercel Cron: runs daily at 08:00 UTC
// Configured via vercel.json crons

type TrialRow = {
    org_id: string;
    ends_at: string;
    status: string;
};

type MemberRow = {
    user_id: string;
};

type ProfileRow = {
    user_id: string;
    full_name: string;
};

type UserRow = {
    id: string;
    email: string;
};

type EmailLogRow = {
    org_id: string;
    type: string;
};

export async function GET(request: Request) {
    // Verify cron secret if set (optional security for Vercel Cron)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminClient = createSupabaseServerClient();
    const now = new Date();
    const twoDaysFromNow = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);

    let reminders = 0;
    let expired = 0;

    try {
        // 1. Find trials ending within 2 days (reminder)
        const { data: soonExpiring, error: soonError } = await adminClient
            .from('trial_subscriptions')
            .select('org_id, ends_at, status')
            .eq('status', 'active')
            .lte('ends_at', twoDaysFromNow.toISOString())
            .gt('ends_at', now.toISOString());

        if (soonError) {
            logError('cron_trial_check_failed', { phase: 'fetch_soon_expiring', error: soonError.message });
        } else if (soonExpiring && soonExpiring.length > 0) {
            for (const trial of soonExpiring as TrialRow[]) {
                const sent = await hasEmailBeenSent(adminClient, trial.org_id, 'trial_reminder');
                if (!sent) {
                    const userInfo = await getOrgOwnerInfo(adminClient, trial.org_id);
                    if (userInfo) {
                        const daysLeft = Math.max(1, Math.ceil((new Date(trial.ends_at).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
                        try {
                            await sendTrialDay12Reminder({
                                to: userInfo.email,
                                fullName: userInfo.fullName,
                                daysLeft,
                            });
                            await logEmailSent(adminClient, trial.org_id, userInfo.userId, 'trial_reminder');
                            reminders++;
                        } catch (err) {
                            logError('cron_email_failed', { type: 'trial_reminder', orgId: trial.org_id, error: String(err) });
                        }
                    }
                }
            }
        }

        // 2. Find expired trials
        const { data: expiredTrials, error: expiredError } = await adminClient
            .from('trial_subscriptions')
            .select('org_id, ends_at, status')
            .eq('status', 'active')
            .lte('ends_at', now.toISOString());

        if (expiredError) {
            logError('cron_trial_check_failed', { phase: 'fetch_expired', error: expiredError.message });
        } else if (expiredTrials && expiredTrials.length > 0) {
            for (const trial of expiredTrials as TrialRow[]) {
                // Mark as expired
                await adminClient
                    .from('trial_subscriptions')
                    .update({ status: 'expired', updated_at: now.toISOString() })
                    .eq('org_id', trial.org_id);

                const sent = await hasEmailBeenSent(adminClient, trial.org_id, 'trial_expired');
                if (!sent) {
                    const userInfo = await getOrgOwnerInfo(adminClient, trial.org_id);
                    if (userInfo) {
                        try {
                            await sendTrialExpiredEmail({
                                to: userInfo.email,
                                fullName: userInfo.fullName,
                            });
                            await logEmailSent(adminClient, trial.org_id, userInfo.userId, 'trial_expired');
                            expired++;
                        } catch (err) {
                            logError('cron_email_failed', { type: 'trial_expired', orgId: trial.org_id, error: String(err) });
                        }
                    }
                }
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
        timestamp: now.toISOString(),
    });
}

async function getOrgOwnerInfo(
    client: ReturnType<typeof createSupabaseServerClient>,
    orgId: string,
): Promise<{ email: string; fullName: string; userId: string } | null> {
    const { data: memberData } = await client
        .from('memberships')
        .select('user_id')
        .eq('org_id', orgId)
        .eq('role', 'owner')
        .limit(1)
        .maybeSingle();

    const member = memberData as MemberRow | null;
    if (!member?.user_id) return null;

    const { data: profileData } = await client
        .from('profiles')
        .select('user_id, full_name')
        .eq('user_id', member.user_id)
        .maybeSingle();

    const profile = profileData as ProfileRow | null;

    const { data: userData } = await client.auth.admin.getUserById(member.user_id);
    const user = userData?.user as UserRow | undefined;
    if (!user?.email) {
        logWarn('cron_no_user_email', { orgId, userId: member.user_id });
        return null;
    }

    return {
        email: user.email,
        fullName: profile?.full_name || 'عميل',
        userId: member.user_id,
    };
}

async function hasEmailBeenSent(
    client: ReturnType<typeof createSupabaseServerClient>,
    orgId: string,
    type: string,
): Promise<boolean> {
    const { data } = await client
        .from('email_logs')
        .select('org_id, type')
        .eq('org_id', orgId)
        .eq('type', type)
        .limit(1)
        .maybeSingle();

    return !!(data as EmailLogRow | null);
}

async function logEmailSent(
    client: ReturnType<typeof createSupabaseServerClient>,
    orgId: string,
    userId: string,
    type: string,
) {
    await client.from('email_logs').insert({
        org_id: orgId,
        user_id: userId,
        type,
        meta: {},
    });
}
