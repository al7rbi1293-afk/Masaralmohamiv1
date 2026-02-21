'use client';

import { useState } from 'react';
import { buttonVariants } from '@/components/ui/button';
import { updateOfficeIdentityAction } from './actions';
import { Building2 } from 'lucide-react';

type OfficeIdentityFormProps = {
    currentName: string;
};

export function OfficeIdentityForm({ currentName }: OfficeIdentityFormProps) {
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    async function handleSubmit(formData: FormData) {
        setIsSubmitting(true);
        setError('');
        setSuccess('');

        try {
            const result = await updateOfficeIdentityAction(formData);
            if (result.success) {
                setSuccess('تم حفظ إعدادات هوية المكتب بنجاح.');
            } else {
                setError(result.error || 'فشلت عملية الحفظ.');
            }
        } catch {
            setError('تعذر الحفظ بسبب مشكلة في الاتصال.');
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <form action={handleSubmit} className="mt-6 flex flex-col gap-6 max-w-2xl">
            {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300">
                    {error}
                </div>
            )}

            {success && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-300">
                    {success}
                </div>
            )}

            <div className="space-y-4">
                <div>
                    <label htmlFor="name" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                        اسم المكتب / المنظمة <span className="text-red-500">*</span>
                    </label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                        <div className="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-3">
                            <Building2 className="h-4 w-4 text-slate-400" />
                        </div>
                        <input
                            type="text"
                            name="name"
                            id="name"
                            required
                            defaultValue={currentName}
                            placeholder="مثال: مكتب مسار للمحاماة والاستشارات"
                            className="block w-full rounded-lg border-brand-border bg-white py-2.5 ps-9 text-brand-navy shadow-sm focus:border-brand-emerald focus:ring-brand-emerald dark:border-slate-700 dark:bg-slate-950 dark:text-white sm:text-sm"
                        />
                    </div>
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                        سيظهر هذا الاسم في أعلى المنصة وفي الفواتير والمستندات الرسمية.
                    </p>
                </div>

                {/* Placeholder for future Logo upload */}
                <div className="opacity-50">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                        شعار المكتب (Logo)
                    </label>
                    <div className="mt-1 flex items-center gap-4">
                        <div className="flex h-16 w-16 items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-900">
                            <span className="text-xs text-slate-400">قريباً</span>
                        </div>
                        <button type="button" disabled className={buttonVariants('outline', 'sm')}>
                            رفع شعار
                        </button>
                    </div>
                </div>
            </div>

            <div className="mt-2 text-start">
                <button
                    type="submit"
                    disabled={isSubmitting}
                    className={buttonVariants('primary', 'md')}
                >
                    {isSubmitting ? 'جاري الحفظ...' : 'حفظ التغييرات'}
                </button>
            </div>
        </form>
    );
}
