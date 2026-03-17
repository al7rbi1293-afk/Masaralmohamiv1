'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { buttonVariants } from '@/components/ui/button';

export function SignInForm({ nextPath, prefilledEmail }: { nextPath: string; prefilledEmail: string }) {
  const router = useRouter();
  
  const [email, setEmail] = useState(prefilledEmail);
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  
  const [step, setStep] = useState<'password' | 'verify'>('password');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const submitPasswordCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('يرجى إدخال البريد الإلكتروني.');
      return;
    }
    if (!password) {
      setError('يرجى إدخال كلمة المرور.');
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');

    try {
      const res = await fetch('/api/auth/verify-password-send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'حدث خطأ. يرجى مراجعة البريد وكلمة المرور والمحاولة مرة أخرى.');
        return;
      }

      setMessage(data.message || 'لتأكيد الهوية، تم إرسال رمز التحقق للبريد الإلكتروني.');
      setStep('verify');
    } catch (err) {
      setError('حدث خطأ غير متوقع. يرجى التأكد من اتصالك بالإنترنت والتبديل لكلمة المرور.');
    } finally {
      setLoading(false);
    }
  };

  const requestResendOtp = async () => {
    setLoading(true);
    setError('');
    setMessage('');

    try {
      // Re-trigger the same endpoint
      const res = await fetch('/api/auth/verify-password-send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'تعذر إعادة الإرسال.');
        return;
      }
      setMessage('تمت إعادة إرسال الرمز للبريد الإلكتروني بنجاح.');
    } catch (err) {
      setError('تعذر إعادة الإرسال.');
    } finally {
      setLoading(false);
    }
  };

  const verifyOtpAndLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp) {
      setError('يرجى إدخال رمز التحقق.');
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');

    try {
      // 1. Verify our custom OTP tracking DB columns
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'رمز التحقق غير صحيح أو انتهت صلاحيته.');
        setLoading(false);
        return;
      }

      // 2. If valid, sign in via our custom 2fa route
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = '/api/auth/login-with-otp';
      
      const emailInput = document.createElement('input');
      emailInput.type = 'hidden';
      emailInput.name = 'email';
      emailInput.value = email;
      form.appendChild(emailInput);
      
      const nextInput = document.createElement('input');
      nextInput.type = 'hidden';
      nextInput.name = 'next';
      nextInput.value = nextPath;
      form.appendChild(nextInput);

      document.body.appendChild(form);
      form.submit();
      
    } catch (err) {
      setError('تعذر إكمال العملية، يرجى المحاولة مرة أخرى.');
      setLoading(false);
    }
  };

  return (
    <div className="mt-6 space-y-4">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </div>
      )}

      {message && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200">
          {message}
        </div>
      )}

      {step === 'password' ? (
        <form onSubmit={submitPasswordCredentials} className="space-y-4">
          <label className="block space-y-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">البريد الإلكتروني</span>
            <input
              required
              name="email"
              type="email"
              dir="ltr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
            />
          </label>

          <label className="block space-y-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">كلمة المرور</span>
            <input
              required
              name="password"
              type="password"
              dir="ltr"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
            />
          </label>

          <button type="submit" disabled={loading} className={buttonVariants('primary', 'md', 'w-full')}>
            {loading ? 'الرجاء الانتظار...' : 'متابعة الدخول'}
          </button>
        </form>
      ) : (
        <form onSubmit={verifyOtpAndLogin} className="space-y-4">
          <div className="rounded-lg border border-brand-border bg-slate-50 p-4 text-center dark:border-slate-700 dark:bg-slate-800/50">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
              أدخل رمز التحقق (OTP)
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              المرسل إلى: <span className="dir-ltr inline-block tracking-wider font-semibold">{email}</span>
            </p>
          </div>

          <label className="block space-y-1 text-sm">
            <input
              required
              type="text"
              pattern="[0-9]*"
              inputMode="numeric"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              autoComplete="one-time-code"
              placeholder="0 0 0 0 0 0"
              className="h-12 w-full rounded-lg border border-brand-border px-3 text-center text-xl tracking-[0.5em] focus:tracking-[0.7em] transition-all outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
            />
          </label>

          <div className="flex flex-col gap-2 pt-2">
            <button type="submit" disabled={loading || otp.length < 5} className={buttonVariants('primary', 'md', 'w-full disabled:opacity-50 disabled:cursor-not-allowed')}>
              {loading ? 'الرجاء الانتظار...' : 'التحقق والدخول'}
            </button>
            
            <div className="flex gap-2">
              <button 
                type="button" 
                onClick={requestResendOtp}
                disabled={loading}
                className={buttonVariants('outline', 'md', 'flex-1')}
              >
                إعادة الإرسال
              </button>
              <button 
                type="button" 
                onClick={() => {
                  setStep('password');
                  setOtp('');
                  setPassword('');
                  setMessage('');
                  setError('');
                }}
                disabled={loading}
                className={buttonVariants('ghost', 'md', 'flex-1 text-slate-500')}
              >
                تغيير الحساب
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
