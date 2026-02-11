'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiRequest } from '@/lib/api';
import { setSession } from '@/lib/session';
import { buttonVariants } from '@/components/ui/button';

type LoginResponse = {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    tenantId: string;
    email: string;
    role: 'PARTNER' | 'LAWYER' | 'ASSISTANT';
    name: string;
  };
};

type LoginFormProps = {
  initialTenantId?: string;
};

export function LoginForm({ initialTenantId = '' }: LoginFormProps) {
  const router = useRouter();
  const [form, setForm] = useState({
    tenantId: initialTenantId,
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
      const result = await apiRequest<LoginResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          tenantId: form.tenantId,
          email: form.email,
          password: form.password,
        }),
      });

      setSession({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        user: result.user,
      });

      router.replace(`/app/${result.user.tenantId}/dashboard`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'تعذّر تسجيل الدخول');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-xl rounded-xl2 border border-brand-border bg-white p-6 shadow-panel dark:border-slate-700 dark:bg-slate-900">
      <h1 className="text-2xl font-bold text-brand-navy dark:text-slate-100">تسجيل الدخول للإدارة</h1>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
        أدخل Tenant ID مع البريد وكلمة المرور للدخول إلى مساحة المكتب.
      </p>

      {error ? (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </p>
      ) : null}

      <form onSubmit={onSubmit} className="mt-5 space-y-4">
        <label className="block space-y-1 text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-200">Tenant ID</span>
          <input
            required
            value={form.tenantId}
            onChange={(e) => setForm({ ...form, tenantId: e.target.value })}
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
            {loading ? 'جارٍ الدخول...' : 'دخول'}
          </button>
          <Link href="/start" className={buttonVariants('outline', 'md')}>
            إنشاء مكتب جديد
          </Link>
        </div>
      </form>
    </div>
  );
}
