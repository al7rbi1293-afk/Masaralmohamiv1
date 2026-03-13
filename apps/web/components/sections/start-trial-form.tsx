'use client';

import { FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DEFAULT_PHONE_COUNTRY_CODE,
  getPhoneCountryConfig,
  getPhoneInputMaxLength,
  PHONE_COUNTRIES,
  type SupportedPhoneCountryCode,
} from '@/lib/phone';

export function StartTrialForm() {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [phoneCountry, setPhoneCountry] = useState<SupportedPhoneCountryCode>(DEFAULT_PHONE_COUNTRY_CODE);

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

      const payload = (await response.json().catch(() => null)) as
        | { message?: string; redirectTo?: string }
        | null;

      if (payload?.redirectTo) {
        window.location.assign(payload.redirectTo);
        return;
      }

      setErrorMessage(payload?.message ?? 'تعذّر بدء التجربة. حاول مرة أخرى.');
    } catch {
      setErrorMessage('تعذّر الاتصال بالخدمة. حاول مرة أخرى.');
    } finally {
      setIsSubmitting(false);
    }
  }

  const selectedCountry = getPhoneCountryConfig(phoneCountry);

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
          <span className="font-medium text-slate-700 dark:text-slate-200">رقم الجوال</span>
          <div className="flex gap-2">
            <select
              name="phone_country"
              value={phoneCountry}
              onChange={(event) => setPhoneCountry(event.target.value as SupportedPhoneCountryCode)}
              className="h-11 w-[46%] rounded-lg border border-brand-border bg-white px-2 text-sm outline-none ring-brand-emerald transition focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
            >
              {PHONE_COUNTRIES.map((country) => (
                <option key={country.code} value={country.code}>
                  {country.nameAr} (+{country.dialCode})
                </option>
              ))}
            </select>
            <input
              required
              name="phone_national"
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              dir="ltr"
              placeholder={selectedCountry.example}
              maxLength={getPhoneInputMaxLength(phoneCountry)}
              className="h-11 w-full rounded-lg border border-brand-border px-3 text-sm outline-none ring-brand-emerald transition focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
            />
          </div>
          <span className="block text-xs text-slate-500 dark:text-slate-400">
            اكتب رقم الجوال بدون رمز الدولة.
          </span>
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

      <label className="space-y-1 text-sm">
        <span className="font-medium text-slate-700 dark:text-slate-200">كود الشريك (اختياري)</span>
        <input
          name="partner_code"
          type="text"
          dir="ltr"
          placeholder="MASAR-ABC123"
          className="h-11 w-full rounded-lg border border-brand-border px-3 text-sm uppercase outline-none ring-brand-emerald transition focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
        />
        <span className="block text-xs text-slate-500 dark:text-slate-400">
          إذا وصلك كود من شريك نجاح، اكتبه هنا حتى تُربط عملية التسجيل به حتى بدون رابط الإحالة.
        </span>
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
        {isSubmitting ? 'جارٍ بدء التجربة...' : 'ابدأ مسارك الآن'}
      </Button>
    </form>
  );
}
