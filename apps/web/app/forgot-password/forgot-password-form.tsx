'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';

type Step = 'request' | 'verify' | 'reset' | 'done';

type ApiResult = {
  ok?: boolean;
  error?: string;
};

type ForgotPasswordFormProps = {
  defaultEmail?: string;
};

export function ForgotPasswordForm({ defaultEmail }: ForgotPasswordFormProps) {
  const [step, setStep] = useState<Step>('request');
  const [email, setEmail] = useState(defaultEmail?.trim() ?? '');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const maskedEmail = useMemo(() => {
    const value = email.trim();
    const at = value.indexOf('@');
    if (at <= 1) return value;
    const prefix = value.slice(0, 2);
    return `${prefix}***${value.slice(at)}`;
  }, [email]);

  async function requestCode() {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch('/api/password-reset/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data: ApiResult = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || 'تعذر إرسال الرمز. حاول مرة أخرى.');
      }

      setStep('verify');
      setMessage(`إذا كان البريد صحيحًا، تم إرسال رمز إلى ${maskedEmail}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'تعذر إرسال الرمز. حاول مرة أخرى.');
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode() {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch('/api/password-reset/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), code: code.trim() }),
      });
      const data: ApiResult = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'تعذر التحقق من الرمز.');
      }

      setStep('reset');
      setMessage('تم التحقق من الرمز. أدخل كلمة المرور الجديدة.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'تعذر التحقق من الرمز.');
    } finally {
      setLoading(false);
    }
  }

  async function updatePassword() {
    if (password !== confirm) {
      setMessage('كلمتا المرور غير متطابقتين.');
      return;
    }

    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch('/api/password-reset/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data: ApiResult = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'تعذر تحديث كلمة المرور.');
      }

      setStep('done');
      setMessage('تم تحديث كلمة المرور بنجاح. يمكنك تسجيل الدخول الآن.');
      setPassword('');
      setConfirm('');
      setCode('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'تعذر تحديث كلمة المرور.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      {message ? (
        <p className="rounded-lg border border-brand-border bg-brand-background px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-200">
          {message}
        </p>
      ) : null}

      {step === 'request' ? (
        <div className="space-y-4">
          <label className="block space-y-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">البريد الإلكتروني</span>
            <input
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              className="h-11 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
            />
          </label>

          <button
            type="button"
            disabled={loading || !email.trim()}
            onClick={requestCode}
            className={buttonVariants('primary', 'md')}
          >
            {loading ? 'جارٍ الإرسال...' : 'إرسال الرمز'}
          </button>
        </div>
      ) : null}

      {step === 'verify' ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-slate-600 dark:text-slate-300">تم إرسال رمز إلى: {maskedEmail}</p>
            <button
              type="button"
              className={buttonVariants('outline', 'sm')}
              onClick={requestCode}
              disabled={loading}
            >
              إعادة الإرسال
            </button>
          </div>

          <label className="block space-y-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">الرمز</span>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              inputMode="numeric"
              autoComplete="one-time-code"
              className="h-11 w-full rounded-lg border border-brand-border px-3 text-center text-lg tracking-widest outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
            />
          </label>

          <button
            type="button"
            disabled={loading || !code.trim()}
            onClick={verifyCode}
            className={buttonVariants('primary', 'md')}
          >
            {loading ? 'جارٍ التحقق...' : 'تحقق'}
          </button>
        </div>
      ) : null}

      {step === 'reset' ? (
        <div className="space-y-4">
          <label className="block space-y-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">كلمة المرور الجديدة</span>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              className="h-11 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
            />
          </label>

          <label className="block space-y-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">تأكيد كلمة المرور</span>
            <input
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              type="password"
              className="h-11 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
            />
          </label>

          <button
            type="button"
            disabled={loading || !password || !confirm}
            onClick={updatePassword}
            className={buttonVariants('primary', 'md')}
          >
            {loading ? 'جارٍ التحديث...' : 'تحديث كلمة المرور'}
          </button>

          <p className="text-xs text-slate-500 dark:text-slate-400">
            يجب أن تكون كلمة المرور 7 خانات على الأقل وتحتوي على حرف كبير، صغير، رقم، ورمز.
          </p>
        </div>
      ) : null}

      {step === 'done' ? (
        <div className="space-y-3">
          <Link href="/signin" className={buttonVariants('primary', 'md')}>
            الذهاب لتسجيل الدخول
          </Link>
        </div>
      ) : null}
    </div>
  );
}

