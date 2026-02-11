'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiRequest } from '@/lib/api';
import { setSession } from '@/lib/session';
import { buttonVariants } from '@/components/ui/button';

type SignupResponse = {
  accessToken: string;
  refreshToken: string;
  workspaceUrl: string;
  tenant: {
    id: string;
    firmName: string;
    language: 'AR' | 'EN';
  };
  user: {
    id: string;
    tenantId: string;
    email: string;
    role: 'PARTNER' | 'LAWYER' | 'ASSISTANT';
    name: string;
  };
};

export function SignupForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    firmName: '',
    name: '',
    email: '',
    password: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await apiRequest<SignupResponse>('/auth/signup', {
        method: 'POST',
        body: JSON.stringify({
          firmName: form.firmName,
          name: form.name,
          email: form.email,
          password: form.password,
          language: 'AR',
          hijriDisplay: true,
        }),
      });

      setSession({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        user: result.user,
      });

      router.replace(result.workspaceUrl || `/app/${result.user.tenantId}/dashboard`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'تعذّر إنشاء الحساب');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-xl rounded-xl2 border border-brand-border bg-white p-6 shadow-panel dark:border-slate-700 dark:bg-slate-900">
      <h1 className="text-2xl font-bold text-brand-navy dark:text-slate-100">ابدأ إدارة مكتبك الآن</h1>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
        سجّل المكتب، وسيتم إنشاء مساحة خاصة لك مباشرة مع صلاحية Partner.
      </p>

      {error ? (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </p>
      ) : null}

      <form onSubmit={onSubmit} className="mt-5 space-y-4">
        <label className="block space-y-1 text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-200">اسم المكتب</span>
          <input
            required
            value={form.firmName}
            onChange={(e) => setForm({ ...form, firmName: e.target.value })}
            className="h-11 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
          />
        </label>

        <label className="block space-y-1 text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-200">اسم المسؤول</span>
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="h-11 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
          />
        </label>

        <label className="block space-y-1 text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-200">البريد الإلكتروني</span>
          <input
            required
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="h-11 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
          />
        </label>

        <label className="block space-y-1 text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-200">كلمة المرور</span>
          <input
            required
            minLength={8}
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="h-11 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
          />
        </label>

        <div className="flex flex-wrap gap-3 pt-2">
          <button type="submit" disabled={loading} className={buttonVariants('primary', 'md')}>
            {loading ? 'جارٍ إنشاء الحساب...' : 'إنشاء حساب المكتب'}
          </button>
          <Link href="/app/login" className={buttonVariants('outline', 'md')}>
            لدي حساب بالفعل
          </Link>
        </div>
      </form>
    </div>
  );
}
