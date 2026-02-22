import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { signOutAction } from '@/app/app/actions';
import { Container } from '@/components/ui/container';
import { SentryClientInit } from '@/components/observability/sentry-client-init';
import { getCurrentAuthUser } from '@/lib/supabase/auth-session';
import { isAppAdmin } from '@/lib/admin';
import {
    LayoutDashboard,
    Users,
    Building,
    History,
    LogOut,
    ShieldAlert
} from 'lucide-react';

export const metadata: Metadata = {
    title: 'لوحة الإدارة — مسار المحامي',
    robots: { index: false, follow: false },
};

type AdminLayoutProps = {
    children: React.ReactNode;
};

const navItems = [
    { href: '/admin', label: 'الرئيسية', icon: LayoutDashboard },
    { href: '/admin/requests', label: 'طلبات الاشتراك', icon: ShieldAlert },
    { href: '/admin/users', label: 'المستخدمون', icon: Users },
    { href: '/admin/orgs', label: 'المكاتب', icon: Building },
    { href: '/admin/audit', label: 'سجل التدقيق', icon: History },
] as const;

export default async function AdminLayout({ children }: AdminLayoutProps) {
    const user = await getCurrentAuthUser();

    if (!user) {
        redirect('/signin');
    }

    const isAdmin = await isAppAdmin();
    if (!isAdmin) {
        redirect('/app');
    }

    return (
        <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-brand-background dark:bg-slate-950">
            <SentryClientInit />

            {/* Modern Sticky Glass Header */}
            <header className="sticky top-0 z-40 w-full border-b border-brand-border/60 bg-white/70 backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/70">
                <Container className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-600 text-white shadow-sm">
                            <ShieldAlert className="h-5 w-5" />
                        </div>
                        <div>
                            <h1 className="text-base font-bold tracking-tight text-brand-navy dark:text-slate-100 flex items-center gap-2">
                                مسار المحامي
                                <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700 dark:bg-red-900/40 dark:text-red-300">
                                    مدير النظام
                                </span>
                            </h1>
                            <p className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                لوحة الإدارة المركزية
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <Link
                            href="/app"
                            className="hidden text-sm font-medium text-slate-500 hover:text-brand-navy dark:text-slate-400 dark:hover:text-slate-200 sm:block"
                        >
                            ← العودة للمنصة
                        </Link>
                        <div className="hidden h-5 w-px bg-slate-200 dark:bg-slate-800 sm:block"></div>
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
                        <nav aria-label="التنقل داخل الإدارة" className="flex flex-col gap-1 p-3">
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

                            {/* Mobile only visible back-to-app button */}
                            <div className="my-2 h-px w-full bg-slate-100 dark:bg-slate-800/60 sm:hidden"></div>
                            <Link
                                href="/app"
                                className="group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-500 transition-all hover:bg-slate-50 hover:text-brand-navy dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 sm:hidden"
                            >
                                ← العودة للمنصة
                            </Link>
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
