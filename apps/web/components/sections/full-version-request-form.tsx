'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

type FullVersionRequestFormProps = {
  source: 'app' | 'contact' | 'landing';
  prefilledEmail?: string;
  prefilledName?: string;
  defaultMessage?: string;
};

type FormState = {
  fullName: string;
  email: string;
  phone: string;
  firmName: string;
  message: string;
  website: string;
};

export function FullVersionRequestForm({
  source,
  prefilledEmail = '',
  prefilledName = '',
  defaultMessage = 'أرغب بتفعيل النسخة الكاملة',
}: FullVersionRequestFormProps) {
  const [form, setForm] = useState<FormState>({
    fullName: prefilledName,
    email: prefilledEmail,
    phone: '',
    firmName: '',
    message: defaultMessage,
    website: '',
  });
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setStatus('submitting');

    try {
      const response = await fetch('/api/contact-request', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          full_name: form.fullName || undefined,
          email: form.email,
          phone: form.phone || undefined,
          firm_name: form.firmName || undefined,
          message: form.message || undefined,
          source,
          website: form.website,
        }),
      });

      const payload = (await response.json().catch(() => null)) as { message?: string } | null;

      if (!response.ok) {
        setError(payload?.message ?? 'تعذر إرسال الطلب. حاول مرة أخرى.');
        setStatus('idle');
        return;
      }

      setStatus('success');
      setForm((current) => ({
        ...current,
        phone: '',
        firmName: '',
        message: defaultMessage,
        website: '',
      }));
    } catch {
      setError('تعذر الاتصال بالخدمة. حاول مرة أخرى.');
      setStatus('idle');
    }
  }

  useEffect(() => {
    if (status !== 'success') {
      return undefined;
    }

    const timeout = window.setTimeout(() => {
      setStatus('idle');
    }, 4000);

    return () => window.clearTimeout(timeout);
  }, [status]);

  return (
    <div className="space-y-4">
      {status === 'success' ? (
        <div
          className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300"
          role="status"
          aria-live="polite"
        >
          تم استلام طلبك. سنتواصل معك قريبًا.
        </div>
      ) : null}

      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block space-y-1 text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-200">البريد الإلكتروني</span>
          <input
            required
            type="email"
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
            className="h-11 w-full rounded-lg border border-brand-border px-3 text-sm outline-none ring-brand-emerald transition focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">الاسم (اختياري)</span>
            <input
              value={form.fullName}
              onChange={(event) => setForm({ ...form, fullName: event.target.value })}
              className="h-11 w-full rounded-lg border border-brand-border px-3 text-sm outline-none ring-brand-emerald transition focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">رقم الجوال (اختياري)</span>
            <input
              value={form.phone}
              onChange={(event) => setForm({ ...form, phone: event.target.value })}
              className="h-11 w-full rounded-lg border border-brand-border px-3 text-sm outline-none ring-brand-emerald transition focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
            />
          </label>
        </div>

        <label className="block space-y-1 text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-200">اسم المكتب (اختياري)</span>
          <input
            value={form.firmName}
            onChange={(event) => setForm({ ...form, firmName: event.target.value })}
            className="h-11 w-full rounded-lg border border-brand-border px-3 text-sm outline-none ring-brand-emerald transition focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
          />
        </label>

        <label className="block space-y-1 text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-200">الرسالة (اختياري)</span>
          <textarea
            rows={4}
            value={form.message}
            onChange={(event) => setForm({ ...form, message: event.target.value })}
            className="w-full rounded-lg border border-brand-border px-3 py-2 text-sm outline-none ring-brand-emerald transition focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
          />
        </label>

        <div className="hidden" aria-hidden>
          <label htmlFor={`website-${source}`}>Website</label>
          <input
            id={`website-${source}`}
            tabIndex={-1}
            autoComplete="off"
            value={form.website}
            onChange={(event) => setForm({ ...form, website: event.target.value })}
          />
        </div>

        {error ? (
          <p
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300"
          >
            {error}
          </p>
        ) : null}

        <Button type="submit" disabled={status === 'submitting'}>
          {status === 'submitting' ? 'جارٍ الإرسال...' : 'أرسل طلب التفعيل'}
        </Button>
      </form>
    </div>
  );
}
