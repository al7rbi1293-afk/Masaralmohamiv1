import type { Metadata } from 'next';
import Link from 'next/link';
import { Container } from '@/components/ui/container';
import { Section } from '@/components/ui/section';
import { buttonVariants } from '@/components/ui/button';
import {
  buildPartnerSignInUrl,
  getPartnerAccessRequest,
} from '@/lib/partners/access';
import { completePartnerAccessAction } from './actions';

export const metadata: Metadata = {
  title: 'إعداد حساب الشريك',
  description: 'إعداد الوصول إلى بوابة الشريك في مسار المحامي.',
  robots: { index: false, follow: false },
  alternates: {
    canonical: '/partner-access',
  },
  openGraph: {
    title: 'إعداد حساب الشريك | مسار المحامي',
    description: 'إعداد الوصول إلى بوابة الشريك في مسار المحامي.',
    url: '/partner-access',
  },
};

type PartnerAccessPageProps = {
  searchParams?: {
    email?: string;
    token?: string;
    error?: string;
  };
};

export default async function PartnerAccessPage({ searchParams }: PartnerAccessPageProps) {
  const email = searchParams?.email ? safeDecode(searchParams.email).trim().toLowerCase() : '';
  const token = searchParams?.token ? safeDecode(searchParams.token).trim() : '';
  const error = searchParams?.error ? safeDecode(searchParams.error) : '';

  let accessRequest: Awaited<ReturnType<typeof getPartnerAccessRequest>> = null;

  if (email && token) {
    try {
      accessRequest = await getPartnerAccessRequest({ email, token });
    } catch {
      accessRequest = null;
    }
  }

  const signInHref = email ? buildPartnerSignInUrl(email) : '/signin?next=%2Fapp%2Fpartners';
  const expiresAt = accessRequest?.expiresAt
    ? new Date(accessRequest.expiresAt).toLocaleString('ar-SA', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : null;

  return (
    <Section className="py-16 sm:py-20">
      <Container className="max-w-xl">
        <div className="rounded-xl2 border border-brand-border bg-white p-6 shadow-panel dark:border-slate-700 dark:bg-slate-900">
          <h1 className="text-2xl font-bold text-brand-navy dark:text-slate-100">إعداد حساب الشريك</h1>
          <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-300">
            أكمل إعداد كلمة المرور لمرة واحدة، وبعدها سيتم فتح بوابة الشريك مباشرة داخل مسار المحامي.
          </p>

          {error ? (
            <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
              {error}
            </p>
          ) : null}

          {!accessRequest ? (
            <div className="mt-6 space-y-4">
              <div className="rounded-xl border border-brand-border bg-brand-background px-4 py-4 text-sm leading-7 text-slate-700 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-200">
                الرابط غير صالح أو انتهت صلاحيته. إذا كنت أعددت الحساب بالفعل، يمكنك تسجيل الدخول مباشرة إلى بوابة الشريك.
              </div>

              <div className="flex flex-wrap gap-3">
                <Link href={signInHref} className={buttonVariants('primary', 'md')}>
                  الذهاب إلى تسجيل الدخول
                </Link>
                <Link href="/" className={buttonVariants('outline', 'md')}>
                  العودة للموقع
                </Link>
              </div>
            </div>
          ) : (
            <form action={completePartnerAccessAction} className="mt-6 space-y-4">
              <input type="hidden" name="email" value={accessRequest.email} />
              <input type="hidden" name="token" value={accessRequest.token} />

              <div className="rounded-xl border border-brand-border bg-brand-background px-4 py-4 text-sm dark:border-slate-700 dark:bg-slate-800/40">
                <p className="font-medium text-brand-navy dark:text-slate-100">{accessRequest.fullName || accessRequest.email}</p>
                <p className="mt-1 text-slate-600 dark:text-slate-300">{accessRequest.email}</p>
                {expiresAt ? (
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    صلاحية رابط الإعداد حتى: {expiresAt}
                  </p>
                ) : null}
              </div>

              <label className="block space-y-1 text-sm">
                <span className="font-medium text-slate-700 dark:text-slate-200">كلمة المرور الجديدة</span>
                <input
                  required
                  name="password"
                  type="password"
                  className="h-11 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
                />
              </label>

              <label className="block space-y-1 text-sm">
                <span className="font-medium text-slate-700 dark:text-slate-200">تأكيد كلمة المرور</span>
                <input
                  required
                  name="confirm_password"
                  type="password"
                  className="h-11 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
                />
              </label>

              <p className="text-xs text-slate-500 dark:text-slate-400">
                يجب أن تكون كلمة المرور 7 خانات على الأقل وتحتوي على حرف كبير، صغير، رقم، ورمز.
              </p>

              <button type="submit" className={buttonVariants('primary', 'md')}>
                تفعيل الحساب والدخول إلى البوابة
              </button>
            </form>
          )}
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
