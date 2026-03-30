'use server';

import { getPlanDisplayLabel } from '@/lib/billing/plans';
import { approvePaymentRequest, rejectPaymentRequest } from '@/lib/payments';
import { revalidatePath } from 'next/cache';
import { renderInvoicePdfBuffer } from '@/lib/invoice-pdf';
import { sendInvoiceEmail } from '@/lib/email';
import { requireAdmin } from '@/lib/admin';

export async function approveRequestAction(requestId: string) {
    try {
        const adminId = await requireAdmin('admin.payments.write');
        // 1. Approve & Update DB
        const request = await approvePaymentRequest(requestId, adminId);

        // 2. Generate Invoice
        const planName = getPlanDisplayLabel(request.plan_code);

        // Get user name
        const userName = request.user?.full_name || request.user?.email || 'مشترك';
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
        const adminId = await requireAdmin('admin.payments.write');
        await rejectPaymentRequest(requestId, adminId, reason);
        revalidatePath('/app/admin/payments');
    } catch (error) {
        console.error('Rejection Error:', error);
        throw error;
    }
}
