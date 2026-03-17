import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Container } from '@/components/ui/container';
import { Section } from '@/components/ui/section';
import { getActiveClientPortalAccess } from '@/lib/client-portal/access';
import { getCurrentClientPortalSession } from '@/lib/client-portal/session';
import { ClientPortalSignInForm } from './sign-in-form';

export const metadata: Metadata = {
  title: 'بوابة العميل | تسجيل الدخول',
  description: 'دخول آمن إلى بوابة العميل عبر رمز تحقق على البريد الإلكتروني.',
  robots: { index: false, follow: false },
  alternates: {
    canonical: '/client-portal/signin',
  },
};

export default async function ClientPortalSignInPage() {
  // Only redirect to /client-portal when the user has BOTH a valid session
  // token AND active portal access in the database. This prevents the infinite
  // redirect loop that occurs when a session JWT exists but the portal user
  // record is inactive/missing.
  const session = await getCurrentClientPortalSession();
  if (session) {
    const access = await getActiveClientPortalAccess();
    if (access) {
      redirect('/client-portal');
    }
    // Session JWT exists but portal user is inactive/missing.
    // We can't delete cookies in a Server Component, so we just fall through
    // and show the sign-in form. The stale cookie will be overwritten on the
    // next successful login.
  }

  return (
    <Section className="py-16 sm:py-20">
      <Container className="max-w-xl">
        <div className="rounded-xl2 border border-brand-border bg-white p-6 shadow-panel dark:border-slate-700 dark:bg-slate-900">
          <h1 className="text-2xl font-bold text-brand-navy dark:text-slate-100">بوابة العميل</h1>
          <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-300">
            أدخل بريدك الإلكتروني المسجل لدينا، وسنرسل لك رمز تحقق لمرة واحدة.
          </p>

          <ClientPortalSignInForm />
        </div>
      </Container>
    </Section>
  );
}
