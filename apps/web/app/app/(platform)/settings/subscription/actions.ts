'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createPaymentRequest } from '@/lib/payments';

const requestSchema = z.object({
    plan_code: z.string().min(1),
    billing_period: z.enum(['monthly', 'yearly']),
    amount: z.coerce.number().positive(),
    bank_reference: z.string().min(3, 'يرجى إدخال رقم مرجع صحيح'),
});

export async function submitBankTransferAction(formData: FormData) {
    const raw = {
        plan_code: formData.get('plan_code'),
        billing_period: formData.get('billing_period'),
        amount: formData.get('amount'),
        bank_reference: formData.get('bank_reference'),
    };

    const parsed = requestSchema.safeParse(raw);

    if (!parsed.success) {
        return { error: 'البيانات غير مكتملة. يرجى التأكد من إدخال المرجع البنكي.' };
    }

    try {
        const { plan_code, billing_period, amount, bank_reference } = parsed.data;

        await createPaymentRequest({
            plan_code,
            billing_period,
            amount,
            bank_reference,
        });

    } catch (error) {
        console.error('Payment Request Error:', error);
        return { error: 'حدث خطأ أثناء إرسال الطلب. حاول مرة أخرى.' };
    }

    revalidatePath('/app/settings/subscription');
    redirect('/app/settings/subscription?success=payment_submitted');
}
