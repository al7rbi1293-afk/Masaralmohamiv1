import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { Container } from '@/components/ui/container';

const supportEmail = 'masar.almohami@outlook.sa';

export default function TrialExpiredPage() {
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
      </section>
    </Container>
  );
}
