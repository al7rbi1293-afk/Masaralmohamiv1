import 'server-only';

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

    const { data, error } = await supabase
        .from('payment_requests')
        .insert({
            org_id: orgId,
            user_id: user.id,
            amount: params.amount,
            plan_code: params.plan_code,
            billing_period: params.billing_period,
            method: 'bank_transfer',
            status: 'pending',
            proof_url: params.proof_url ?? null,
            bank_reference: params.bank_reference ?? null,
        })
        .select()
        .single();

    if (error) throw error;
    return data as PaymentRequest;
}

export async function listPendingPaymentRequests() {
    // restricted to admins - usually using service role or specific RLS
    const supabase = createSupabaseServerClient(); // Service Role

    const { data, error } = await supabase
        .from('payment_requests')
        .select('*, organization:organizations(name), user:users(email)')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
}

export async function approvePaymentRequest(requestId: string, adminUserId: string) {
    const supabase = createSupabaseServerClient(); // Service Role

    // 1. Get request
    const { data: request, error: fetchError } = await supabase
        .from('payment_requests')
        .select('*')
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
    const { error: subError } = await supabase
        .from('subscriptions')
        .upsert({
            org_id: request.org_id,
            plan_code: request.plan_code,
            status: 'active',
            current_period_start: startDate,
            current_period_end: endDate.toISOString(),
            provider: 'manual',
            updated_at: now.toISOString(),
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
