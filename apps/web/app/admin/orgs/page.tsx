'use client';

import { useEffect, useState } from 'react';

type Org = {
    id: string;
    name: string;
    status: string;
    created_at: string;
    members_count: number;
    subscription: {
        plan: string | null;
        status: string;
        payment_status: string;
        current_period_end: string | null;
    } | null;
    trial: {
        ends_at: string | null;
        status: string;
    } | null;
};

export default function AdminOrgsPage() {
    const [orgs, setOrgs] = useState<Org[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionId, setActionId] = useState<string | null>(null);

    useEffect(() => {
        fetch('/admin/api/orgs')
            .then((r) => r.json())
            .then((d) => setOrgs(d.orgs ?? []))
            .finally(() => setLoading(false));
    }, []);

    async function handleAction(orgId: string, action: 'suspend' | 'activate' | 'grant_lifetime' | 'extend_trial') {
        const proceed = action === 'grant_lifetime' ? window.confirm('هل أنت متأكد من منح هذا المكتب اشتراك مدى الحياة؟') : true;
        if (!proceed) return;

        setActionId(orgId);
        await fetch('/admin/api/orgs', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ org_id: orgId, action }),
        });
        const res = await fetch('/admin/api/orgs');
        const data = await res.json();
        setOrgs(data.orgs ?? []);
        setActionId(null);
    }

    if (loading) {
        return <div className="animate-pulse text-slate-500">جارٍ التحميل...</div>;
    }

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-brand-navy dark:text-slate-100">المكاتب</h1>

            {orgs.length === 0 ? (
                <p className="text-sm text-slate-500">لا توجد مكاتب.</p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                        <thead className="border-b border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300">
                            <tr>
                                <th className="py-3 text-start font-medium">اسم المكتب</th>
                                <th className="py-3 text-start font-medium">الأعضاء</th>
                                <th className="py-3 text-start font-medium">الخطة</th>
                                <th className="py-3 text-start font-medium">حالة الاشتراك</th>
                                <th className="py-3 text-start font-medium">حالة المكتب</th>
                                <th className="py-3 text-start font-medium">الانتهاء</th>
                                <th className="py-3 text-start font-medium">إجراءات</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {orgs.map((org) => (
                                <tr key={org.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                    <td className="py-3 font-medium">{org.name}</td>
                                    <td className="py-3">{org.members_count}</td>
                                    <td className="py-3">{org.subscription?.plan ?? 'تجريبي'}</td>
                                    <td className="py-3">{org.subscription?.status ?? '—'}</td>
                                    <td className="py-3">
                                        <span
                                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${org.status === 'suspended'
                                                ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                                                : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                                                }`}
                                        >
                                            {org.status === 'suspended' ? 'معلّق' : 'نشط'}
                                        </span>
                                    </td>
                                    <td className="py-3">
                                        {org.subscription?.current_period_end
                                            ? new Date(org.subscription.current_period_end).toLocaleDateString('ar-SA')
                                            : org.trial?.ends_at
                                                ? new Date(org.trial.ends_at).toLocaleDateString('ar-SA')
                                                : '—'}
                                    </td>
                                    <td className="py-3 space-x-reverse space-x-2">
                                        {org.status === 'active' ? (
                                            <button
                                                disabled={actionId === org.id}
                                                onClick={() => handleAction(org.id, 'suspend')}
                                                className="rounded bg-red-600 px-3 py-1 text-xs text-white hover:bg-red-700 disabled:opacity-50"
                                            >
                                                تعليق
                                            </button>
                                        ) : (
                                            <button
                                                disabled={actionId === org.id}
                                                onClick={() => handleAction(org.id, 'activate')}
                                                className="rounded bg-emerald-600 px-3 py-1 text-xs text-white hover:bg-emerald-700 disabled:opacity-50"
                                            >
                                                تفعيل
                                            </button>
                                        )}
                                        <button
                                            disabled={actionId === org.id}
                                            onClick={() => handleAction(org.id, 'extend_trial')}
                                            className="rounded bg-brand-navy px-3 py-1 text-xs text-white hover:bg-brand-navy/90 disabled:opacity-50"
                                        >
                                            تمديد 14 يوم
                                        </button>
                                        <button
                                            disabled={actionId === org.id}
                                            onClick={() => handleAction(org.id, 'grant_lifetime')}
                                            className="rounded bg-amber-600 px-3 py-1 text-xs text-white hover:bg-amber-700 disabled:opacity-50"
                                        >
                                            طوال الحياة
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
