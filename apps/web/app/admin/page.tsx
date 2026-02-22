'use client';

import { useState } from 'react';
import { ShieldAlert, Users, Building, History, LayoutDashboard } from 'lucide-react';
import RequestsTab from './_components/RequestsTab';
import UsersTab from './_components/UsersTab';
import OrgsTab from './_components/OrgsTab';
import AuditTab from './_components/AuditTab';

type TabId = 'overview' | 'requests' | 'users' | 'orgs' | 'audit';

const navItems = [
    { id: 'overview', label: 'الرئيسية', icon: LayoutDashboard },
    { id: 'requests', label: 'طلبات الاشتراك', icon: ShieldAlert },
    { id: 'users', label: 'المستخدمون', icon: Users },
    { id: 'orgs', label: 'المكاتب', icon: Building },
    { id: 'audit', label: 'سجل التدقيق', icon: History },
] as const;

export default function AdminHomePage() {
    const [activeTab, setActiveTab] = useState<TabId>('overview');

    function renderActiveTab() {
        switch (activeTab) {
            case 'requests':
                return <RequestsTab />;
            case 'users':
                return <UsersTab />;
            case 'orgs':
                return <OrgsTab />;
            case 'audit':
                return <AuditTab />;
            case 'overview':
            default:
                return <OverviewTab onNavigate={setActiveTab} />;
        }
    }

    return (
        <div className="grid gap-8 lg:grid-cols-[260px_minmax(0,1fr)] lg:items-start">
            {/* Modernized Floating Sidebar */}
            <aside className="h-fit rounded-xl2 border border-brand-border bg-white shadow-panel dark:border-slate-800 dark:bg-slate-900">
                <nav aria-label="التنقل داخل الإدارة" className="flex flex-col gap-1 p-3">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = activeTab === item.id;
                        return (
                            <button
                                key={item.id}
                                onClick={() => setActiveTab(item.id)}
                                className={`group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${isActive
                                        ? 'bg-brand-emerald/10 text-brand-emerald dark:bg-emerald-500/20 dark:text-emerald-400'
                                        : 'text-slate-600 hover:bg-slate-50 hover:text-brand-navy dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100'
                                    }`}
                            >
                                <Icon
                                    className={`h-4 w-4 transition-colors ${isActive
                                            ? 'text-brand-emerald dark:text-emerald-400'
                                            : 'text-slate-400 group-hover:text-brand-emerald dark:text-slate-500 dark:group-hover:text-emerald-400'
                                        }`}
                                />
                                {item.label}
                            </button>
                        );
                    })}
                </nav>
            </aside>

            {/* Main Content Area */}
            <main className="min-w-0 w-full overflow-x-hidden">
                {renderActiveTab()}
            </main>
        </div>
    );
}

// Overview tab containing the modern entry cards
function OverviewTab({ onNavigate }: { onNavigate: (tab: TabId) => void }) {
    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-2xl font-bold text-brand-navy dark:text-slate-100">مرحباً بك في لوحة الإدارة المركزية</h1>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                    من هنا يمكنك التحكم في جميع المكاتب والمستخدمين والاشتراكات من صفحة واحدة.
                </p>
            </div>

            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                <button
                    onClick={() => onNavigate('requests')}
                    className="group relative overflow-hidden rounded-xl border border-brand-border bg-white p-6 shadow-panel transition-all hover:border-brand-emerald hover:shadow-lg dark:border-slate-800 dark:bg-slate-900 dark:hover:border-emerald-500/50 text-right"
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
                </button>

                <button
                    onClick={() => onNavigate('users')}
                    className="group relative overflow-hidden rounded-xl border border-brand-border bg-white p-6 shadow-panel transition-all hover:border-brand-emerald hover:shadow-lg dark:border-slate-800 dark:bg-slate-900 dark:hover:border-emerald-500/50 text-right"
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
                </button>

                <button
                    onClick={() => onNavigate('orgs')}
                    className="group relative overflow-hidden rounded-xl border border-brand-border bg-white p-6 shadow-panel transition-all hover:border-brand-emerald hover:shadow-lg dark:border-slate-800 dark:bg-slate-900 dark:hover:border-emerald-500/50 text-right"
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
                </button>

                <button
                    onClick={() => onNavigate('audit')}
                    className="group relative overflow-hidden rounded-xl border border-brand-border bg-white p-6 shadow-panel transition-all hover:border-brand-emerald hover:shadow-lg dark:border-slate-800 dark:bg-slate-900 dark:hover:border-emerald-500/50 text-right"
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
                </button>
            </div>
        </div>
    );
}
