'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';

type FormState = {
  fullName: string;
  firmName: string;
  email: string;
  phone: string;
  message: string;
  website: string;
};

const initialState: FormState = {
  fullName: '',
  firmName: '',
  email: '',
  phone: '',
  message: '',
  website: '',
};

type ContactFormProps = {
  defaultMessage?: string;
};

export function ContactForm({ defaultMessage = '' }: ContactFormProps) {
  const [form, setForm] = useState<FormState>(initialState);
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success'>('idle');
  const [error, setError] = useState<string | null>(null);

  const mailtoHref = useMemo(() => {
    const subject = encodeURIComponent('طلب تواصل من موقع مسار المحامي');
    const body = encodeURIComponent(
      [
        `الاسم: ${form.fullName}`,
        `اسم المكتب: ${form.firmName || '-'}`,
        `البريد: ${form.email}`,
        `رقم الجوال: ${form.phone || '-'}`,
        '',
        form.message,
      ].join('\n'),
    );

    return `mailto:masar.almohami@outlook.sa?subject=${subject}&body=${body}`;
  }, [form]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setStatus('submitting');

    try {
      const response = await fetch('/api/leads', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          name: form.fullName || 'زائر',
          email: form.email,
          phone: form.phone || undefined,
          firm_name: form.firmName || undefined,
          message: form.message || undefined,
          topic: 'contact',
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
      setForm({
        ...initialState,
        message: defaultMessage,
      });
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

  useEffect(() => {
    setForm((current) => ({
      ...current,
      message: current.message || defaultMessage,
    }));
  }, [defaultMessage]);

  return (
    <div className="relative rounded-xl2 border border-brand-border bg-white p-6 shadow-panel dark:border-slate-700 dark:bg-slate-900">
      <h2 className="text-xl font-bold text-brand-navy dark:text-slate-100">أرسل لنا رسالة</h2>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
        أرسل طلبك مباشرة لفريقنا، أو استخدم البريد المباشر كخيار سريع.
      </p>

      {status === 'success' ? (
        <div
          className="fixed inset-x-4 bottom-4 z-50 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 shadow-lg dark:border-emerald-900/50 dark:bg-emerald-950/90 dark:text-emerald-300 sm:inset-x-auto sm:start-6 sm:max-w-sm"
          role="status"
          aria-live="polite"
        >
          تم استلام طلبك بنجاح. سنقوم بالتواصل معك قريبًا.
        </div>
      ) : null}

      <form onSubmit={onSubmit} className="mt-5 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">الاسم</span>
            <input
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              className="h-11 w-full rounded-lg border border-brand-border px-3 text-sm outline-none ring-brand-emerald transition focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">اسم المكتب (اختياري)</span>
            <input
              value={form.firmName}
              onChange={(e) => setForm({ ...form, firmName: e.target.value })}
              className="h-11 w-full rounded-lg border border-brand-border px-3 text-sm outline-none ring-brand-emerald transition focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
            />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">البريد</span>
            <input
              required
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="h-11 w-full rounded-lg border border-brand-border px-3 text-sm outline-none ring-brand-emerald transition focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">رقم الجوال (اختياري)</span>
            <input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="h-11 w-full rounded-lg border border-brand-border px-3 text-sm outline-none ring-brand-emerald transition focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
            />
          </label>
        </div>

        <label className="space-y-1 text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-200">الرسالة (اختياري)</span>
          <textarea
            rows={5}
            value={form.message}
            onChange={(e) => setForm({ ...form, message: e.target.value })}
            className="w-full rounded-lg border border-brand-border px-3 py-2 text-sm outline-none ring-brand-emerald transition focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
          />
        </label>

        <div className="hidden" aria-hidden>
          <label htmlFor="contact-website">Website</label>
          <input
            id="contact-website"
            name="website"
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

        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={status === 'submitting'}>
            {status === 'submitting' ? 'جارٍ الإرسال...' : 'إرسال الطلب'}
          </Button>
          <a
            href={mailtoHref}
            className="inline-flex h-11 items-center justify-center rounded-lg border border-brand-border px-4 text-sm font-medium text-brand-navy transition hover:bg-brand-navy/5 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            إرسال عبر البريد
          </a>
        </div>
      </form>
    </div>
  );
}
