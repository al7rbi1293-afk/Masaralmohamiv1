'use client';

import { useEffect, useState } from 'react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as RechartsTooltip,
    ResponsiveContainer,
    AreaChart,
    Area
} from 'recharts';
import { ShieldAlert, Users, Building, History, ExternalLink, Activity, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import type { TabId } from '../page';

type OverviewStats = {
    stats: {
        activeOrgs: number;
        suspendedOrgs: number;
        activeUsers: number;
        suspendedUsers: number;
        activeSubscriptions: number;
        trialOrgs: number;
    };
    timeline: {
        date: string;
        new_signups: number;
    }[];
};

export default function OverviewTab({ onNavigate }: { onNavigate: (tab: TabId) => void }) {
    const [data, setData] = useState<OverviewStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetch('/admin/api/overview')
            .then(res => {
                if (!res.ok) throw new Error('تعذر جلب الإحصائيات');
                return res.json();
            })
            .then(setData)
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div className="space-y-6 animate-pulse">
                <div className="h-24 bg-slate-200 dark:bg-slate-800 rounded-xl"></div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="h-32 bg-slate-200 dark:bg-slate-800 rounded-xl"></div>
                    ))}
                </div>
                <div className="h-80 bg-slate-200 dark:bg-slate-800 rounded-xl"></div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/10 dark:text-red-300">
                <h3 className="font-bold text-lg mb-2">تعذر جلب البيانات</h3>
                <p>{error || 'حدث خطأ غير معروف'}</p>
            </div>
        );
    }

    const { stats, timeline } = data;
    const totalOrgs = stats.activeOrgs + stats.suspendedOrgs;
    const totalUsers = stats.activeUsers + stats.suspendedUsers;

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-brand-navy dark:text-slate-100">نظرة عامة على النظام</h1>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        إحصائيات مباشرة لمنصة مسار المحامي (أخر 30 يوم).
                    </p>
                </div>

                {/* Quick Links Compact Row */}
                <div className="flex gap-2">
                    <button onClick={() => onNavigate('requests')} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 flex items-center gap-2">
                        <ShieldAlert className="h-3.5 w-3.5 text-orange-500" />
                        الطلبات
                    </button>
                    <button onClick={() => onNavigate('orgs')} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 flex items-center gap-2">
                        <Building className="h-3.5 w-3.5 text-emerald-500" />
                        المكاتب
                    </button>
                    <button onClick={() => onNavigate('users')} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 flex items-center gap-2">
                        <Users className="h-3.5 w-3.5 text-blue-500" />
                        المستخدمين
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">إجمالي المكاتب</p>
                        <Building className="h-4 w-4 text-emerald-500" />
                    </div>
                    <div className="mt-2 flex items-baseline gap-2">
                        <p className="text-3xl font-bold text-slate-900 dark:text-white">{totalOrgs}</p>
                        <span className="text-sm text-slate-500">مكتب</span>
                    </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">إجمالي المستخدمين</p>
                        <Users className="h-4 w-4 text-blue-500" />
                    </div>
                    <div className="mt-2 flex items-baseline gap-2">
                        <p className="text-3xl font-bold text-slate-900 dark:text-white">{totalUsers}</p>
                        <span className="text-sm text-slate-500">حساب</span>
                    </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">الاشتراكات الفعالة</p>
                        <ShieldAlert className="h-4 w-4 text-brand-emerald" />
                    </div>
                    <div className="mt-2 flex items-baseline gap-2">
                        <p className="text-3xl font-bold text-slate-900 dark:text-white">{stats.activeSubscriptions}</p>
                        <span className="text-sm text-slate-500">خطة برو</span>
                    </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">النسخ التجريبية</p>
                        <Activity className="h-4 w-4 text-orange-500" />
                    </div>
                    <div className="mt-2 flex items-baseline gap-2">
                        <p className="text-3xl font-bold text-slate-900 dark:text-white">{stats.trialOrgs}</p>
                        <span className="text-sm text-slate-500">مكتب (للتفعيل)</span>
                    </div>
                </div>
            </div>

            {/* Chart Section */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="mb-6 flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-bold text-brand-navy dark:text-slate-100">نمو المكاتب الجديدة</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">التسجيلات الجديدة في أخر 30 يوماً</p>
                    </div>
                </div>

                <div className="h-[300px] w-full" dir="ltr">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={timeline} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorSignups" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                            <XAxis
                                dataKey="date"
                                tickFormatter={(str: string) => {
                                    const date = new Date(str);
                                    return date.toLocaleDateString('ar-SA', { day: 'numeric', month: 'short' });
                                }}
                                tick={{ fontSize: 12, fill: '#64748b' }}
                                tickLine={false}
                                axisLine={false}
                            />
                            <YAxis
                                tick={{ fontSize: 12, fill: '#64748b' }}
                                tickLine={false}
                                axisLine={false}
                                allowDecimals={false}
                            />
                            <RechartsTooltip
                                contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                labelFormatter={(label: any) => new Date(label).toLocaleDateString('ar-SA')}
                                formatter={(value: any) => [value, 'تسجيل جديد']}
                            />
                            <Area
                                type="monotone"
                                dataKey="new_signups"
                                stroke="#10b981"
                                strokeWidth={2}
                                fillOpacity={1}
                                fill="url(#colorSignups)"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
}
