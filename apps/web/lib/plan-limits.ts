/**
 * Plan limits configuration and enforcement helpers.
 * Sales-led upgrade model — no Stripe integration.
 */
import 'server-only';

import { createSupabaseServerRlsClient } from '@/lib/supabase/server';

export type PlanCode = 'TRIAL' | 'SOLO' | 'TEAM' | 'BUSINESS' | 'ENTERPRISE';

type PlanLimits = {
    max_users: number;
    max_matters: number;
    max_storage_mb: number;
    templates_enabled: boolean;
    email_integration: boolean;
    calendar_enabled: boolean;
};

export const PLAN_LIMITS: Record<PlanCode, PlanLimits> = {
    TRIAL: {
        max_users: 2,
        max_matters: 10,
        max_storage_mb: 100,
        templates_enabled: true,
        email_integration: false,
        calendar_enabled: true,
    },
    SOLO: {
        max_users: 1,
        max_matters: 50,
        max_storage_mb: 500,
        templates_enabled: true,
        email_integration: true,
        calendar_enabled: true,
    },
    TEAM: {
        max_users: 5,
        max_matters: 200,
        max_storage_mb: 2000,
        templates_enabled: true,
        email_integration: true,
        calendar_enabled: true,
    },
    BUSINESS: {
        max_users: 20,
        max_matters: 1000,
        max_storage_mb: 10000,
        templates_enabled: true,
        email_integration: true,
        calendar_enabled: true,
    },
    ENTERPRISE: {
        max_users: 999,
        max_matters: 99999,
        max_storage_mb: 100000,
        templates_enabled: true,
        email_integration: true,
        calendar_enabled: true,
    },
};

/**
 * Get the plan limits for an org based on its subscription.
 * Falls back to TRIAL if no subscription found.
 */
export async function getOrgPlanLimits(orgId: string): Promise<{ plan: PlanCode; limits: PlanLimits }> {
    const supabase = createSupabaseServerRlsClient();

    const { data } = await supabase
        .from('org_subscriptions')
        .select('plan')
        .eq('org_id', orgId)
        .eq('status', 'active')
        .single();

    const plan = (data?.plan as PlanCode) || 'TRIAL';
    return { plan, limits: PLAN_LIMITS[plan] || PLAN_LIMITS.TRIAL };
}

/**
 * Get current org usage counts.
 */
export async function getOrgUsage(orgId: string) {
    const supabase = createSupabaseServerRlsClient();

    const [usersRes, mattersRes] = await Promise.all([
        supabase.from('memberships').select('id', { count: 'exact', head: true }).eq('org_id', orgId),
        supabase.from('matters').select('id', { count: 'exact', head: true }).eq('org_id', orgId),
    ]);

    return {
        users_count: usersRes.count ?? 0,
        matters_count: mattersRes.count ?? 0,
        storage_mb: 0, // TODO: Calculate from storage bucket
    };
}

export type LimitCheckResult =
    | { allowed: true }
    | { allowed: false; reason: string; limit: number; current: number };

/**
 * Check if the org can add another user.
 */
export async function checkUserLimit(orgId: string): Promise<LimitCheckResult> {
    const { limits } = await getOrgPlanLimits(orgId);
    const usage = await getOrgUsage(orgId);

    if (usage.users_count >= limits.max_users) {
        return {
            allowed: false,
            reason: 'تم الوصول إلى الحد الأقصى لعدد المستخدمين.',
            limit: limits.max_users,
            current: usage.users_count,
        };
    }
    return { allowed: true };
}

/**
 * Check if the org can create another matter.
 */
export async function checkMatterLimit(orgId: string): Promise<LimitCheckResult> {
    const { limits } = await getOrgPlanLimits(orgId);
    const usage = await getOrgUsage(orgId);

    if (usage.matters_count >= limits.max_matters) {
        return {
            allowed: false,
            reason: 'تم الوصول إلى الحد الأقصى لعدد القضايا.',
            limit: limits.max_matters,
            current: usage.matters_count,
        };
    }
    return { allowed: true };
}

/**
 * Check if a feature is enabled for the org's plan.
 */
export async function checkFeature(orgId: string, feature: 'email_integration' | 'calendar_enabled' | 'templates_enabled'): Promise<LimitCheckResult> {
    const { limits } = await getOrgPlanLimits(orgId);

    if (!limits[feature]) {
        return {
            allowed: false,
            reason: 'هذه الميزة غير متاحة في خطتك الحالية.',
            limit: 0,
            current: 0,
        };
    }
    return { allowed: true };
}
