import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAuthUser } from '@/lib/supabase/auth-session';
import { requireOrgIdForUser } from '@/lib/org';
import { createSupabaseServerRlsClient } from '@/lib/supabase/server';

/**
 * GET /api/reports
 * Returns management dashboard data for the org.
 */
export async function GET(_request: NextRequest) {
    const user = await getCurrentAuthUser();
    if (!user) return NextResponse.json({ message: 'يرجى تسجيل الدخول.' }, { status: 401 });

    let orgId: string;
    try { orgId = await requireOrgIdForUser(); } catch {
        return NextResponse.json({ message: 'لا يوجد مكتب مفعّل.' }, { status: 403 });
    }

    const supabase = createSupabaseServerRlsClient();

    const now = new Date();
    const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
        openMattersRes,
        upcomingEventsRes,
        overdueTasksRes,
        docsGeneratedRes,
        leadSourcesRes,
        totalClientsRes,
    ] = await Promise.all([
        // Open matters count
        supabase
            .from('matters')
            .select('id', { count: 'exact', head: true })
            .eq('org_id', orgId)
            .eq('status', 'active'),

        // Upcoming events next 7 days
        supabase
            .from('calendar_events')
            .select('id, title, start_at, matter_id')
            .eq('org_id', orgId)
            .gte('start_at', now.toISOString())
            .lt('start_at', sevenDaysLater.toISOString())
            .order('start_at', { ascending: true })
            .limit(20),

        // Overdue tasks
        supabase
            .from('tasks')
            .select('id, title, due_at, matter_id')
            .eq('org_id', orgId)
            .neq('status', 'done')
            .lt('due_at', now.toISOString())
            .order('due_at', { ascending: true })
            .limit(20),

        // Docs generated this month
        supabase
            .from('doc_generations')
            .select('id', { count: 'exact', head: true })
            .eq('org_id', orgId)
            .eq('status', 'exported')
            .gte('created_at', monthStart.toISOString()),

        // Lead sources summary (utm_source)
        supabase
            .from('leads')
            .select('utm')
            .not('utm', 'is', null)
            .limit(500),

        // Total clients
        supabase
            .from('clients')
            .select('id', { count: 'exact', head: true })
            .eq('org_id', orgId),
    ]);

    // Aggregate lead sources
    const sourceMap = new Map<string, number>();
    for (const lead of leadSourcesRes.data ?? []) {
        const utm = lead.utm as Record<string, string> | null;
        const source = utm?.source || 'direct';
        sourceMap.set(source, (sourceMap.get(source) || 0) + 1);
    }
    const leadSources = Array.from(sourceMap.entries()).map(([source, count]) => ({ source, count }));

    return NextResponse.json({
        open_matters: openMattersRes.count ?? 0,
        upcoming_events: upcomingEventsRes.data ?? [],
        overdue_tasks: overdueTasksRes.data ?? [],
        docs_generated_this_month: docsGeneratedRes.count ?? 0,
        lead_sources: leadSources,
        total_clients: totalClientsRes.count ?? 0,
    });
}
