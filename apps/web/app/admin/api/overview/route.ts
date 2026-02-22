import { NextResponse } from 'next/server';
import { createSupabaseServerRlsClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin';

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
        const { count: activeSubscriptionsCount, error: activeSubsError } = await supabase
            .from('subscriptions')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'active');

        // Estimate trials by checking orgs without an active subscription
        const trialsCount = (activeOrgsCount || 0) - (activeSubscriptionsCount || 0);

        if (activeSubsError) {
            console.error('Error fetching subscription stats:', activeSubsError);
            throw new Error('فشل جلب إحصائيات الاشتراكات.');
        }

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

        return NextResponse.json({
            stats: {
                activeOrgs: activeOrgsCount || 0,
                suspendedOrgs: suspendedOrgsCount || 0,
                activeUsers: activeUsersCount || 0,
                suspendedUsers: suspendedUsersCount || 0,
                activeSubscriptions: activeSubscriptionsCount || 0,
                trialOrgs: Math.max(0, trialsCount),
            },
            timeline
        });

    } catch (error: any) {
        console.error('Overview API error:', error);
        return NextResponse.json(
            { error: error.message || 'حدث خطأ داخلي' },
            { status: 500 }
        );
    }
}
