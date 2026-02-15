'use client';

import { FormEvent, useState } from 'react';

export function UpgradeRequestForm() {
    const [status, setStatus] = useState<'idle' | 'submitting' | 'success'>('idle');
    const [error, setError] = useState<string | null>(null);

    async function onSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError(null);
        setStatus('submitting');

        const formData = new FormData(event.currentTarget);

        try {
            const response = await fetch('/api/leads', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    name: formData.get('name') || 'طالب ترقية',
                    email: formData.get('email'),
                    phone: formData.get('phone') || undefined,
                    message: formData.get('message') || undefined,
                    topic: 'upgrade',
                    website: formData.get('website') || undefined,
                }),
            });

            const payload = (await response.json().catch(() => null)) as { message?: string } | null;

            if (!response.ok) {
                setError(payload?.message ?? 'تعذر إرسال الطلب. حاول مرة أخرى.');
                setStatus('idle');
                return;
            }

            setStatus('success');
        } catch {
            setError('تعذر الاتصال بالخدمة. حاول مرة أخرى.');
            setStatus('idle');
        }
    }

    if (status === 'success') {
        return (
            <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center dark:border-emerald-900/40 dark:bg-emerald-950/30">
                <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                    تم استلام طلبك بنجاح. سنتواصل معك قريبًا.
                </p>
            </div>
        );
    }

    return (
        <form
            id="upgrade-form"
            onSubmit={onSubmit}
            className="mt-6 space-y-4 rounded-xl border border-brand-border bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900"
        >
            <h2 className="text-lg font-bold text-brand-navy dark:text-slate-100">
                طلب ترقية الاشتراك
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">
                أرسل طلبك وسيتواصل معك فريقنا خلال ساعات العمل.
            </p>

            <label className="block space-y-1 text-sm">
                <span className="font-medium text-slate-700 dark:text-slate-200">الاسم</span>
                <input
                    required
                    name="name"
                    type="text"
                    maxLength={120}
                    className="h-11 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
                />
            </label>

            <label className="block space-y-1 text-sm">
                <span className="font-medium text-slate-700 dark:text-slate-200">البريد الإلكتروني</span>
                <input
                    required
                    name="email"
                    type="email"
                    maxLength={255}
                    className="h-11 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
                />
            </label>

            <label className="block space-y-1 text-sm">
                <span className="font-medium text-slate-700 dark:text-slate-200">رقم الجوال (اختياري)</span>
                <input
                    name="phone"
                    type="text"
                    maxLength={40}
                    className="h-11 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
                />
            </label>

            <label className="block space-y-1 text-sm">
                <span className="font-medium text-slate-700 dark:text-slate-200">رسالة (اختياري)</span>
                <textarea
                    name="message"
                    rows={3}
                    maxLength={2000}
                    className="w-full rounded-lg border border-brand-border px-3 py-2 text-sm outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
                />
            </label>

            {/* Honeypot */}
            <div className="hidden" aria-hidden>
                <label htmlFor="upgrade-website">Website</label>
                <input id="upgrade-website" name="website" tabIndex={-1} autoComplete="off" />
            </div>

            {error ? (
                <p
                    role="alert"
                    className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300"
                >
                    {error}
                </p>
            ) : null}

            <button
                type="submit"
                disabled={status === 'submitting'}
                className="h-11 w-full rounded-lg bg-brand-emerald px-6 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
            >
                {status === 'submitting' ? 'جارٍ الإرسال...' : 'إرسال طلب الترقية'}
            </button>
        </form>
    );
}
