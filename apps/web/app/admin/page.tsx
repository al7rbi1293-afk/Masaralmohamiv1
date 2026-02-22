'use client';

import { useState } from 'react';
import { ShieldAlert, Users, Building, History, LayoutDashboard } from 'lucide-react';
import RequestsTab from './_components/RequestsTab';
import UsersTab from './_components/UsersTab';
import OrgsTab from './_components/OrgsTab';
import AuditTab from './_components/AuditTab';
import OverviewTab from './_components/OverviewTab';

export type TabId = 'overview' | 'requests' | 'users' | 'orgs' | 'audit';

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


