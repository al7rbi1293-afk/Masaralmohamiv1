import type { Metadata } from 'next';
import { signOutAction } from './actions';
import { Container } from '@/components/ui/container';
import { buttonVariants } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'منصة المكتب',
  description: 'مساحة تجريبية محمية لمسار المحامي.',
  openGraph: {
    title: 'منصة المكتب | مسار المحامي',
    description: 'صفحات /app المحمية للمستخدمين المسجلين.',
    url: '/app',
  },
};

export default function AppHomePage() {
  return (
    <Container className="py-14 sm:py-20">
      <section className="rounded-xl2 border border-brand-border bg-white p-6 shadow-panel dark:border-slate-700 dark:bg-slate-900">
        <h1 className="text-2xl font-bold text-brand-navy dark:text-slate-100">منصة المكتب</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          هذه مساحة محمية. في المرحلة الحالية تم تجهيز البنية الأساسية للمصادقة والحماية.
        </p>

        <form action={signOutAction} className="mt-6">
          <button type="submit" className={buttonVariants('outline', 'md')}>
            تسجيل الخروج
          </button>
        </form>
      </section>
    </Container>
  );
}
