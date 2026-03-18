import { NextResponse } from 'next/server';
import { createSupabaseServerRlsClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin';

export const dynamic = 'force-dynamic';

type OverviewOrgRow = {
    id: string;
    name: string | null;
    status: string | null;
    memberships: Array<{ id: string }> | null;
};

export async function GET() {
    try {
        await requireAdmin();
        const supabase = createSupabaseServerRlsClient();

        // 1. Fetch Organization Stats
        const { count: activeOrgsCount, error: activeOrgsError } = await supabase
            .from('organizations')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'active');

        const { count: suspendedOrgsCount, error: suspendedOrgsError } = await supabase
            .from('organizations')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'suspended');

        if (activeOrgsError || suspendedOrgsError) {
            console.error('Error fetching org stats:', activeOrgsError || suspendedOrgsError);
            throw new Error('فشل جلب إحصائيات المكاتب.');
        }

        // 2. Fetch User Stats
        const { count: activeUsersCount, error: activeUsersError } = await supabase
            .from('app_users')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'active');

        const { count: suspendedUsersCount, error: suspendedUsersError } = await supabase
            .from('app_users')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'suspended');

        if (activeUsersError || suspendedUsersError) {
            console.error('Error fetching user stats:', activeUsersError || suspendedUsersError);
            throw new Error('فشل جلب إحصائيات المستخدمين.');
        }

        // 3. Subscription Stats (Active vs Trial)
        const { data: activeSubscriptions, error: activeSubsError } = await supabase
            .from('subscriptions')
            .select(`
                id,
                plan_code,
                current_period_end,
                organizations ( name ),
                plan:plans!plan_code ( name_ar )
            `)
            .eq('status', 'active');

        if (activeSubsError) {
            console.error('Error fetching subscription stats:', activeSubsError);
            throw new Error('فشل جلب إحصائيات الاشتراكات.');
        }

        const activeSubscriptionsCount = activeSubscriptions?.length || 0;
        const subscriptionDetails = (activeSubscriptions || []).map(sub => ({
            id: sub.id,
            plan_name: (sub.plan as any)?.name_ar || sub.plan_code,
            org_name: (sub.organizations as any)?.name || '—',
            current_period_end: sub.current_period_end
        }));

        // Estimate trials by checking orgs without an active subscription
        const trialsCount = (activeOrgsCount || 0) - activeSubscriptionsCount;

        // 4. Trailing 30-day Signup Timeline
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const { data: recentOrgs, error: recentOrgsError } = await supabase
            .from('organizations')
            .select('created_at')
            .gte('created_at', thirtyDaysAgo.toISOString())
            .order('created_at', { ascending: true });

        if (recentOrgsError) {
            console.error('Error fetching timeline stats:', recentOrgsError);
            throw new Error('فشل جلب إحصائيات الجدول الزمني.');
        }

        // Group by day for the chart
        const timelineRaw: Record<string, number> = {};
        for (let i = 0; i < 30; i++) {
            const date = new Date(thirtyDaysAgo);
            date.setDate(date.getDate() + i + 1);
            const dateStr = date.toISOString().split('T')[0];
            timelineRaw[dateStr!] = 0;
        }

        recentOrgs?.forEach((org) => {
            const dateStr = org.created_at.split('T')[0];
            if (dateStr && timelineRaw[dateStr] !== undefined) {
                timelineRaw[dateStr]++;
            }
        });

        const timeline = Object.entries(timelineRaw).map(([date, new_signups]) => ({
            date,
            new_signups
        }));

        // 5. Team size per office (admin-only visibility)
        const { data: orgRows, error: orgRowsError } = await supabase
            .from('organizations')
            .select('id, name, status, memberships ( id )')
            .order('name', { ascending: true });

        if (orgRowsError) {
            console.error('Error fetching office team sizes:', orgRowsError);
            throw new Error('فشل جلب أحجام فرق المكاتب.');
        }

        const orgTeamSizes = ((orgRows as OverviewOrgRow[] | null) ?? []).map((org) => ({
            id: org.id,
            name: org.name || '—',
            status: org.status || 'active',
            members_count: Array.isArray(org.memberships) ? org.memberships.length : 0,
        }));

        return NextResponse.json({
            stats: {
                activeOrgs: activeOrgsCount || 0,
                suspendedOrgs: suspendedOrgsCount || 0,
                activeUsers: activeUsersCount || 0,
                suspendedUsers: suspendedUsersCount || 0,
                activeSubscriptions: activeSubscriptionsCount,
                trialOrgs: Math.max(0, trialsCount),
            },
            subscription_details: subscriptionDetails,
            timeline,
            org_team_sizes: orgTeamSizes,
        });

    } catch (error: any) {
        console.error('Overview API error:', error);
        return NextResponse.json(
            { error: error.message || 'حدث خطأ داخلي' },
            { status: 500 }
        );
    }
}
