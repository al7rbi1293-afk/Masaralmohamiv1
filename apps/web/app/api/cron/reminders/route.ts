import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { logInfo, logError } from '@/lib/logger';
import { processCalendarReminderJob, type NotificationJobRecord } from '@/lib/calendar-reminders';

export const dynamic = 'force-dynamic';

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
            logError('reminder_failed', {
                job_id: job.id,
                error: err instanceof Error ? err.message : 'unknown',
            });

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
        timestamp: now,
    });
}
