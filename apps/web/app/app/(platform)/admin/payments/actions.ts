'use server';

import { approvePaymentRequest, rejectPaymentRequest } from '@/lib/payments';
import { revalidatePath } from 'next/cache';
import { getCurrentAuthUser } from '@/lib/supabase/auth-session';
import { renderInvoicePdfBuffer } from '@/lib/invoice-pdf';
import { sendInvoiceEmail } from '@/lib/email';

// TODO: Replace with real RBAC or Env var check
const ADMIN_EMAILS = ['admin@masar.sa', 'masar.almohami@outlook.sa']; // Add your admin email here

async function checkAdmin() {
    const user = await getCurrentAuthUser();
    if (!user || !user.email || !ADMIN_EMAILS.includes(user.email)) {
        throw new Error('Unauthorized: Admin access required');
    }
    return user.id;
}

export async function approveRequestAction(requestId: string) {
    try {
        const adminId = await checkAdmin();
        // 1. Approve & Update DB
        const request = await approvePaymentRequest(requestId, adminId);

        // 2. Generate Invoice
        // Map plan code to name (Basic mapping)
        const planName = request.plan_code === 'SOLO' ? 'محامي مستقل' :
            request.plan_code === 'SMALL_OFFICE' ? 'مكتب صغير' :
                request.plan_code === 'MEDIUM_OFFICE' ? 'مكتب متوسط' : request.plan_code;

        // Get user name
        const userName = request.user?.raw_user_meta_data?.full_name || request.user?.email || 'مشترك';
        const userEmail = request.user?.email;

        if (userEmail) {
            try {
                const { buffer } = await renderInvoicePdfBuffer({
                    number: `INV-${request.id.slice(0, 8).toUpperCase()}`,
                    status: 'مدفوعة',
                    currency: request.currency || 'SAR',
                    total: request.amount,
                    subtotal: request.amount, // Simplified, assuming inclusive tax or no tax calculation details
                    tax: 0,
                    paidAmount: request.amount,
                    remaining: 0,
                    issued_at: new Date().toISOString(),
                    due_at: null,
                    clientName: userName,
                    orgName: 'مسار المحامي',
                    logoUrl: null,
                    items: [
                        {
                            desc: `اشتراك باقة ${planName} (${request.billing_period === 'yearly' ? 'سنوي' : 'شهري'})`,
                            qty: 1,
                            unit_price: request.amount
                        }
                    ]
                });

                // 3. Send Email
                await sendInvoiceEmail(
                    userEmail,
                    userName,
                    planName,
                    `${request.amount} ${request.currency || 'SAR'}`,
                    buffer
                );
            } catch (emailError) {
                console.error('Failed to generate/send invoice email:', emailError);
                // We do NOT throw here, because the approval itself succeeded.
            }
        }

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
