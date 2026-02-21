import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { signOutAction } from '@/app/app/actions';
import { buttonVariants } from '@/components/ui/button';
import { Container } from '@/components/ui/container';
import { SentryClientInit } from '@/components/observability/sentry-client-init';
import { getCurrentAuthUser } from '@/lib/supabase/auth-session';
import { isAppAdmin } from '@/lib/admin';
import {
  LayoutDashboard,
  Search,
  Calendar,
  Users,
  Briefcase,
  FileText,
  CheckSquare,
  Receipt,
  BarChart3,
  History,
  Settings,
  ShieldAlert,
  LogOut
} from 'lucide-react';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

type PlatformLayoutProps = {
  children: React.ReactNode;
};

const navItemsBase = [
  { href: '/app', label: 'لوحة التحكم', icon: LayoutDashboard },
  { href: '/app/search', label: 'البحث', icon: Search },
  { href: '/app/calendar', label: 'التقويم', icon: Calendar },
  { href: '/app/clients', label: 'العملاء', icon: Users },
  { href: '/app/matters', label: 'القضايا', icon: Briefcase },
  { href: '/app/documents', label: 'المستندات', icon: FileText },
  { href: '/app/tasks', label: 'المهام', icon: CheckSquare },
  { href: '/app/billing/invoices', label: 'الفوترة', icon: Receipt },
  { href: '/app/reports', label: 'التقارير', icon: BarChart3 },
  { href: '/app/audit', label: 'سجل التدقيق', icon: History },
  { href: '/app/settings', label: 'الإعدادات', icon: Settings },
] as const;

import { getTrialStatusForCurrentUser } from '@/lib/trial';
import { createSupabaseServerRlsClient } from '@/lib/supabase/server';
import Image from 'next/image';

export default async function PlatformLayout({ children }: PlatformLayoutProps) {
  const user = await getCurrentAuthUser();

  if (!user) {
    redirect('/signin');
  }

  // Fetch org data for customized branding
  const trial = await getTrialStatusForCurrentUser();
  const orgId = trial.orgId;
  let orgName = 'مسار المحامي';
  let orgLogo = '';

  if (orgId) {
    const supabase = createSupabaseServerRlsClient();
    const { data } = await supabase
      .from('organizations')
      .select('name, logo_url')
      .eq('id', orgId)
      .maybeSingle();

    if (data) {
      orgName = data.name || orgName;
      orgLogo = data.logo_url || '';
    }
  }

  // Create a mutable type-widened copy of nav items
  const navItems: { href: string; label: string; icon: any }[] = [...navItemsBase];

  // Add Admin Panel link if user is an admin
  const isAdmin = await isAppAdmin();
  if (isAdmin) {
    navItems.unshift({ href: '/admin', label: 'إدارة النظام الرئيسي', icon: ShieldAlert });
  }

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-brand-background dark:bg-slate-950">
      <SentryClientInit />

      {/* Modern Sticky Glass Header */}
      <header className="sticky top-0 z-40 w-full border-b border-brand-border/60 bg-white/70 backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/70">
        <Container className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            {orgLogo ? (
              <div className="relative flex h-10 w-10 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-white p-0.5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                <Image src={orgLogo} alt={orgName} fill className="object-contain" unoptimized />
              </div>
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-emerald text-white shadow-sm">
                <Briefcase className="h-5 w-5" />
              </div>
            )}
            <div>
              <h1 className="text-base font-bold tracking-tight text-brand-navy dark:text-slate-100">{orgName}</h1>
              <p className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                منصة العمليات
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden text-sm font-medium text-slate-600 dark:text-slate-300 sm:block">
              {user.email}
            </div>
            <form action={signOutAction}>
              <button
                type="submit"
                className="flex h-9 items-center justify-center rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-950 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-50 dark:focus-visible:ring-slate-300"
                title="تسجيل الخروج"
              >
                <LogOut className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline-block">خروج</span>
              </button>
            </form>
          </div>
        </Container>
      </header>

      <Container className="px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[260px_minmax(0,1fr)] lg:items-start">

          {/* Modernized Floating Sidebar */}
          <aside className="h-fit rounded-xl2 border border-brand-border bg-white shadow-panel dark:border-slate-800 dark:bg-slate-900">
            <nav aria-label="التنقل داخل المنصة" className="flex flex-col gap-1 p-3">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 transition-all hover:bg-slate-50 hover:text-brand-navy dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                  >
                    <Icon className="h-4 w-4 text-slate-400 transition-colors group-hover:text-brand-emerald dark:text-slate-500 dark:group-hover:text-emerald-400" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </aside>

          {/* Main Content Area */}
          <main className="min-w-0 w-full overflow-x-hidden">
            {children}
          </main>

        </div>
      </Container>
    </div>
  );
}
