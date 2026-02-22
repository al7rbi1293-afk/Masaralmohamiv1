import 'server-only';
import { createSupabaseServerRlsClient } from './supabase/server';

export const SUBSCRIPTION_PLANS = {
    SOLO: { maxUsers: 1, label: 'محامي مستقل' },
    TEAM: { maxUsers: 5, label: 'مكتب صغير' },
    BUSINESS: { maxUsers: 25, label: 'مكتب متوسط' },
    ENTERPRISE: { maxUsers: Infinity, label: 'مكتب كبير' },
};

/**
 * Get the active plan for an organization, considering trial or subscription.
 */
export async function getActivePlan(orgId: string): Promise<keyof typeof SUBSCRIPTION_PLANS | null> {
    const supabase = createSupabaseServerRlsClient();

    // Check paid subscription first
    const { data: sub } = await supabase
        .from('org_subscriptions')
        .select('plan, status')
        .eq('org_id', orgId)
        .in('status', ['active', 'past_due'])
        .maybeSingle();

    if (sub && sub.plan && sub.plan in SUBSCRIPTION_PLANS) {
        return sub.plan as keyof typeof SUBSCRIPTION_PLANS;
    }

    // Fallback to check if trial is active
    const { data: trial } = await supabase
        .from('trial_subscriptions')
        .select('status')
        .eq('org_id', orgId)
        .eq('status', 'active')
        .maybeSingle();

    if (trial) {
        // By default, trial gives the features of the SOLO plan unless you want it to be higher. Let's give them TEAM (up to 5) for trying.
        return 'TEAM';
    }

    return null;
}

/**
 * Calculate if an organization can add more members.
 */
export async function canAddMoreMembers(orgId: string): Promise<boolean> {
    const supabase = createSupabaseServerRlsClient();

    const activePlanKey = await getActivePlan(orgId);
    if (!activePlanKey) return false;

    const limit = SUBSCRIPTION_PLANS[activePlanKey].maxUsers;
    if (limit === Infinity) return true;

    const { count, error } = await supabase
        .from('memberships')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId);

    if (error) return false;

    return (count ?? 0) < limit;
}
