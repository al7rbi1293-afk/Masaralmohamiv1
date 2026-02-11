'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';

type FormState = {
  fullName: string;
  firmName: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
};

const initialState: FormState = {
  fullName: '',
  firmName: '',
  email: '',
  phone: '',
  subject: '',
  message: '',
};

export function ContactForm() {
  const [form, setForm] = useState<FormState>(initialState);
  const [status, setStatus] = useState<'idle' | 'success'>('idle');

  const mailtoHref = useMemo(() => {
    const subject = encodeURIComponent(form.subject || 'طلب تواصل من موقع مسار المحامي');
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

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus('success');
    setForm(initialState);
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
    <div className="relative rounded-xl2 border border-brand-border bg-white p-6 shadow-panel dark:border-slate-700 dark:bg-slate-900">
      <h2 className="text-xl font-bold text-brand-navy dark:text-slate-100">أرسل لنا رسالة</h2>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
        النموذج يعمل محليًا بدون تكامل خارجي. يمكنك استخدام البريد المباشر كخيار سريع.
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
              required
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
          <span className="font-medium text-slate-700 dark:text-slate-200">الموضوع</span>
          <input
            required
            value={form.subject}
            onChange={(e) => setForm({ ...form, subject: e.target.value })}
            className="h-11 w-full rounded-lg border border-brand-border px-3 text-sm outline-none ring-brand-emerald transition focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
          />
        </label>

        <label className="space-y-1 text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-200">الرسالة</span>
          <textarea
            required
            rows={5}
            value={form.message}
            onChange={(e) => setForm({ ...form, message: e.target.value })}
            className="w-full rounded-lg border border-brand-border px-3 py-2 text-sm outline-none ring-brand-emerald transition focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
          />
        </label>

        <div className="flex flex-wrap gap-3">
          <Button type="submit">إرسال</Button>
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
