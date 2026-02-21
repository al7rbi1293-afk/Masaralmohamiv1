import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { resendActivationAction, signUpAction } from './actions';
import { InviteEmailField } from './invite-email-field';
import { buttonVariants } from '@/components/ui/button';
import { Container } from '@/components/ui/container';
import { Section } from '@/components/ui/section';
import { getCurrentAuthUser } from '@/lib/supabase/auth-session';

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
    token?: string;
    email?: string;
    status?: string;
  };
};

import { headers } from 'next/headers';

export default async function SignUpPage({ searchParams }: SignUpPageProps) {
  const token = searchParams?.token ? safeDecode(searchParams.token) : '';
  const invitedEmail = searchParams?.email ? safeDecode(searchParams.email) : '';
  const status = searchParams?.status ? safeDecode(searchParams.status) : '';

  // Get CSRF Token
  const requestHeaders = headers();
  const csrfToken = requestHeaders.get('X-CSRF-Token') || 'missing';

  // New office signup happens via the marketing trial form (/#trial).
  // The /signup page is reserved for invite acceptance flow (token-based).
  if (!token) {
    redirect('/#trial');
  }

  const user = await getCurrentAuthUser();
  if (user) {
    if (token) {
      redirect(`/invite/${encodeURIComponent(token)}`);
    }
    redirect('/app');
  }

  const error = searchParams?.error ? safeDecode(searchParams.error) : null;
  const pendingActivation = status === 'pending_activation';
  const activationResent = status === 'activation_resent';
  const inviteBanner = token
    ? `أنت على وشك قبول دعوة لفريق. استخدم البريد المدعو${invitedEmail ? `: ${invitedEmail}` : '.'}`
    : null;

  const signInHref = token
    ? `/signin?token=${encodeURIComponent(token)}&email=${encodeURIComponent(invitedEmail)}`
    : '/signin';

  return (
    <Section className="py-16 sm:py-20">
      <Container className="max-w-xl">
        <div className="rounded-xl2 border border-brand-border bg-white p-6 shadow-panel dark:border-slate-700 dark:bg-slate-900">
          <h1 className="text-2xl font-bold text-brand-navy dark:text-slate-100">إنشاء حساب</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            أنشئ حسابك للدخول إلى منصة التجربة. تفعيل المنظمة والاشتراك سيتم في مرحلة لاحقة.
          </p>

          {inviteBanner ? (
            <p className="mt-4 rounded-lg border border-brand-border bg-brand-background px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-200">
              {inviteBanner}
            </p>
          ) : null}

          {error ? (
            <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
              {error}
            </p>
          ) : null}

          {pendingActivation && invitedEmail ? (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
              <p>الحساب مسجل مسبقًا لكنه غير مُفعّل. اضغط لإعادة إرسال رسالة التفعيل.</p>
              <form action={resendActivationAction} className="mt-3">
                <input type="hidden" name="csrf_token" value={csrfToken} />
                <input type="hidden" name="email" value={invitedEmail} />
                {token ? <input type="hidden" name="token" value={token} /> : null}
                <button type="submit" className={buttonVariants('outline', 'sm')}>
                  إعادة إرسال رسالة التفعيل
                </button>
              </form>
            </div>
          ) : null}

          {activationResent && invitedEmail ? (
            <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200">
              تم إرسال رسالة التفعيل إلى {invitedEmail}. تحقق من بريدك ثم افتح الرابط.
            </p>
          ) : null}

          <form action={signUpAction} className="mt-6 space-y-4">
            <input type="hidden" name="csrf_token" value={csrfToken} />
            {token ? <input type="hidden" name="token" value={token} /> : null}
            <label className="block space-y-1 text-sm">
              <span className="font-medium text-slate-700 dark:text-slate-200">الاسم الكامل</span>
              <input
                required
                name="full_name"
                type="text"
                className="h-11 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
              />
            </label>

            {token && invitedEmail ? (
              <InviteEmailField invitedEmail={invitedEmail} />
            ) : (
              <label className="block space-y-1 text-sm">
                <span className="font-medium text-slate-700 dark:text-slate-200">البريد الإلكتروني</span>
                <input
                  required
                  name="email"
                  type="email"
                  defaultValue={invitedEmail}
                  className="h-11 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
                />
              </label>
            )}

            <label className="block space-y-1 text-sm">
              <span className="font-medium text-slate-700 dark:text-slate-200">كلمة المرور</span>
              <input
                required
                minLength={7}
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
            <Link href={signInHref} className="block text-brand-emerald hover:underline">
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

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
