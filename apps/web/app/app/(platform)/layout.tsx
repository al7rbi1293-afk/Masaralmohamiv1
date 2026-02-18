import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { signOutAction } from '@/app/app/actions';
import { buttonVariants } from '@/components/ui/button';
import { Container } from '@/components/ui/container';
import { SentryClientInit } from '@/components/observability/sentry-client-init';
import { getCurrentAuthUser } from '@/lib/supabase/auth-session';
import { isAppAdmin } from '@/lib/admin';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

type PlatformLayoutProps = {
  children: React.ReactNode;
};

const navItemsBase = [
  { href: '/app', label: 'لوحة التحكم' },
  { href: '/app/search', label: 'البحث' },
  { href: '/app/calendar', label: 'التقويم' },
  { href: '/app/clients', label: 'العملاء' },
  { href: '/app/matters', label: 'القضايا' },
  { href: '/app/documents', label: 'المستندات' },
  { href: '/app/tasks', label: 'المهام' },
  { href: '/app/billing/invoices', label: 'الفوترة' },
  { href: '/app/reports', label: 'التقارير' },
  { href: '/app/audit', label: 'سجل التدقيق' },
  { href: '/app/settings', label: 'الإعدادات' },
] as const;

export default async function PlatformLayout({ children }: PlatformLayoutProps) {
  const user = await getCurrentAuthUser();

  if (!user) {
    redirect('/signin');
  }

  // Create a mutable copy of nav items
  const navItems: { href: string; label: string }[] = [...navItemsBase];

  // Add Admin Panel link if user is an admin
  const isAdmin = await isAppAdmin();
  if (isAdmin) {
    navItems.unshift({ href: '/admin', label: 'لوحة الإدارة 🛡️' });
  }

  return (
    <Container className="py-8 sm:py-10">
      <SentryClientInit />
      <section className="rounded-xl2 border border-brand-border bg-white shadow-panel dark:border-slate-700 dark:bg-slate-900">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-brand-border px-5 py-4 dark:border-slate-700">
          <div>
            <h1 className="text-lg font-bold text-brand-navy dark:text-slate-100">مسار المحامي</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              منصة المكتب
            </p>
          </div>

          <div className="flex items-center gap-3">
            <p className="text-sm text-slate-600 dark:text-slate-300">{user.email}</p>
            <form action={signOutAction}>
              <button type="submit" className={buttonVariants('outline', 'sm')}>
                تسجيل الخروج
              </button>
            </form>
          </div>
        </header>

        <div className="grid gap-6 p-5 lg:grid-cols-[240px_1fr]">
          <aside className="rounded-lg border border-brand-border p-3 dark:border-slate-700">
            <nav aria-label="التنقل داخل المنصة" className="space-y-2">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="block rounded-lg px-3 py-2 text-sm text-slate-700 transition hover:bg-brand-background dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </aside>

          <main>{children}</main>
        </div>
      </section>
    </Container>
  );
}
