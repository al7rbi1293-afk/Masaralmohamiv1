'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DEFAULT_PHONE_COUNTRY_CODE,
  getPhoneCountryConfig,
  getPhoneInputMaxLength,
  PHONE_COUNTRIES,
  type SupportedPhoneCountryCode,
} from '@/lib/phone';

type FormState = {
  full_name: string;
  whatsapp_country: SupportedPhoneCountryCode;
  whatsapp_number: string;
  email: string;
  city: string;
  marketing_experience: string;
  audience_notes: string;
  accepted_terms: boolean;
};

const INITIAL_STATE: FormState = {
  full_name: '',
  whatsapp_country: DEFAULT_PHONE_COUNTRY_CODE,
  whatsapp_number: '',
  email: '',
  city: '',
  marketing_experience: '',
  audience_notes: '',
  accepted_terms: false,
};

export function SuccessPartnersForm() {
  const [form, setForm] = useState<FormState>(INITIAL_STATE);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const selectedWhatsappCountry = getPhoneCountryConfig(form.whatsapp_country);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setSuccessMessage(null);
    setErrorMessage(null);
    setFieldErrors({});

    try {
      const response = await fetch('/api/partners/apply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...form,
          website: '',
        }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        setErrorMessage(payload?.message || 'تعذر إرسال الطلب حالياً. حاول مرة أخرى.');
        setFieldErrors(payload?.fieldErrors || {});
        return;
      }

      setSuccessMessage(payload?.message || 'تم استلام طلبك بنجاح.');
      setForm(INITIAL_STATE);
    } catch {
      setErrorMessage('تعذر الاتصال بالخدمة. حاول مرة أخرى.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-xl2 border border-brand-border bg-white p-6 shadow-panel dark:border-slate-700 dark:bg-slate-900">
      <div className="grid gap-4 sm:grid-cols-2">
        <InputField
          label="الاسم الرباعي"
          name="full_name"
          value={form.full_name}
          onChange={(value) => setForm((prev) => ({ ...prev, full_name: value }))}
          error={fieldErrors.full_name?.[0]}
          required
        />

        <label className="space-y-1 text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-200">رقم التواصل (واتساب)</span>
          <div className="flex gap-2">
            <select
              name="whatsapp_country"
              value={form.whatsapp_country}
              onChange={(event) => setForm((prev) => ({ ...prev, whatsapp_country: event.target.value as SupportedPhoneCountryCode }))}
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
              name="whatsapp_number"
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              dir="ltr"
              value={form.whatsapp_number}
              onChange={(event) => setForm((prev) => ({ ...prev, whatsapp_number: event.target.value }))}
              placeholder={selectedWhatsappCountry.example}
              maxLength={getPhoneInputMaxLength(form.whatsapp_country)}
              className="h-11 w-full rounded-lg border border-brand-border px-3 text-sm outline-none ring-brand-emerald transition focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
            />
          </div>
          <span className="block text-xs text-slate-500 dark:text-slate-400">
            أدخل الرقم المحلي بدون رمز الدولة.
          </span>
          {fieldErrors.whatsapp_country?.[0] ? <p className="text-xs text-red-600">{fieldErrors.whatsapp_country[0]}</p> : null}
          {fieldErrors.whatsapp_number?.[0] ? <p className="text-xs text-red-600">{fieldErrors.whatsapp_number[0]}</p> : null}
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <InputField
          label="البريد الإلكتروني الرسمي"
          name="email"
          type="email"
          value={form.email}
          onChange={(value) => setForm((prev) => ({ ...prev, email: value }))}
          error={fieldErrors.email?.[0]}
          required
        />

        <InputField
          label="المدينة"
          name="city"
          value={form.city}
          onChange={(value) => setForm((prev) => ({ ...prev, city: value }))}
          error={fieldErrors.city?.[0]}
          required
        />
      </div>

      <TextAreaField
        label="نبذة مختصرة عن خبرتك التسويقية"
        name="marketing_experience"
        value={form.marketing_experience}
        onChange={(value) => setForm((prev) => ({ ...prev, marketing_experience: value }))}
        error={fieldErrors.marketing_experience?.[0]}
        required
      />

      <TextAreaField
        label="ملاحظات عن جمهورك / قنواتك التسويقية (اختياري)"
        name="audience_notes"
        value={form.audience_notes}
        onChange={(value) => setForm((prev) => ({ ...prev, audience_notes: value }))}
        error={fieldErrors.audience_notes?.[0]}
      />

      <label className="flex items-start gap-2 rounded-lg border border-brand-border/80 bg-brand-background/30 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800/40">
        <input
          checked={form.accepted_terms}
          onChange={(event) => setForm((prev) => ({ ...prev, accepted_terms: event.target.checked }))}
          type="checkbox"
          className="mt-1 h-4 w-4 rounded border-brand-border text-brand-emerald"
          required
        />
        <span>
          أوافق على شروط برنامج شركاء النجاح وسياسة مراجعة الطلبات.
        </span>
      </label>
      {fieldErrors.accepted_terms?.[0] ? <p className="text-xs text-red-600">{fieldErrors.accepted_terms[0]}</p> : null}

      {successMessage ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200">
          {successMessage}
        </p>
      ) : null}

      {errorMessage ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          {errorMessage}
        </p>
      ) : null}

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'جارٍ إرسال الطلب...' : 'إرسال طلب الانضمام'}
      </Button>
    </form>
  );
}

function InputField(props: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="space-y-1 text-sm">
      <span className="font-medium text-slate-700 dark:text-slate-200">{props.label}</span>
      <input
        name={props.name}
        type={props.type || 'text'}
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        required={props.required}
        className="h-11 w-full rounded-lg border border-brand-border px-3 text-sm outline-none ring-brand-emerald transition focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
      />
      {props.error ? <p className="text-xs text-red-600">{props.error}</p> : null}
    </label>
  );
}

function TextAreaField(props: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
}) {
  return (
    <label className="space-y-1 text-sm">
      <span className="font-medium text-slate-700 dark:text-slate-200">{props.label}</span>
      <textarea
        name={props.name}
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        required={props.required}
        rows={4}
        className="w-full rounded-lg border border-brand-border px-3 py-2 text-sm outline-none ring-brand-emerald transition focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
      />
      {props.error ? <p className="text-xs text-red-600">{props.error}</p> : null}
    </label>
  );
}
