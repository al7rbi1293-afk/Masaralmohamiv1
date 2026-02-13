import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { buttonVariants } from '@/components/ui/button';
import { Container } from '@/components/ui/container';
import { Section } from '@/components/ui/section';
import { getCurrentAuthUser } from '@/lib/supabase/auth-session';

export const metadata: Metadata = {
  title: 'تسجيل الدخول',
  description: 'تسجيل الدخول إلى منصة مسار المحامي.',
  openGraph: {
    title: 'تسجيل الدخول | مسار المحامي',
    description: 'تسجيل الدخول إلى مساحة /app في مسار المحامي.',
    url: '/signin',
  },
};

type SignInPageProps = {
  searchParams?: {
    error?: string;
    email?: string;
    reason?: string;
    token?: string;
    next?: string;
  };
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const tokenFromQuery = searchParams?.token ? safeDecode(searchParams.token) : '';
  const nextFromQuery = searchParams?.next ? safeDecode(searchParams.next) : '';
  const tokenFromNext = nextFromQuery.startsWith('/invite/') ? nextFromQuery.slice('/invite/'.length) : '';
  const inviteToken = tokenFromQuery || tokenFromNext;

  const user = await getCurrentAuthUser();
  if (user) {
    if (inviteToken) {
      redirect(`/invite/${encodeURIComponent(inviteToken)}`);
    }
    redirect('/app');
  }

  const error = searchParams?.error ? safeDecode(searchParams.error) : null;
  const prefilledEmail = searchParams?.email ? safeDecode(searchParams.email) : '';
  const nextPath = inviteToken ? `/invite/${inviteToken}` : nextFromQuery;
  const existsMessage =
    searchParams?.reason === 'exists'
      ? 'هذا البريد مسجل بالفعل. سجّل الدخول لإكمال التجربة.'
      : null;

  const inviteBanner = inviteToken
    ? `أنت على وشك قبول دعوة لفريق. استخدم البريد المدعو${prefilledEmail ? `: ${prefilledEmail}` : '.'}`
    : null;

  const signUpHref = inviteToken
    ? `/signup?token=${encodeURIComponent(inviteToken)}&email=${encodeURIComponent(prefilledEmail)}`
    : '/signup';

  return (
    <Section className="py-16 sm:py-20">
      <Container className="max-w-xl">
        <div className="rounded-xl2 border border-brand-border bg-white p-6 shadow-panel dark:border-slate-700 dark:bg-slate-900">
          <h1 className="text-2xl font-bold text-brand-navy dark:text-slate-100">تسجيل الدخول</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            أدخل البريد وكلمة المرور للوصول إلى منصة المكتب تحت <code>/app</code>.
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

          <form action="/api/signin" method="post" className="mt-6 space-y-4">
            <input type="hidden" name="next" value={nextPath} />
            <label className="block space-y-1 text-sm">
              <span className="font-medium text-slate-700 dark:text-slate-200">البريد الإلكتروني</span>
              <input
                required
                name="email"
                type="email"
                defaultValue={prefilledEmail}
                className="h-11 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
              />
            </label>

            <label className="block space-y-1 text-sm">
              <span className="font-medium text-slate-700 dark:text-slate-200">كلمة المرور</span>
              <input
                required
                name="password"
                type="password"
                className="h-11 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
              />
            </label>

            <button type="submit" className={buttonVariants('primary', 'md')}>
              تسجيل الدخول
            </button>
          </form>

          <div className="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-300">
            <Link href={signUpHref} className="block text-brand-emerald hover:underline">
              إنشاء حساب
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
