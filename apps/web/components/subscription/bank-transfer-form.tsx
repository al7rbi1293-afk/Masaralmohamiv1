'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useFormStatus } from 'react-dom';
import { submitBankTransferAction } from '@/app/app/(platform)/settings/subscription/actions';

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending} className="w-full">
            {pending ? 'جارٍ الإرسال...' : 'تأكيد الحوالة'}
        </Button>
    );
}

export function BankTransferForm({
    planCode,
    planName,
    price,
    period,
}: {
    planCode: string;
    planName: string;
    price: number;
    period: 'monthly' | 'yearly';
}) {
    const [error, setError] = useState('');

    // Calculate final price based on period logic (Yearly = 10 months price for 12 months access)
    // But here we rely on the passed 'price' being correct per unit.
    // Actually, let's just use the strict amount passed.

    const finalAmount = period === 'yearly' ? price * 10 : price;
    const label = period === 'yearly' ? 'سنوي (خصم شهرين)' : 'شهري';

    return (
        <div className="space-y-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
                <h4 className="font-semibold text-slate-800 dark:text-slate-200">تفاصيل التحويل البنكي</h4>
                <dl className="mt-2 space-y-1 text-sm text-slate-600 dark:text-slate-300">
                    <div className="flex justify-between">
                        <dt>البنك:</dt>
                        <dd className="font-medium text-slate-900 dark:text-slate-100">مصرف الراجحي</dd>
                    </div>
                    <div className="flex justify-between">
                        <dt>اسم المستفيد:</dt>
                        <dd className="font-medium text-slate-900 dark:text-slate-100">عبدالعزيز فهد عطية الحازمي</dd>
                    </div>
                    <div className="flex justify-between">
                        <dt>الآيبان:</dt>
                        <dd className="font-mono font-medium text-slate-900 dark:text-slate-100" dir="ltr">
                            SA05 8000 0598 6080 1002 7488
                        </dd>
                    </div>
                    <div className="flex justify-between">
                        <dt>رقم الحساب:</dt>
                        <dd className="font-mono font-medium text-slate-900 dark:text-slate-100">
                            598000010006080027488
                        </dd>
                    </div>
                    <div className="mt-2 border-t border-slate-200 pt-2 dark:border-slate-700">
                        <div className="flex justify-between text-base font-bold text-brand-emerald">
                            <dt>المبلغ المستحق:</dt>
                            <dd>{finalAmount} ر.س ({label})</dd>
                        </div>
                    </div>
                </dl>
            </div>

            <form
                action={async (formData) => {
                    setError('');
                    const res = await submitBankTransferAction(formData);
                    if (res?.error) setError(res.error);
                }}
                className="space-y-4"
            >
                <input type="hidden" name="plan_code" value={planCode} />
                <input type="hidden" name="billing_period" value={period} />
                <input type="hidden" name="amount" value={finalAmount} />

                <label className="block space-y-2 text-sm">
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                        رقم مرجع الحوالة / اسم المحوّل
                    </span>
                    <input
                        name="bank_reference"
                        required
                        placeholder="مثال: 123456789 أو محمد عبدالله"
                        className="h-10 w-full rounded-md border border-slate-300 px-3 outline-none focus:ring-2 focus:ring-brand-emerald dark:border-slate-600 dark:bg-slate-800"
                    />
                </label>

                {error && <p className="text-sm text-red-600">{error}</p>}

                <SubmitButton />
            </form>

            <p className="text-xs text-slate-500 text-center">
                سيتم تفعيل الاشتراك خلال 24 ساعة من تأكيد الدفع.
            </p>
        </div>
    );
}
