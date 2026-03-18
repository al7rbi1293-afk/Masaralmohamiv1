import 'server-only';
import { normalizePlanCode } from '@/lib/billing/plans';
import { createSupabaseServerRlsClient } from './supabase/server';

export const SUBSCRIPTION_PLANS = {
    SOLO: { maxUsers: 1, label: 'محامي مستقل' },
    SMALL_OFFICE: { maxUsers: 5, label: 'مكتب صغير' },
    MEDIUM_OFFICE: { maxUsers: 10, label: 'مكتب متوسط' },
    ENTERPRISE: { maxUsers: Infinity, label: 'نسخة الشركات' },
};

/**
 * Get the active plan for an organization, considering trial or subscription.
 */
export async function getActivePlan(orgId: string): Promise<keyof typeof SUBSCRIPTION_PLANS | null> {
    const supabase = createSupabaseServerRlsClient();

    // Check paid subscription first
    const { data: sub } = await supabase
        .from('subscriptions')
        .select('plan_code, status')
        .eq('org_id', orgId)
        .in('status', ['trial', 'active', 'past_due', 'canceled'])
        .maybeSingle();

    const normalizedSubscriptionPlan = normalizeSupportedPlan((sub as { plan_code?: string | null } | null)?.plan_code);
    if (normalizedSubscriptionPlan) {
        return normalizedSubscriptionPlan;
    }

    const { data: legacySub } = await supabase
        .from('org_subscriptions')
        .select('plan, status')
        .eq('org_id', orgId)
        .in('status', ['trial', 'active'])
        .maybeSingle();

    const normalizedLegacyPlan = normalizeSupportedPlan((legacySub as { plan?: string | null } | null)?.plan);
    if (normalizedLegacyPlan) {
        return normalizedLegacyPlan;
    }

    // Fallback to check if trial is active
    const { data: trial } = await supabase
        .from('trial_subscriptions')
        .select('status')
        .eq('org_id', orgId)
        .eq('status', 'active')
        .maybeSingle();

    if (trial) {
        // Trial keeps access on the standard edition only and does not expose enterprise features.
        return 'SMALL_OFFICE';
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

function normalizeSupportedPlan(rawPlan: string | null | undefined): keyof typeof SUBSCRIPTION_PLANS | null {
    const normalized = normalizePlanCode(rawPlan, 'TRIAL');
    if (normalized === 'TRIAL' || !(normalized in SUBSCRIPTION_PLANS)) {
        return null;
    }

    return normalized as keyof typeof SUBSCRIPTION_PLANS;
}
