import 'server-only';

import { normalizePlanCode } from '@/lib/billing/plans';
import { createSupabaseServerRlsClient, createSupabaseServerClient } from '@/lib/supabase/server';
import { requireOrgIdForUser } from '@/lib/org';
import { getCurrentAuthUser } from '@/lib/supabase/auth-session';

export type PaymentRequestStatus = 'pending' | 'approved' | 'rejected';
export type PaymentMethod = 'bank_transfer' | 'credit_card' | 'apple_pay' | 'mada';

export type PaymentRequest = {
    id: string;
    org_id: string;
    user_id: string | null;
    amount: number;
    currency: string;
    plan_code: string;
    billing_period: 'monthly' | 'yearly';
    method: PaymentMethod;
    status: PaymentRequestStatus;
    proof_url: string | null;
    bank_reference: string | null;
    created_at: string;
    reviewed_at: string | null;
    reviewed_by: string | null;
    review_note: string | null;
};

export async function createPaymentRequest(params: {
    amount: number;
    plan_code: string;
    billing_period: 'monthly' | 'yearly';
    proof_url?: string;
    bank_reference?: string;
}) {
    const orgId = await requireOrgIdForUser();
    const user = await getCurrentAuthUser();
    if (!user) throw new Error('Unauthorized');

    const supabase = createSupabaseServerRlsClient();
    const normalizedPlanCode = normalizePlanCode(params.plan_code, 'TRIAL');
    if (normalizedPlanCode === 'TRIAL') {
        throw new Error('Invalid plan code');
    }

    const basePayload = {
        org_id: orgId,
        amount: params.amount,
        plan_code: normalizedPlanCode,
        billing_period: params.billing_period,
        method: 'bank_transfer',
        status: 'pending',
        proof_url: params.proof_url ?? null,
        bank_reference: params.bank_reference ?? null,
    };

    let { data, error } = await supabase
        .from('payment_requests')
        .insert({
            ...basePayload,
            user_id: user.id,
        })
        .select()
        .single();

    // Backward compatibility: some DBs still reference auth.users for payment_requests.user_id.
    // In that case we retry with NULL user_id so the request is still captured.
    if (error && isUserIdForeignKeyError(error.message)) {
        ({ data, error } = await supabase
            .from('payment_requests')
            .insert({
                ...basePayload,
                user_id: null,
            })
            .select()
            .single());
    }

    if (error) throw error;
    return data as PaymentRequest;
}

function isUserIdForeignKeyError(message?: string) {
    const normalized = String(message ?? '').toLowerCase();
    return (
        normalized.includes('payment_requests_user_id_fkey') ||
        (normalized.includes('foreign key') && normalized.includes('user_id'))
    );
}

export async function listPendingPaymentRequests() {
    // restricted to admins - usually using service role or specific RLS
    const supabase = createSupabaseServerClient(); // Service Role

    const { data, error } = await supabase
        .from('payment_requests')
        .select('*, organization:organizations(name), user:app_users!payment_requests_user_id_fkey(email, full_name)')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
}

export async function approvePaymentRequest(requestId: string, adminUserId: string) {
    const supabase = createSupabaseServerClient(); // Service Role

    // 1. Get request with user details
    const { data: request, error: fetchError } = await supabase
        .from('payment_requests')
        .select('*, user:app_users!payment_requests_user_id_fkey(email, full_name)')
        .eq('id', requestId)
        .single();

    if (fetchError || !request) throw new Error('Request not found');

    // 2. Update Subscription
    // Calculate end date based on period
    const now = new Date();
    const startDate = now.toISOString();
    let endDate = new Date();
    if (request.billing_period === 'yearly') {
        endDate.setFullYear(endDate.getFullYear() + 1);
    } else {
        endDate.setMonth(endDate.getMonth() + 1);
    }

    // Update or Insert Subscription
    const normalizedPlanCode = normalizePlanCode(request.plan_code, 'TRIAL');
    if (normalizedPlanCode === 'TRIAL') {
        throw new Error('Invalid plan code');
    }

    const { error: subError } = await supabase
        .from('subscriptions')
        .upsert({
            org_id: request.org_id,
            plan_code: normalizedPlanCode,
            status: 'active',
            current_period_start: startDate,
            current_period_end: endDate.toISOString(),
            provider: 'manual',
        }, { onConflict: 'org_id' });

    if (subError) throw subError;

    // 3. Update Request Status
    const { error: updateError } = await supabase
        .from('payment_requests')
        .update({
            status: 'approved',
            reviewed_at: now.toISOString(),
            reviewed_by: adminUserId,
        })
        .eq('id', requestId);

    if (updateError) throw updateError;

    return request;
}

export async function rejectPaymentRequest(requestId: string, adminUserId: string, reason: string) {
    const supabase = createSupabaseServerClient(); // Service Role

    const { error } = await supabase
        .from('payment_requests')
        .update({
            status: 'rejected',
            reviewed_at: new Date().toISOString(),
            reviewed_by: adminUserId,
            review_note: reason,
        })
        .eq('id', requestId);

    if (error) throw error;
}
