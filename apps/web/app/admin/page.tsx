import { ShieldAlert, Users, Building, History } from 'lucide-react';
import Link from 'next/link';

export default function AdminHomePage() {
    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-2xl font-bold text-brand-navy dark:text-slate-100">مرحباً بك في لوحة الإدارة المركزية</h1>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                    من هنا يمكنك التحكم في جميع المكاتب والمستخدمين والاشتراكات.
                </p>
            </div>

            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                <Link
                    href="/admin/requests"
                    className="group relative overflow-hidden rounded-xl border border-brand-border bg-white p-6 shadow-panel transition-all hover:border-brand-emerald hover:shadow-lg dark:border-slate-800 dark:bg-slate-900 dark:hover:border-emerald-500/50"
                >
                    <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-orange-100 dark:bg-orange-500/20">
                            <ShieldAlert className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">طلبات الاشتراك</p>
                            <p className="mt-1 text-lg font-bold text-brand-navy dark:text-slate-100 group-hover:text-brand-emerald dark:group-hover:text-emerald-400 transition-colors">إدارة الطلبات</p>
                        </div>
                    </div>
                </Link>

                <Link
                    href="/admin/users"
                    className="group relative overflow-hidden rounded-xl border border-brand-border bg-white p-6 shadow-panel transition-all hover:border-brand-emerald hover:shadow-lg dark:border-slate-800 dark:bg-slate-900 dark:hover:border-emerald-500/50"
                >
                    <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-500/20">
                            <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">المستخدمون</p>
                            <p className="mt-1 text-lg font-bold text-brand-navy dark:text-slate-100 group-hover:text-brand-emerald dark:group-hover:text-emerald-400 transition-colors">إدارة المستخدمين</p>
                        </div>
                    </div>
                </Link>

                <Link
                    href="/admin/orgs"
                    className="group relative overflow-hidden rounded-xl border border-brand-border bg-white p-6 shadow-panel transition-all hover:border-brand-emerald hover:shadow-lg dark:border-slate-800 dark:bg-slate-900 dark:hover:border-emerald-500/50"
                >
                    <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-500/20">
                            <Building className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">المكاتب</p>
                            <p className="mt-1 text-lg font-bold text-brand-navy dark:text-slate-100 group-hover:text-brand-emerald dark:group-hover:text-emerald-400 transition-colors">إدارة المكاتب</p>
                        </div>
                    </div>
                </Link>

                <Link
                    href="/admin/audit"
                    className="group relative overflow-hidden rounded-xl border border-brand-border bg-white p-6 shadow-panel transition-all hover:border-brand-emerald hover:shadow-lg dark:border-slate-800 dark:bg-slate-900 dark:hover:border-emerald-500/50"
                >
                    <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
                            <History className="h-6 w-6 text-slate-600 dark:text-slate-400" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">سجل التدقيق</p>
                            <p className="mt-1 text-lg font-bold text-brand-navy dark:text-slate-100 group-hover:text-brand-emerald dark:group-hover:text-emerald-400 transition-colors">عرض السجل</p>
                        </div>
                    </div>
                </Link>
            </div>
        </div>
    );
}
