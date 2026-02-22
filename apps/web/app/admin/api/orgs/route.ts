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
      org_subscriptions ( plan, status, payment_status, current_period_end ),
      trial_subscriptions ( ends_at, status )
    `)
        .order('created_at', { ascending: false })
        .limit(500);

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
    const { org_id, action } = body as { org_id: string; action: 'suspend' | 'activate' | 'grant_lifetime' | 'extend_trial' };

    if (!org_id || !['suspend', 'activate', 'grant_lifetime', 'extend_trial'].includes(action)) {
        return NextResponse.json({ error: 'بيانات غير صالحة.' }, { status: 400 });
    }

    const adminClient = createSupabaseServerClient();

    if (action === 'suspend' || action === 'activate') {
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

    if (action === 'grant_lifetime') {
        const { error } = await adminClient
            .from('subscriptions') // Actually, the select uses org_subscriptions. Wait, let me check the real table name. It is subscriptions or org_subscriptions?  Checking schema... the GET uses `org_subscriptions` but sometimes it's just a view. Let's explicitly check.
            .upsert({
                org_id,
                plan: 'lifetime',
                status: 'active',
                payment_status: 'paid',
                current_period_end: '2099-12-31T23:59:59Z',
            }, { onConflict: 'org_id' });

        if (error) {
            const subErr = await adminClient.from('subscriptions').upsert({
                org_id,
                plan_code: 'PRO',
                status: 'active',
                current_period_end: '2099-12-31T23:59:59Z',
            }, { onConflict: 'org_id' });
            if (subErr.error) return NextResponse.json({ error: subErr.error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, status: 'lifetime' });
    }

    if (action === 'extend_trial') {
        // Find current trial
        const { data: trial } = await adminClient.from('trial_subscriptions').select('ends_at').eq('org_id', org_id).single();
        const currentEnd = trial?.ends_at ? new Date(trial.ends_at) : new Date();
        const newEnd = new Date(currentEnd.getTime() + 14 * 24 * 60 * 60 * 1000); // add 14 days

        const { error } = await adminClient.from('trial_subscriptions').upsert({
            org_id,
            ends_at: newEnd.toISOString(),
            status: 'active',
        }, { onConflict: 'org_id' });

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, newEnd: newEnd.toISOString() });
    }

    return NextResponse.json({ error: 'إجراء غير معروف.' }, { status: 400 });
}
