import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { FullVersionRequestForm } from '@/components/sections/full-version-request-form';
import { Container } from '@/components/ui/container';
import { getCurrentAuthUser } from '@/lib/supabase/auth-session';

const supportEmail = 'masar.almohami@outlook.sa';

export default async function TrialExpiredPage() {
  const user = await getCurrentAuthUser();

  return (
    <Container className="py-14 sm:py-20">
      <section className="mx-auto max-w-2xl rounded-xl2 border border-brand-border bg-white p-7 text-center shadow-panel dark:border-slate-700 dark:bg-slate-900">
        <h1 className="text-3xl font-bold text-brand-navy dark:text-slate-100">انتهت التجربة</h1>
        <p className="mt-4 text-sm leading-8 text-slate-700 dark:text-slate-300">
          شكرًا لاستخدام مسار المحامي. للتفعيل والانتقال للنسخة الكاملة، تواصل معنا.
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <a
            href={`mailto:${supportEmail}?subject=${encodeURIComponent('تفعيل النسخة الكاملة - مسار المحامي')}`}
            className={buttonVariants('primary', 'md')}
          >
            تفعيل النسخة الكاملة
          </a>
          <Link href="/" className={buttonVariants('outline', 'md')}>
            العودة للموقع
          </Link>
        </div>

        <div id="request-full-version" className="mt-8 rounded-lg border border-brand-border p-5 text-start dark:border-slate-700">
          <h2 className="text-lg font-bold text-brand-navy dark:text-slate-100">طلب تفعيل النسخة الكاملة</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            أرسل الطلب وسيتواصل معك فريق مسار المحامي خلال وقت قصير.
          </p>
          <div className="mt-4">
            <FullVersionRequestForm source="app" prefilledEmail={user?.email ?? ''} />
          </div>
        </div>
      </section>
    </Container>
  );
}
