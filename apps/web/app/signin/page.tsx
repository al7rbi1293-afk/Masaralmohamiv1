import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { buttonVariants } from '@/components/ui/button';
import { Container } from '@/components/ui/container';
import { Section } from '@/components/ui/section';
import { SignInForm } from '@/components/auth/sign-in-form';
import { isUserAppAdmin } from '@/lib/admin';
import { getCurrentAuthUser } from '@/lib/supabase/auth-session';
import { getCurrentOrgIdForUser } from '@/lib/org';
import { getLinkedPartnerForUserId } from '@/lib/partners/access';
import {
  isPartnerUser,
  isPartnerOnlyUser,
  resolvePostSignInDestination,
} from '@/lib/partners/portal-routing';

export const metadata: Metadata = {
  title: 'تسجيل الدخول',
  description: 'تسجيل الدخول إلى منصة مسار المحامي.',
  robots: { index: false, follow: false },
  alternates: {
    canonical: '/signin',
  },
  openGraph: {
    title: 'تسجيل الدخول | مسار المحامي',
    description: 'تسجيل الدخول إلى مساحة /app في مسار المحامي.',
    url: '/signin',
    images: ['/masar-logo.png'],
  },
};

type SignInPageProps = {
  searchParams?: {
    error?: string;
    email?: string;
    reason?: string;
    switched?: string;
    token?: string;
    next?: string;
  };
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const tokenFromQuery = searchParams?.token ? safeDecode(searchParams.token) : '';
  const nextFromQuery = searchParams?.next ? safeDecode(searchParams.next) : '';
  const tokenFromNext = nextFromQuery.startsWith('/invite/') ? nextFromQuery.slice('/invite/'.length) : '';
  const inviteToken = tokenFromQuery || tokenFromNext;
  const nextPath = inviteToken ? `/invite/${inviteToken}` : safeNextPath(nextFromQuery);
  const prefilledEmail = searchParams?.email ? safeDecode(searchParams.email).trim().toLowerCase() : '';

  const user = await getCurrentAuthUser();
  if (user) {
    if (prefilledEmail && prefilledEmail !== user.email.toLowerCase()) {
      redirect(buildSwitchAccountHref(prefilledEmail, nextPath));
    }

    const [orgId, linkedPartner, isAdmin] = await Promise.all([
      getCurrentOrgIdForUser(),
      getLinkedPartnerForUserId(user.id),
      isUserAppAdmin(user.id),
    ]);

    if (inviteToken) {
      redirect(`/invite/${encodeURIComponent(inviteToken)}`);
    }

    redirect(resolvePostSignInDestination({
      requestedPath: nextPath,
      isAdmin,
      isPartnerUser: isPartnerUser({
        hasLinkedPartner: Boolean(linkedPartner),
        isAdmin,
      }),
      isPartnerOnly: isPartnerOnlyUser({
        hasLinkedPartner: Boolean(linkedPartner),
        hasOrganization: Boolean(orgId),
        isAdmin,
      }),
    }));
  }

  const error = searchParams?.error ? safeDecode(searchParams.error) : null;
  const existsMessage =
    searchParams?.reason === 'exists'
      ? 'هذا البريد مسجل بالفعل. سجّل الدخول لإكمال التجربة.'
      : null;
  const switchedMessage =
    searchParams?.switched === '1'
      ? 'تم تسجيل خروج الحساب الحالي حتى تتمكن من الدخول بحساب الشريك الصحيح.'
      : null;
  const partnerMessage = nextPath === '/app/partners'
    ? 'بعد تسجيل الدخول سيتم توجيهك مباشرة إلى بوابة الشريك.'
    : null;

  const inviteBanner = inviteToken
    ? `أنت على وشك قبول دعوة لفريق. استخدم البريد المدعو${prefilledEmail ? `: ${prefilledEmail}` : '.'}`
    : null;

  const signUpHref = inviteToken
    ? `/signup?token=${encodeURIComponent(inviteToken)}&email=${encodeURIComponent(prefilledEmail)}`
    : '/#trial';
  const signUpLabel = inviteToken ? 'إنشاء حساب' : 'تسجيل مكتب جديد';

  return (
    <Section className="py-16 sm:py-20">
      <Container className="max-w-xl">
        <div className="rounded-xl2 border border-brand-border bg-white p-6 shadow-panel dark:border-slate-700 dark:bg-slate-900">
          <h1 className="text-2xl font-bold text-brand-navy dark:text-slate-100">تسجيل الدخول</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            أدخل البريد وكلمة المرور للوصول إلى حسابك في مسار المحامي.
          </p>

          {inviteBanner ? (
            <p className="mt-4 rounded-lg border border-brand-border bg-brand-background px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-200">
              {inviteBanner}
            </p>
          ) : null}

          {existsMessage ? (
            <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
              {existsMessage}
            </p>
          ) : null}

          {error ? (
            <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
              {error}
            </p>
          ) : null}

          {switchedMessage ? (
            <p className="mt-4 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-200">
              {switchedMessage}
            </p>
          ) : null}

          {partnerMessage ? (
            <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200">
              {partnerMessage}
            </p>
          ) : null}

          <SignInForm nextPath={nextPath ?? ''} prefilledEmail={prefilledEmail} />

          <div className="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-300">
            <Link href="/forgot-password" className="block text-brand-emerald hover:underline">
              نسيت كلمة المرور؟
            </Link>
            <Link href={signUpHref} className="block text-brand-emerald hover:underline">
              {signUpLabel}
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

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function safeNextPath(raw?: string) {
  if (!raw) return null;
  const value = raw.trim();
  if (!value.startsWith('/') || value.startsWith('//')) return null;
  if (value.includes('\n') || value.includes('\r')) return null;
  if (value.startsWith('/app')) {
    if (value.startsWith('/app/api')) return null;
    return value;
  }
  if (value.startsWith('/admin')) {
    if (value.startsWith('/admin/api')) return null;
    return value;
  }
  return null;
}

function buildSwitchAccountHref(email: string, nextPath: string | null) {
  const search = new URLSearchParams();
  search.set('email', email);
  if (nextPath) {
    search.set('next', nextPath);
  }
  return `/auth/switch-account?${search.toString()}`;
}
