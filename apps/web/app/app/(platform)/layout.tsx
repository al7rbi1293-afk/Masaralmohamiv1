import type { Metadata } from 'next';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { signOutAction } from '@/app/app/actions';
import { Container } from '@/components/ui/container';
import { getCurrentAuthUser } from '@/lib/supabase/auth-session';
import { isUserAppAdmin } from '@/lib/admin';
import {
  LayoutDashboard,
  Search,
  Calendar,
  Users,
  Briefcase,
  Bot,
  FileText,
  CheckSquare,
  Receipt,
  BarChart3,
  History,
  Settings,
  ShieldAlert,
  LogOut
} from 'lucide-react';
import Image from 'next/image';
import { OfficeLogoImage } from '@/components/branding/office-logo-image';
import { getCurrentOrgIdForUserId } from '@/lib/org';
import { getLinkedPartnerForUserId } from '@/lib/partners/access';
import { isPartnerOnlyUser, isPartnerUser } from '@/lib/partners/portal-routing';
import { createSupabaseServerRlsClient } from '@/lib/supabase/server';
import { getSupabaseOfficeLogoUrl, getSupabasePublicAssetUrl } from '@/lib/supabase/public-assets';

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
  { href: '/app/copilot', label: 'الذكاء الاصطناعي', icon: Bot },
  { href: '/app/documents', label: 'المستندات', icon: FileText },
  { href: '/app/tasks', label: 'المهام', icon: CheckSquare },
  { href: '/app/billing/invoices', label: 'الفوترة', icon: Receipt },
  { href: '/app/reports', label: 'التقارير', icon: BarChart3 },
  { href: '/app/audit', label: 'سجل التدقيق', icon: History },
  { href: '/app/settings', label: 'الإعدادات', icon: Settings },
] as const;

export default async function PlatformLayout({ children }: PlatformLayoutProps) {
  const user = await getCurrentAuthUser();

  if (!user) {
    redirect('/signin');
  }

  const activeOrgId = cookies().get('active_org_id')?.value ?? null;
  const [orgId, isAdmin, linkedPartner] = await Promise.all([
    getCurrentOrgIdForUserId(user.id, activeOrgId),
    isUserAppAdmin(user.id),
    getLinkedPartnerForUserId(user.id),
  ]);
  const partnerOnly = isPartnerOnlyUser({
    hasLinkedPartner: Boolean(linkedPartner),
    hasOrganization: Boolean(orgId),
    isAdmin,
  });
  const partnerUser = isPartnerUser({
    hasLinkedPartner: Boolean(linkedPartner),
    isAdmin,
  });

  // Fetch org data for customized branding
  let orgName = 'مسار المحامي';
  let orgLogo = '';
  let orgLogoFallback = '';
  const defaultBrandName = 'مسار المحامي';

  if (orgId) {
    const supabase = createSupabaseServerRlsClient();
    const { data } = await supabase
      .from('organizations')
      .select('name, logo_url')
      .eq('id', orgId)
      .maybeSingle();

    if (data) {
      orgName = data.name || orgName;
      const rawLogoUrl = String(data.logo_url || '').trim();
      orgLogo = getSupabaseOfficeLogoUrl(rawLogoUrl, 80);
      orgLogoFallback = getSupabasePublicAssetUrl(rawLogoUrl);
    }
  }

  const navItems: { href: string; label: string; icon: any }[] = partnerOnly
    ? [{ href: '/app/partners', label: 'بوابة الشريك', icon: LayoutDashboard }]
    : navItemsBase
        .filter((item) => (item.href === '/app/copilot' ? isAdmin : true))
        .map((item) => ({ ...item }));

  if (partnerUser && !partnerOnly) {
    navItems.unshift({ href: '/app/partners', label: 'بوابة الشريك', icon: LayoutDashboard });
  }

  // Add Admin Panel link if user is an admin
  if (isAdmin) {
    navItems.unshift({ href: '/admin', label: 'إدارة النظام الرئيسي', icon: ShieldAlert });
  }

  const platformLabel = partnerOnly ? 'شركاء النجاح' : 'منصة العمليات';

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-brand-background dark:bg-slate-950">
      {/* Modern Sticky Glass Header */}
      <header className="sticky top-0 z-40 w-full border-b border-brand-border/60 bg-white/70 backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/70">
        <Container className="flex min-h-16 items-center justify-between gap-3 py-2 sm:min-h-20 sm:py-3">
          <div className="flex min-w-0 items-center gap-3">
            {orgLogo ? (
              <div className="relative flex h-10 w-10 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-white p-0.5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                <OfficeLogoImage
                  src={orgLogo}
                  fallbackSrc={orgLogoFallback}
                  alt={orgName}
                  sizes="40px"
                  className="object-contain"
                  onMissing={<Briefcase className="h-5 w-5 text-slate-400 dark:text-slate-500" />}
                />
              </div>
            ) : orgName !== defaultBrandName ? (
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-emerald text-white shadow-sm">
                <Briefcase className="h-5 w-5" />
              </div>
            ) : null}
            <div className="min-w-0">
              {orgName === defaultBrandName ? (
                <Image
                  src="/masar-logo.png"
                  alt={orgName}
                  width={600}
                  height={400}
                  className="h-11 w-auto sm:h-14"
                  sizes="(max-width: 640px) 170px, 230px"
                  priority
                />
              ) : (
                <h1 className="truncate text-sm font-bold tracking-tight text-brand-navy dark:text-slate-100 sm:text-base">
                  {orgName}
                </h1>
              )}
              <p className="truncate text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {platformLabel}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <div className="hidden text-sm font-medium text-slate-600 dark:text-slate-300 sm:block">
              {user.email}
            </div>
            <form action={signOutAction}>
              <button
                type="submit"
                className="flex h-10 min-w-10 items-center justify-center rounded-md border border-slate-200 bg-white px-2.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-950 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-50 dark:focus-visible:ring-slate-300 sm:px-3"
                title="تسجيل الخروج"
              >
                <LogOut className="h-4 w-4 shrink-0 sm:ms-2" />
                <span className="hidden sm:inline-block">خروج</span>
              </button>
            </form>
          </div>
        </Container>
      </header>

      <Container className="py-4 sm:py-6 lg:py-8">
        <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)] lg:items-start lg:gap-8">

          {/* Mobile Horizontal Nav + Desktop Sidebar */}
          <aside className="h-fit rounded-xl2 border border-brand-border bg-white shadow-panel dark:border-slate-800 dark:bg-slate-900">
            <nav
              aria-label="التنقل داخل المنصة"
              className="horizontal-scroll-nav flex gap-2 overflow-x-auto p-2 lg:flex-col lg:gap-1 lg:overflow-visible lg:p-3"
            >
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="group inline-flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-lg border border-transparent px-3 py-2.5 text-sm font-medium text-slate-600 transition-all hover:border-brand-border hover:bg-slate-50 hover:text-brand-navy dark:text-slate-400 dark:hover:border-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-100 lg:flex lg:w-full lg:items-center"
                  >
                    <Icon className="h-4 w-4 shrink-0 text-slate-400 transition-colors group-hover:text-brand-emerald dark:text-slate-500 dark:group-hover:text-emerald-400" />
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
