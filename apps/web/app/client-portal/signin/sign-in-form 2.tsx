'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { buttonVariants } from '@/components/ui/button';
import {
  CLIENT_PORTAL_PHONE_COUNTRIES,
  DEFAULT_CLIENT_PORTAL_COUNTRY,
  getClientPortalCountryOption,
} from '@/lib/client-portal/phone';

type Step = 'request' | 'verify';

type RequestOtpResponse = {
  ok?: boolean;
  error?: string;
  message?: string;
  channel?: 'sms' | 'whatsapp' | 'email';
  fallback_used?: boolean;
};

type VerifyOtpResponse = {
  ok?: boolean;
  error?: string;
  redirect_to?: string;
};

export function ClientPortalSignInForm() {
  const router = useRouter();
  const [phoneCountry, setPhoneCountry] = useState<string>(DEFAULT_CLIENT_PORTAL_COUNTRY);
  const [phoneNational, setPhoneNational] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<Step>('request');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [deliveryChannel, setDeliveryChannel] = useState<'sms' | 'whatsapp' | 'email' | null>(null);
  const [fallbackUsed, setFallbackUsed] = useState(false);
  const selectedCountry = getClientPortalCountryOption(phoneCountry);

  const channelHint = useMemo(() => {
    if (deliveryChannel === 'sms') {
      return 'تم الإرسال عبر SMS.';
    }
    if (deliveryChannel === 'whatsapp') {
      return fallbackUsed ? 'تم الإرسال عبر واتساب (fallback).' : 'تم الإرسال عبر واتساب.';
    }
    if (deliveryChannel === 'email') {
      return fallbackUsed ? 'تم الإرسال عبر البريد الإلكتروني (fallback).' : 'تم الإرسال عبر البريد الإلكتروني.';
    }
    return null;
  }, [deliveryChannel, fallbackUsed]);

  async function requestOtp() {
    setIsSubmitting(true);
    setError(null);
    setMessage(null);
    setDeliveryChannel(null);
    setFallbackUsed(false);

    try {
      const response = await fetch('/api/client-portal/auth/request-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone_country: phoneCountry,
          phone_national: phoneNational,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as RequestOtpResponse;

      if (!response.ok || !payload.ok) {
        setError(payload.error || 'تعذر إرسال رمز التحقق حالياً.');
        return;
      }

      setMessage(payload.message || 'تم إرسال رمز التحقق.');
      setDeliveryChannel(payload.channel ?? null);
      setFallbackUsed(Boolean(payload.fallback_used));
      setStep('verify');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function verifyOtp() {
    setIsSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch('/api/client-portal/auth/verify-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone_country: phoneCountry,
          phone_national: phoneNational,
          code,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as VerifyOtpResponse;
      if (!response.ok || !payload.ok) {
        setError(payload.error || 'تعذر التحقق من الرمز.');
        return;
      }

      router.push(payload.redirect_to || '/client-portal');
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step === 'request') {
      await requestOtp();
      return;
    }
    await verifyOtp();
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4">
      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </p>
      ) : null}

      {message ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200">
          {message}
          {channelHint ? ` ${channelHint}` : ''}
        </p>
      ) : null}

      <label className="block space-y-1 text-sm">
        <span className="font-medium text-slate-700 dark:text-slate-200">رقم الجوال</span>
        <div className="flex gap-2">
          <select
            name="phone_country"
            value={phoneCountry}
            onChange={(event) => setPhoneCountry(event.target.value)}
            disabled={isSubmitting || step === 'verify'}
            className="h-11 w-[48%] rounded-lg border border-brand-border bg-white px-2 text-sm outline-none ring-brand-emerald transition focus:ring-2 disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:disabled:bg-slate-800"
          >
            {CLIENT_PORTAL_PHONE_COUNTRIES.map((country) => (
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
            disabled={isSubmitting || step === 'verify'}
            placeholder={selectedCountry.code === 'SA' ? '5XXXXXXXX' : 'رقم الجوال'}
            value={phoneNational}
            onChange={(event) => setPhoneNational(event.target.value)}
            className="h-11 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:disabled:bg-slate-800"
          />
        </div>
        <span className="block text-xs text-slate-500 dark:text-slate-400">
          أدخل الرقم المحلي بدون رمز الدولة.
        </span>
      </label>

      {step === 'verify' ? (
        <label className="block space-y-1 text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-200">رمز التحقق</span>
          <input
            required
            name="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            dir="ltr"
            maxLength={6}
            value={code}
            onChange={(event) => setCode(event.target.value)}
            className="h-11 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
          />
        </label>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={isSubmitting} className={buttonVariants('primary', 'md')}>
          {isSubmitting
            ? 'جاري المعالجة...'
            : step === 'request'
            ? 'إرسال رمز التحقق'
            : 'تأكيد الدخول'}
        </button>

        {step === 'verify' ? (
          <>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => {
                void requestOtp();
              }}
              className={buttonVariants('outline', 'md')}
            >
              إعادة إرسال الرمز
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => {
                setStep('request');
                setCode('');
                setMessage(null);
                setError(null);
                setDeliveryChannel(null);
                setFallbackUsed(false);
                setPhoneNational('');
              }}
              className={buttonVariants('ghost', 'md')}
            >
              تغيير الرقم
            </button>
          </>
        ) : null}
      </div>
    </form>
  );
}
