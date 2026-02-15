import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * GET /admin/api/orgs — list all orgs with plan/status/member count
 * PATCH /admin/api/orgs — suspend/activate an org
 */
export async function GET() {
    try {
        await requireAdmin();
    } catch {
        return NextResponse.json({ error: 'غير مصرح.' }, { status: 403 });
    }

    const adminClient = createSupabaseServerClient();

    const { data: orgs, error } = await adminClient
        .from('organizations')
        .select(`
      id, name, status, created_at,
      memberships ( id ),
      org_subscriptions ( plan, status, payment_status, current_period_end )
    `)
        .order('created_at', { ascending: false })
        .limit(500);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Map to include member count
    const mapped = (orgs ?? []).map((org: any) => ({
        id: org.id,
        name: org.name,
        status: org.status,
        created_at: org.created_at,
        members_count: Array.isArray(org.memberships) ? org.memberships.length : 0,
        subscription: Array.isArray(org.org_subscriptions) ? org.org_subscriptions[0] ?? null : org.org_subscriptions,
    }));

    return NextResponse.json({ orgs: mapped });
}

export async function PATCH(request: NextRequest) {
    let adminId: string;
    try {
        adminId = await requireAdmin();
    } catch {
        return NextResponse.json({ error: 'غير مصرح.' }, { status: 403 });
    }

    const body = await request.json();
    const { org_id, action } = body as { org_id: string; action: 'suspend' | 'activate' };

    if (!org_id || !['suspend', 'activate'].includes(action)) {
        return NextResponse.json({ error: 'بيانات غير صالحة.' }, { status: 400 });
    }

    const adminClient = createSupabaseServerClient();
    const newStatus = action === 'suspend' ? 'suspended' : 'active';

    const { error } = await adminClient
        .from('organizations')
        .update({ status: newStatus })
        .eq('id', org_id);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await adminClient.from('audit_logs').insert({
        org_id,
        user_id: adminId,
        action: action === 'suspend' ? 'org_suspended' : 'org_activated',
        entity_type: 'organization',
        entity_id: org_id,
        meta: {},
    });

    return NextResponse.json({ success: true, status: newStatus });
}
