'use client';

import { useEffect, useState } from 'react';

type SubRequest = {
    id: string;
    org_id: string;
    plan_requested: string;
    duration_months: number;
    payment_method: string | null;
    payment_reference: string | null;
    status: string;
    notes: string | null;
    requested_at: string;
    organizations: { name: string } | null;
    profiles: { full_name: string } | null;
};

export default function AdminRequestsPage() {
    const [requests, setRequests] = useState<SubRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionId, setActionId] = useState<string | null>(null);

    useEffect(() => {
        fetch('/admin/api/requests')
            .then((r) => r.json())
            .then((d) => setRequests(d.requests ?? []))
            .finally(() => setLoading(false));
    }, []);

    async function handleAction(id: string, action: 'approve' | 'reject') {
        const notes = action === 'reject' ? prompt('سبب الرفض (اختياري):') : null;
        setActionId(id);
        await fetch('/admin/api/requests', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, action, notes }),
        });
        // Refresh
        const res = await fetch('/admin/api/requests');
        const data = await res.json();
        setRequests(data.requests ?? []);
        setActionId(null);
    }

    const statusBadge = (s: string) => {
        if (s === 'approved') return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300';
        if (s === 'rejected') return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
    };

    const statusLabel = (s: string) => {
        if (s === 'approved') return 'مقبول';
        if (s === 'rejected') return 'مرفوض';
        return 'قيد الانتظار';
    };

    if (loading) {
        return <div className="animate-pulse text-slate-500">جارٍ التحميل...</div>;
    }

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-brand-navy dark:text-slate-100">طلبات الاشتراك</h1>

            {requests.length === 0 ? (
                <p className="text-sm text-slate-500">لا توجد طلبات بعد.</p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                        <thead className="border-b border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300">
                            <tr>
                                <th className="py-3 text-start font-medium">المكتب</th>
                                <th className="py-3 text-start font-medium">مقدم الطلب</th>
                                <th className="py-3 text-start font-medium">الخطة</th>
                                <th className="py-3 text-start font-medium">المدة</th>
                                <th className="py-3 text-start font-medium">المرجع</th>
                                <th className="py-3 text-start font-medium">الحالة</th>
                                <th className="py-3 text-start font-medium">التاريخ</th>
                                <th className="py-3 text-start font-medium">إجراءات</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {requests.map((req) => (
                                <tr key={req.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                    <td className="py-3 font-medium">{req.organizations?.name ?? '—'}</td>
                                    <td className="py-3">{req.profiles?.full_name ?? '—'}</td>
                                    <td className="py-3">{req.plan_requested}</td>
                                    <td className="py-3">{req.duration_months} شهر</td>
                                    <td className="py-3">{req.payment_reference ?? '—'}</td>
                                    <td className="py-3">
                                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge(req.status)}`}>
                                            {statusLabel(req.status)}
                                        </span>
                                    </td>
                                    <td className="py-3">{new Date(req.requested_at).toLocaleDateString('ar-SA')}</td>
                                    <td className="py-3">
                                        {req.status === 'pending' ? (
                                            <div className="flex gap-2">
                                                <button
                                                    disabled={actionId === req.id}
                                                    onClick={() => handleAction(req.id, 'approve')}
                                                    className="rounded bg-emerald-600 px-3 py-1 text-xs text-white hover:bg-emerald-700 disabled:opacity-50"
                                                >
                                                    قبول
                                                </button>
                                                <button
                                                    disabled={actionId === req.id}
                                                    onClick={() => handleAction(req.id, 'reject')}
                                                    className="rounded bg-red-600 px-3 py-1 text-xs text-white hover:bg-red-700 disabled:opacity-50"
                                                >
                                                    رفض
                                                </button>
                                            </div>
                                        ) : (
                                            <span className="text-xs text-slate-400">{req.notes ?? '—'}</span>
                                        )}
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
