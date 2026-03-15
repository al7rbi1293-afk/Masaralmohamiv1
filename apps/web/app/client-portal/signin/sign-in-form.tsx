'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { buttonVariants } from '@/components/ui/button';

type Step = 'request' | 'verify';

type RequestOtpResponse = {
  ok?: boolean;
  error?: string;
  message?: string;
  channel?: 'email';
};

type VerifyOtpResponse = {
  ok?: boolean;
  error?: string;
  redirect_to?: string;
};

export function ClientPortalSignInForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<Step>('request');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function requestOtp() {
    setIsSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch('/api/client-portal/auth/request-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as RequestOtpResponse;

      if (!response.ok || !payload.ok) {
        setError(payload.error || 'تعذر إرسال رمز التحقق حالياً.');
        return;
      }

      setMessage(payload.message || 'تم إرسال رمز التحقق إلى بريدك الإلكتروني.');
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
          email,
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
        </p>
      ) : null}

      <label className="block space-y-1 text-sm">
        <span className="font-medium text-slate-700 dark:text-slate-200">البريد الإلكتروني</span>
        <input
          required
          name="email"
          type="email"
          autoComplete="email"
          dir="ltr"
          disabled={isSubmitting || step === 'verify'}
          placeholder="name@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="h-11 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:disabled:bg-slate-800"
        />
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
              }}
              className={buttonVariants('ghost', 'md')}
            >
              تغيير البريد
            </button>
          </>
        ) : null}
      </div>
    </form>
  );
}
