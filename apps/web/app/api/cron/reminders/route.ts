import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { logInfo, logError } from '@/lib/logger';
import { processCalendarReminderJob, type NotificationJobRecord } from '@/lib/calendar-reminders';

export const dynamic = 'force-dynamic';
const RETRY_DELAY_MINUTES = 15;

/**
 * GET /api/cron/reminders
 * Vercel Cron: processes queued notification_jobs where run_at <= now.
 */
export async function GET(request: Request) {
    // Optional CRON_SECRET check
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
        const authHeader = request.headers.get('authorization');
        if (authHeader !== `Bearer ${cronSecret}`) {
            return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
        }
    }

    const adminClient = createSupabaseServerClient();
    const now = new Date().toISOString();

    // Fetch queued jobs due now
    const { data: jobs, error } = await adminClient
        .from('notification_jobs')
        .select('*')
        .eq('status', 'queued')
        .lte('run_at', now)
        .order('run_at', { ascending: true })
        .limit(100);

    if (error) {
        logError('reminders_fetch_error', { error: error.message });
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    let processed = 0;
    let failed = 0;
    let retried = 0;

    for (const job of (jobs as NotificationJobRecord[] | null) ?? []) {
        try {
            const result = await processCalendarReminderJob(adminClient, job);
            logInfo('reminder_processed', {
                job_id: job.id,
                type: job.type,
                recipients: result.recipients,
                skipped: result.skipped,
            });

            await adminClient
                .from('notification_jobs')
                .update({ status: 'sent' })
                .eq('id', job.id);

            processed++;
        } catch (err) {
            const message = err instanceof Error ? err.message : 'unknown';
            logError('reminder_failed', {
                job_id: job.id,
                error: message,
            });

            if (shouldRetryReminder(message)) {
                const nextRunAt = new Date(Date.now() + RETRY_DELAY_MINUTES * 60 * 1000).toISOString();
                await adminClient
                    .from('notification_jobs')
                    .update({ status: 'queued', run_at: nextRunAt })
                    .eq('id', job.id);
                retried++;
                continue;
            }

            await adminClient
                .from('notification_jobs')
                .update({ status: 'failed' })
                .eq('id', job.id);

            failed++;
        }
    }

    return NextResponse.json({
        ok: true,
        processed,
        failed,
        retried,
        timestamp: now,
    });
}

function shouldRetryReminder(message: string) {
    const normalized = message.toLowerCase();
    return (
        normalized.includes('smtp_not_configured') ||
        normalized.includes('etimedout') ||
        normalized.includes('econnrefused') ||
        normalized.includes('econnreset') ||
        normalized.includes('ehostunreach') ||
        normalized.includes('eai_again') ||
        normalized.includes('too many connections')
    );
}
