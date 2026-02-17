import type { Metadata } from 'next';
import Link from 'next/link';
import { Container } from '@/components/ui/container';
import { Section } from '@/components/ui/section';
import { buttonVariants } from '@/components/ui/button';
import { ForgotPasswordForm } from './forgot-password-form';
import { getCurrentAuthUser } from '@/lib/supabase/auth-session';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'نسيت كلمة المرور',
  description: 'استعادة كلمة المرور لحسابك في مسار المحامي.',
  openGraph: {
    title: 'نسيت كلمة المرور | مسار المحامي',
    description: 'استعادة كلمة المرور عبر رمز يُرسل إلى بريدك الإلكتروني.',
    url: '/forgot-password',
  },
};

type ForgotPasswordPageProps = {
  searchParams?: {
    email?: string;
  };
};

export default async function ForgotPasswordPage({ searchParams }: ForgotPasswordPageProps) {
  // If user is already signed in, they can still reset password but typically they don't need it.
  // Keep UX simple: redirect to /app.
  const user = await getCurrentAuthUser();
  if (user) {
    redirect('/app');
  }

  const defaultEmail = searchParams?.email ? safeDecode(searchParams.email) : '';

  return (
    <Section className="py-16 sm:py-20">
      <Container className="max-w-xl">
        <div className="rounded-xl2 border border-brand-border bg-white p-6 shadow-panel dark:border-slate-700 dark:bg-slate-900">
          <h1 className="text-2xl font-bold text-brand-navy dark:text-slate-100">نسيت كلمة المرور</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            أدخل بريدك الإلكتروني وسنرسل لك رمزًا لإعادة تعيين كلمة المرور.
          </p>

          <div className="mt-6">
            <ForgotPasswordForm defaultEmail={defaultEmail} />
          </div>

          <div className="mt-6 text-sm text-slate-600 dark:text-slate-300">
            <Link href="/signin" className={buttonVariants('outline', 'sm')}>
              العودة لتسجيل الدخول
            </Link>
          </div>
        </div>
      </Container>
    </Section>
  );
}

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

