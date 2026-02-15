'use server';

import { approvePaymentRequest, rejectPaymentRequest } from '@/lib/payments';
import { revalidatePath } from 'next/cache';
import { createSupabaseServerAuthClient } from '@/lib/supabase/server';

// TODO: Replace with real RBAC or Env var check
const ADMIN_EMAILS = ['admin@masar.sa', 'masar.almohami@outlook.sa']; // Add your admin email here

async function checkAdmin() {
    const supabase = createSupabaseServerAuthClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !user.email || !ADMIN_EMAILS.includes(user.email)) {
        throw new Error('Unauthorized: Admin access required');
    }
    return user.id;
}

export async function approveRequestAction(requestId: string) {
    try {
        const adminId = await checkAdmin();
        await approvePaymentRequest(requestId, adminId);
        revalidatePath('/app/admin/payments');
    } catch (error) {
        console.error('Approval Error:', error);
        throw error;
    }
}

export async function rejectRequestAction(requestId: string, reason: string) {
    try {
        const adminId = await checkAdmin();
        await rejectPaymentRequest(requestId, adminId, reason);
        revalidatePath('/app/admin/payments');
    } catch (error) {
        console.error('Rejection Error:', error);
        throw error;
    }
}
