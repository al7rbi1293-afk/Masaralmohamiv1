'use client';

import { FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';

export function StartTrialForm() {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    const form = event.currentTarget;
    const formData = new FormData(form);

    try {
      const response = await fetch('/api/start-trial', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (response.redirected) {
        window.location.assign(response.url);
        return;
      }

      const payload = (await response.json().catch(() => null)) as { message?: string } | null;
      setErrorMessage(payload?.message ?? 'تعذّر بدء التجربة. حاول مرة أخرى.');
    } catch {
      setErrorMessage('تعذّر الاتصال بالخدمة. حاول مرة أخرى.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-xl2 border border-brand-border bg-white p-6 shadow-panel dark:border-slate-700 dark:bg-slate-900">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-200">الاسم الكامل</span>
          <input
            required
            name="full_name"
            type="text"
            className="h-11 w-full rounded-lg border border-brand-border px-3 text-sm outline-none ring-brand-emerald transition focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
          />
        </label>

        <label className="space-y-1 text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-200">البريد الإلكتروني</span>
          <input
            required
            name="email"
            type="email"
            className="h-11 w-full rounded-lg border border-brand-border px-3 text-sm outline-none ring-brand-emerald transition focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
          />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-200">كلمة المرور</span>
          <input
            required
            minLength={8}
            name="password"
            type="password"
            className="h-11 w-full rounded-lg border border-brand-border px-3 text-sm outline-none ring-brand-emerald transition focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
          />
        </label>

        <label className="space-y-1 text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-200">رقم الجوال (اختياري)</span>
          <input
            name="phone"
            type="text"
            className="h-11 w-full rounded-lg border border-brand-border px-3 text-sm outline-none ring-brand-emerald transition focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
          />
        </label>
      </div>

      <label className="space-y-1 text-sm">
        <span className="font-medium text-slate-700 dark:text-slate-200">اسم المكتب (اختياري)</span>
        <input
          name="firm_name"
          type="text"
          className="h-11 w-full rounded-lg border border-brand-border px-3 text-sm outline-none ring-brand-emerald transition focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
        />
      </label>

      <div className="hidden" aria-hidden>
        <label htmlFor="website">Website</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      {errorMessage ? (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300"
        >
          {errorMessage}
        </p>
      ) : null}

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'جارٍ إنشاء التجربة...' : 'ابدأ التجربة الآن'}
      </Button>
    </form>
  );
}
