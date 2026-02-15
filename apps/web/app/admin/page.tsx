export default function AdminHomePage() {
    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-brand-navy dark:text-slate-100">لوحة الإدارة</h1>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <a
                    href="/admin/requests"
                    className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
                >
                    <p className="text-sm text-slate-500 dark:text-slate-400">طلبات الاشتراك</p>
                    <p className="mt-1 text-lg font-semibold text-brand-navy dark:text-slate-100">إدارة الطلبات</p>
                </a>
                <a
                    href="/admin/users"
                    className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
                >
                    <p className="text-sm text-slate-500 dark:text-slate-400">المستخدمون</p>
                    <p className="mt-1 text-lg font-semibold text-brand-navy dark:text-slate-100">إدارة المستخدمين</p>
                </a>
                <a
                    href="/admin/orgs"
                    className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
                >
                    <p className="text-sm text-slate-500 dark:text-slate-400">المكاتب</p>
                    <p className="mt-1 text-lg font-semibold text-brand-navy dark:text-slate-100">إدارة المكاتب</p>
                </a>
                <a
                    href="/admin/audit"
                    className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
                >
                    <p className="text-sm text-slate-500 dark:text-slate-400">سجل التدقيق</p>
                    <p className="mt-1 text-lg font-semibold text-brand-navy dark:text-slate-100">عرض السجل</p>
                </a>
            </div>
        </div>
    );
}
