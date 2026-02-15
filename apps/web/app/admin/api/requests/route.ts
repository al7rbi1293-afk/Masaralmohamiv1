import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * GET /admin/api/requests — list subscription requests (admin only)
 * PATCH /admin/api/requests — approve or reject a request (admin only)
 */
export async function GET() {
    try {
        await requireAdmin();
    } catch {
        return NextResponse.json({ error: 'غير مصرح.' }, { status: 403 });
    }

    const adminClient = createSupabaseServerClient();

    const { data, error } = await adminClient
        .from('subscription_requests')
        .select(`
      *,
      organizations:org_id ( id, name ),
      profiles:requester_user_id ( full_name )
    `)
        .order('requested_at', { ascending: false })
        .limit(200);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ requests: data ?? [] });
}

export async function PATCH(request: NextRequest) {
    let adminId: string;
    try {
        adminId = await requireAdmin();
    } catch {
        return NextResponse.json({ error: 'غير مصرح.' }, { status: 403 });
    }

    const body = await request.json();
    const { id, action, notes } = body as {
        id: string;
        action: 'approve' | 'reject';
        notes?: string;
    };

    if (!id || !['approve', 'reject'].includes(action)) {
        return NextResponse.json({ error: 'بيانات غير صالحة.' }, { status: 400 });
    }

    const adminClient = createSupabaseServerClient();
    const now = new Date().toISOString();

    // Fetch the request
    const { data: req, error: fetchErr } = await adminClient
        .from('subscription_requests')
        .select('*')
        .eq('id', id)
        .single();

    if (fetchErr || !req) {
        return NextResponse.json({ error: 'الطلب غير موجود.' }, { status: 404 });
    }

    const typed = req as any;

    if (action === 'approve') {
        // Update request status
        await adminClient
            .from('subscription_requests')
            .update({
                status: 'approved',
                decided_at: now,
                decided_by: adminId,
                notes: notes || null,
            })
            .eq('id', id);

        // Calculate period end
        const periodStart = new Date();
        const periodEnd = new Date();
        periodEnd.setMonth(periodEnd.getMonth() + (typed.duration_months || 1));

        // Upsert org_subscriptions
        await adminClient
            .from('org_subscriptions')
            .upsert(
                {
                    org_id: typed.org_id,
                    status: 'active',
                    plan: typed.plan_requested,
                    payment_status: 'paid',
                    current_period_start: periodStart.toISOString(),
                    current_period_end: periodEnd.toISOString(),
                    last_payment_ref: typed.payment_reference || null,
                    updated_at: now,
                },
                { onConflict: 'org_id' },
            );

        // Audit log
        await adminClient.from('audit_logs').insert({
            org_id: typed.org_id,
            user_id: adminId,
            action: 'subscription_approved',
            entity_type: 'subscription_request',
            entity_id: id,
            meta: { plan: typed.plan_requested, duration_months: typed.duration_months },
        });
    } else {
        // Reject
        await adminClient
            .from('subscription_requests')
            .update({
                status: 'rejected',
                decided_at: now,
                decided_by: adminId,
                notes: notes || null,
            })
            .eq('id', id);

        // Audit log
        await adminClient.from('audit_logs').insert({
            org_id: typed.org_id,
            user_id: adminId,
            action: 'subscription_rejected',
            entity_type: 'subscription_request',
            entity_id: id,
            meta: { notes: notes || '' },
        });
    }

    return NextResponse.json({ success: true });
}
