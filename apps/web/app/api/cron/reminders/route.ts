import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { logInfo, logError } from '@/lib/logger';

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

    for (const job of jobs ?? []) {
        try {
            // For now, log the reminder (email sending can use transactional.ts)
            // In production, this would send email/push notification
            logInfo('reminder_processed', {
                job_id: job.id,
                type: job.type,
                payload: job.payload,
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
