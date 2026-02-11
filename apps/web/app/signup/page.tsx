import type { Metadata } from 'next';
import Link from 'next/link';
import { signUpAction } from './actions';
import { buttonVariants } from '@/components/ui/button';
import { Container } from '@/components/ui/container';
import { Section } from '@/components/ui/section';

export const metadata: Metadata = {
  title: 'إنشاء حساب',
  description: 'إنشاء حساب جديد في منصة مسار المحامي.',
  openGraph: {
    title: 'إنشاء حساب | مسار المحامي',
    description: 'إنشاء حساب وتجربة منصة مسار المحامي.',
    url: '/signup',
  },
};

type SignUpPageProps = {
  searchParams?: {
    error?: string;
  };
};

export default function SignUpPage({ searchParams }: SignUpPageProps) {
  const error = searchParams?.error ? decodeURIComponent(searchParams.error) : null;

  return (
    <Section className="py-16 sm:py-20">
      <Container className="max-w-xl">
        <div className="rounded-xl2 border border-brand-border bg-white p-6 shadow-panel dark:border-slate-700 dark:bg-slate-900">
          <h1 className="text-2xl font-bold text-brand-navy dark:text-slate-100">إنشاء حساب</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            أنشئ حسابك للدخول إلى منصة التجربة. تفعيل المنظمة والاشتراك سيتم في مرحلة لاحقة.
          </p>

          {error ? (
            <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
              {error}
            </p>
          ) : null}

          <form action={signUpAction} className="mt-6 space-y-4">
            <label className="block space-y-1 text-sm">
              <span className="font-medium text-slate-700 dark:text-slate-200">الاسم الكامل</span>
              <input
                required
                name="full_name"
                type="text"
                className="h-11 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
              />
            </label>

            <label className="block space-y-1 text-sm">
              <span className="font-medium text-slate-700 dark:text-slate-200">البريد الإلكتروني</span>
              <input
                required
                name="email"
                type="email"
                className="h-11 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
              />
            </label>

            <label className="block space-y-1 text-sm">
              <span className="font-medium text-slate-700 dark:text-slate-200">كلمة المرور</span>
              <input
                required
                minLength={8}
                name="password"
                type="password"
                className="h-11 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
              />
            </label>

            <label className="block space-y-1 text-sm">
              <span className="font-medium text-slate-700 dark:text-slate-200">رقم الجوال (اختياري)</span>
              <input
                name="phone"
                type="text"
                className="h-11 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
              />
            </label>

            <label className="block space-y-1 text-sm">
              <span className="font-medium text-slate-700 dark:text-slate-200">اسم المكتب (اختياري)</span>
              <input
                name="firm_name"
                type="text"
                className="h-11 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
              />
            </label>

            <button type="submit" className={buttonVariants('primary', 'md')}>
              إنشاء الحساب
            </button>
          </form>

          <div className="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-300">
            <Link href="/signin" className="block text-brand-emerald hover:underline">
              لدي حساب بالفعل
            </Link>
            <Link href="/" className="text-brand-emerald hover:underline">
              العودة للموقع
            </Link>
          </div>
        </div>
      </Container>
    </Section>
  );
}
