import 'server-only';
import { resolveEffectivePlanCode, type CanonicalPlanCode } from '@/lib/billing/plans';
import { createSupabaseServerRlsClient } from './supabase/server';

type SubscriptionPlanConfig = {
    maxUsers: number;
    label: string;
};

export const SUBSCRIPTION_PLANS: Record<CanonicalPlanCode, SubscriptionPlanConfig> = {
    TRIAL: { maxUsers: Infinity, label: 'تجربة' },
    SOLO: { maxUsers: 1, label: 'محامي مستقل' },
    SMALL_OFFICE: { maxUsers: 5, label: 'مكتب صغير' },
    MEDIUM_OFFICE: { maxUsers: 10, label: 'مكتب متوسط' },
    ENTERPRISE: { maxUsers: Infinity, label: 'نسخة الشركات' },
};

/**
 * Get the active plan for an organization, considering trial or subscription.
 */
export async function getActivePlan(orgId: string): Promise<CanonicalPlanCode | null> {
    const supabase = createSupabaseServerRlsClient();

    const [subscriptionRes, legacyRes, trialRes] = await Promise.all([
        supabase
            .from('subscriptions')
            .select('plan_code, status')
            .eq('org_id', orgId)
            .in('status', ['trial', 'active', 'past_due', 'canceled'])
            .maybeSingle(),
        supabase
            .from('org_subscriptions')
            .select('plan, status')
            .eq('org_id', orgId)
            .in('status', ['trial', 'active'])
            .maybeSingle(),
        supabase
            .from('trial_subscriptions')
            .select('status')
            .eq('org_id', orgId)
            .eq('status', 'active')
            .maybeSingle(),
    ]);

    return resolveEffectivePlanCode({
        subscriptionPlan: (subscriptionRes.data as { plan_code?: string | null } | null)?.plan_code,
        subscriptionStatus: (subscriptionRes.data as { status?: string | null } | null)?.status,
        legacyPlan: (legacyRes.data as { plan?: string | null } | null)?.plan,
        legacyStatus: (legacyRes.data as { status?: string | null } | null)?.status,
        hasActiveTrial: Boolean(trialRes.data),
    });
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
