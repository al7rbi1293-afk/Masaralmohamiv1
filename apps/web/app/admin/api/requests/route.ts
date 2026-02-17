import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * GET /admin/api/requests — list admin-facing requests (admin only)
 * PATCH /admin/api/requests — approve or reject a request (admin only)
 */
export async function GET() {
    try {
        await requireAdmin();
    } catch {
        return NextResponse.json({ error: 'غير مصرح.' }, { status: 403 });
    }

    const adminClient = createSupabaseServerClient();

    // Avoid PostgREST embedded relations here to prevent schema-cache edge cases in production.
    // We resolve requester/org names with follow-up queries instead.
    const { data: subscriptionRequestsRaw, error: subscriptionError } = await adminClient
        .from('subscription_requests')
        .select(
            'id, org_id, requester_user_id, plan_requested, duration_months, payment_method, payment_reference, proof_file_path, status, notes, requested_at, decided_at, decided_by',
        )
        .order('requested_at', { ascending: false })
        .limit(200);

    if (subscriptionError) {
        return NextResponse.json({ error: subscriptionError.message }, { status: 500 });
    }

    const subscriptionRows = (subscriptionRequestsRaw as Array<{ org_id: string; requester_user_id?: string | null }> | null) ?? [];

    const requesterUserIds = Array.from(new Set(subscriptionRows
        .map((row) => row.requester_user_id)
        .filter((value): value is string => Boolean(value))));

    const orgIds = Array.from(new Set(subscriptionRows
        .map((row) => row.org_id)
        .filter((value): value is string => Boolean(value))));

    const requesterNamesByUserId = new Map<string, string>();
    const orgNamesByOrgId = new Map<string, { id: string; name: string }>();

    if (requesterUserIds.length || orgIds.length) {
        const [
            { data: requesterProfiles, error: requesterProfilesError },
            { data: organizationsRaw, error: organizationsError },
        ] = await Promise.all([
            requesterUserIds.length
                ? adminClient
                    .from('profiles')
                    .select('user_id, full_name')
                    .in('user_id', requesterUserIds)
                : Promise.resolve({ data: [], error: null } as any),
            orgIds.length
                ? adminClient
                    .from('organizations')
                    .select('id, name')
                    .in('id', orgIds)
                : Promise.resolve({ data: [], error: null } as any),
        ]);

        if (requesterProfilesError) {
            return NextResponse.json({ error: requesterProfilesError.message }, { status: 500 });
        }

        if (organizationsError) {
            return NextResponse.json({ error: organizationsError.message }, { status: 500 });
        }

        for (const profile of (requesterProfiles as Array<{ user_id: string; full_name: string | null }> | null) ?? []) {
            requesterNamesByUserId.set(profile.user_id, profile.full_name ?? '');
        }

        for (const org of (organizationsRaw as Array<{ id: string; name: string }> | null) ?? []) {
            orgNamesByOrgId.set(org.id, { id: org.id, name: org.name });
        }
    }

    const subscriptionRequests = (subscriptionRows as Array<any>).map((row) => ({
        ...row,
        requester_name: row.requester_user_id ? requesterNamesByUserId.get(row.requester_user_id) ?? null : null,
        organizations: orgNamesByOrgId.get(row.org_id) ?? null,
    }));

    const { data: fullVersionRequests, error: fullVersionError } = await adminClient
        .from('full_version_requests')
        .select('id, created_at, org_id, user_id, full_name, email, phone, firm_name, message, source, type')
        .order('created_at', { ascending: false })
        .limit(200);

    if (fullVersionError) {
        return NextResponse.json({ error: fullVersionError.message }, { status: 500 });
    }

    const { data: leads, error: leadsError } = await adminClient
        .from('leads')
        .select('id, created_at, full_name, email, phone, firm_name, topic, message, referrer, utm')
        .order('created_at', { ascending: false })
        .limit(200);

    if (leadsError) {
        return NextResponse.json({ error: leadsError.message }, { status: 500 });
    }

    return NextResponse.json({
        requests: subscriptionRequests ?? [],
        fullVersionRequests: fullVersionRequests ?? [],
        leads: leads ?? [],
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
