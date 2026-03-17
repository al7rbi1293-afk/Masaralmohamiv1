import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { Container } from '@/components/ui/container';
import { Section } from '@/components/ui/section';
import { getActiveClientPortalAccess } from '@/lib/client-portal/access';
import {
  getCurrentClientPortalSession,
  CLIENT_PORTAL_SESSION_COOKIE_NAME,
} from '@/lib/client-portal/session';
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
  // Check if the user has a valid session AND active portal access.
  // Only redirect to /client-portal when both conditions are met.
  // This prevents the infinite redirect loop that occurs when a session JWT
  // exists but the portal user record is inactive/missing in the database.
  const session = await getCurrentClientPortalSession();
  if (session) {
    const access = await getActiveClientPortalAccess();
    if (access) {
      redirect('/client-portal');
    }
    // Session JWT exists but portal user is inactive/missing – clear stale cookie
    cookies().delete(CLIENT_PORTAL_SESSION_COOKIE_NAME);
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
