import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'لوحة الإدارة — مسار المحامي',
    robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
            <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
                <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
                    <div className="flex items-center gap-3">
                        <span className="text-lg font-bold text-brand-navy dark:text-slate-100">مسار المحامي</span>
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-900/40 dark:text-red-300">
                            مدير النظام
                        </span>
                    </div>
                    <nav className="flex items-center gap-4 text-sm">
                        <a href="/admin" className="text-slate-600 hover:text-brand-navy dark:text-slate-300">
                            الرئيسية
                        </a>
                        <a href="/admin/requests" className="text-slate-600 hover:text-brand-navy dark:text-slate-300">
                            طلبات الاشتراك
                        </a>
                        <a href="/admin/users" className="text-slate-600 hover:text-brand-navy dark:text-slate-300">
                            المستخدمون
                        </a>
                        <a href="/admin/orgs" className="text-slate-600 hover:text-brand-navy dark:text-slate-300">
                            المكاتب
                        </a>
                        <a href="/admin/audit" className="text-slate-600 hover:text-brand-navy dark:text-slate-300">
                            سجل التدقيق
                        </a>
                        <a href="/app" className="text-slate-400 hover:text-slate-600 dark:text-slate-500">
                            ← المنصة
                        </a>
                    </nav>
                </div>
            </header>
            <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
        </div>
    );
}
