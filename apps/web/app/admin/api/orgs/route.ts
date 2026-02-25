import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * GET /admin/api/orgs — list all orgs with plan/status/member count
 * PATCH /admin/api/orgs — suspend/activate an org
 */
export async function GET(request: NextRequest) {
    try {
        await requireAdmin();
    } catch {
        return NextResponse.json({ error: 'غير مصرح.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query')?.trim() || '';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    const offset = (page - 1) * limit;

    const adminClient = createSupabaseServerClient();

    let dbQuery = adminClient
        .from('organizations')
        .select(`
      id, name, status, created_at,
      memberships ( id ),
      org_subscriptions ( plan, status, payment_status, current_period_end ),
      trial_subscriptions ( ends_at, status )
    `, { count: 'exact' });

    if (query) {
        dbQuery = dbQuery.ilike('name', `%${query}%`);
    }

    const { data: orgs, error, count } = await dbQuery
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Map to include member count
    const mapped = (orgs ?? []).map((org: any) => {
        const sub = Array.isArray(org.org_subscriptions) ? org.org_subscriptions[0] : org.org_subscriptions;
        const trial = Array.isArray(org.trial_subscriptions) ? org.trial_subscriptions[0] : org.trial_subscriptions;
        return {
            id: org.id,
            name: org.name,
            status: org.status,
            created_at: org.created_at,
            members_count: Array.isArray(org.memberships) ? org.memberships.length : 0,
            subscription: sub ?? null,
            trial: trial ?? null,
        };
    });

    return NextResponse.json({
        orgs: mapped,
        total_count: count ?? 0,
        page,
        limit
    });
}

export async function PATCH(request: NextRequest) {
    let adminId: string;
    try {
        adminId = await requireAdmin();
    } catch {
        return NextResponse.json({ error: 'غير مصرح.' }, { status: 403 });
    }

    const body = await request.json();
    const { org_id, org_ids, action, extra_data } = body as {
        org_id?: string;
        org_ids?: string[];
        action: 'suspend' | 'activate' | 'grant_lifetime' | 'extend_trial' | 'set_expiry' | 'activate_paid' | 'set_plan';
        extra_data?: any;
    };

    const targetIds = org_ids || (org_id ? [org_id] : []);

    if (targetIds.length === 0 || !action) {
        return NextResponse.json({ error: 'بيانات غير صالحة.' }, { status: 400 });
    }

    const adminClient = createSupabaseServerClient();

    if (action === 'suspend' || action === 'activate') {
        const newStatus = action === 'suspend' ? 'suspended' : 'active';

        const { error: orgError } = await adminClient
            .from('organizations')
            .update({ status: newStatus })
            .in('id', targetIds);

        if (orgError) {
            return NextResponse.json({ error: orgError.message }, { status: 500 });
        }

        const auditLogs = targetIds.map(id => ({
            org_id: id,
            user_id: adminId,
            action: action === 'suspend' ? 'org_suspended' : 'org_activated',
            entity_type: 'organization',
            entity_id: id,
            meta: { bulk: true }
        }));
        await adminClient.from('audit_logs').insert(auditLogs);

        return NextResponse.json({ success: true, status: newStatus, count: targetIds.length });
    }

    // Single-only actions fallback for now (can expand later if needed)
    if (targetIds.length > 1) {
        return NextResponse.json({ error: 'هذا الإجراء غير مدعوم للمعالجة المجمعة حالياً.' }, { status: 400 });
    }
    const singleOrgId = targetIds[0];

    if (action === 'grant_lifetime') {
        // Add lifetime subscription
        const now = new Date();
        const lifetimeEnd = new Date(now.getFullYear() + 100, now.getMonth(), now.getDate());

        const { error: subError } = await adminClient
            .from('org_subscriptions')
            .upsert({
                org_id: singleOrgId,
                status: 'active',
                plan: 'ENTERPRISE', // Assuming lifetime grants enterprise
                payment_status: 'paid',
                current_period_start: now.toISOString(),
                current_period_end: lifetimeEnd.toISOString(),
                updated_at: now.toISOString()
            }, { onConflict: 'org_id' });

        if (subError) {
            return NextResponse.json({ error: subError.message }, { status: 500 });
        }

        await adminClient.from('audit_logs').insert({
            org_id: singleOrgId,
            user_id: adminId,
            action: 'subscription_updated',
            entity_type: 'org_subscriptions',
            entity_id: singleOrgId,
            meta: { plan: 'ENTERPRISE' }
        });

        return NextResponse.json({ success: true });
    }

    if (action === 'extend_trial') {
        const { data: orgData } = await adminClient
            .from('organizations')
            .select('trial_ends_at')
            .eq('id', singleOrgId)
            .single();

        let baseDate = orgData?.trial_ends_at ? new Date(orgData.trial_ends_at) : new Date();
        if (baseDate < new Date()) baseDate = new Date(); // Start from today if expired

        baseDate.setDate(baseDate.getDate() + 14);

        const { error } = await adminClient
            .from('organizations')
            .update({ trial_ends_at: baseDate.toISOString() })
            .eq('id', singleOrgId);

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        await adminClient.from('audit_logs').insert({
            org_id: singleOrgId,
            user_id: adminId,
            action: 'trial_extended',
            entity_type: 'organization',
            entity_id: singleOrgId,
            meta: { days: 14 }
        });

        return NextResponse.json({ success: true });
    }

    if (action === 'set_expiry' && extra_data?.date) {
        // Add custom expiry active subscription
        const now = new Date();
        const end = new Date(extra_data.date);

        const { error: subError } = await adminClient
            .from('org_subscriptions')
            .upsert({
                org_id: singleOrgId,
                status: 'active',
                plan: 'BUSINESS', // default fallback
                payment_status: 'paid',
                current_period_start: now.toISOString(),
                current_period_end: end.toISOString(),
                updated_at: now.toISOString()
            }, { onConflict: 'org_id' });

        if (subError) {
            return NextResponse.json({ error: subError.message }, { status: 500 });
        }

        await adminClient.from('audit_logs').insert({
            org_id: singleOrgId,
            user_id: adminId,
            action: 'subscription_updated',
            entity_type: 'org_subscriptions',
            entity_id: singleOrgId,
            meta: { plan: 'BUSINESS', ends_at: end.toISOString() }
        });

        return NextResponse.json({ success: true });
    }

    if (action === 'activate_paid') {
        // Add 1 month paid subscription
        const now = new Date();
        const endsAt = new Date(now);
        const months = parseInt(extra_data?.months || '12', 10);
        endsAt.setMonth(endsAt.getMonth() + months);

        const { error: subError } = await adminClient
            .from('org_subscriptions')
            .upsert({
                org_id: singleOrgId,
                status: 'active',
                plan: 'BUSINESS', // default fallback
                payment_status: 'paid',
                current_period_start: now.toISOString(),
                current_period_end: endsAt.toISOString(),
                updated_at: now.toISOString()
            }, { onConflict: 'org_id' });

        if (subError) {
            return NextResponse.json({ error: subError.message }, { status: 500 });
        }

        await adminClient.from('audit_logs').insert({
            org_id: singleOrgId,
            user_id: adminId,
            action: 'subscription_updated',
            entity_type: 'org_subscriptions',
            entity_id: singleOrgId,
            meta: { plan: 'BUSINESS', duration_months: months }
        });

        return NextResponse.json({ success: true });
    }

    if (action === 'set_plan' && extra_data?.plan) {
        const now = new Date();
        let endsAt = new Date(now);
        endsAt.setFullYear(endsAt.getFullYear() + 1); // default 1 year expiry for manually set plans if no existing sub

        // Get existing sub period end to preserve it
        const { data: existingSub } = await adminClient.from('org_subscriptions').select('current_period_end').eq('org_id', singleOrgId).maybeSingle();
        if (existingSub?.current_period_end) {
            endsAt = new Date(existingSub.current_period_end);
        }

        const { error: subError } = await adminClient
            .from('org_subscriptions')
            .upsert({
                org_id: singleOrgId,
                status: 'active',
                plan: extra_data.plan,
                payment_status: 'paid',
                current_period_start: now.toISOString(),
                current_period_end: endsAt.toISOString(),
                updated_at: now.toISOString()
            }, { onConflict: 'org_id' });

        if (subError) {
            return NextResponse.json({ error: subError.message }, { status: 500 });
        }

        await adminClient.from('audit_logs').insert({
            org_id: singleOrgId,
            user_id: adminId,
            action: 'subscription_plan_changed',
            entity_type: 'org_subscriptions',
            entity_id: singleOrgId,
            meta: { plan: extra_data.plan }
        });

        return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'إجراء غير معروف.' }, { status: 400 });
}
