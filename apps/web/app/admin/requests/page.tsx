'use client';

import { useEffect, useMemo, useState } from 'react';

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

type FullVersionRequest = {
    id: string;
    created_at: string;
    full_name: string | null;
    email: string;
    phone: string | null;
    firm_name: string | null;
    message: string | null;
    source: string;
    type: string | null;
};

type Lead = {
    id: string;
    created_at: string;
    full_name: string;
    email: string;
    phone: string | null;
    firm_name: string | null;
    topic: string | null;
    message: string | null;
    referrer: string | null;
};

type RequestsPayload = {
    requests?: SubRequest[];
    fullVersionRequests?: FullVersionRequest[];
    leads?: Lead[];
};

type RequestsTab = 'subscription' | 'activation' | 'leads';

export default function AdminRequestsPage() {
    const [requests, setRequests] = useState<SubRequest[]>([]);
    const [fullVersionRequests, setFullVersionRequests] = useState<FullVersionRequest[]>([]);
    const [leads, setLeads] = useState<Lead[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionId, setActionId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<RequestsTab>('subscription');
    const [loadError, setLoadError] = useState<string | null>(null);

    async function fetchRequests() {
        const res = await fetch('/admin/api/requests');
        const data: RequestsPayload = await res.json();

        if (!res.ok) {
            throw new Error((data as any).error ?? 'تعذر تحميل الطلبات.');
        }

        setRequests(data.requests ?? []);
        setFullVersionRequests(data.fullVersionRequests ?? []);
        setLeads(data.leads ?? []);
    }

    useEffect(() => {
        fetchRequests()
            .catch((error) => {
                const message = error instanceof Error ? error.message : 'تعذر تحميل الطلبات.';
                setLoadError(message);
            })
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
        await fetchRequests();
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

    const tabs = useMemo(
        () => [
            { id: 'subscription' as const, label: 'طلبات الاشتراك', count: requests.length },
            { id: 'activation' as const, label: 'طلبات التفعيل/الحذف', count: fullVersionRequests.length },
            { id: 'leads' as const, label: 'طلبات التسويق (Leads)', count: leads.length },
        ],
        [requests.length, fullVersionRequests.length, leads.length],
    );

    if (loading) {
        return <div className="animate-pulse text-slate-500">جارٍ التحميل...</div>;
    }

    if (loadError) {
        return (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/10 dark:text-red-300">
                {loadError}
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-brand-navy dark:text-slate-100">إدارة الطلبات</h1>

            <div className="flex flex-wrap gap-2">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                            activeTab === tab.id
                                ? 'border-brand-green bg-brand-green text-white'
                                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'
                        }`}
                    >
                        {tab.label}
                        <span className="ms-2 rounded-full bg-black/10 px-2 py-0.5 text-xs">{tab.count}</span>
                    </button>
                ))}
            </div>

            {activeTab === 'subscription' ? (
                requests.length === 0 ? (
                    <p className="text-sm text-slate-500">لا توجد طلبات اشتراك بعد.</p>
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
                )
            ) : null}

            {activeTab === 'activation' ? (
                fullVersionRequests.length === 0 ? (
                    <p className="text-sm text-slate-500">لا توجد طلبات تفعيل/حذف بعد.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead className="border-b border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300">
                                <tr>
                                    <th className="py-3 text-start font-medium">الاسم</th>
                                    <th className="py-3 text-start font-medium">البريد</th>
                                    <th className="py-3 text-start font-medium">المكتب</th>
                                    <th className="py-3 text-start font-medium">النوع</th>
                                    <th className="py-3 text-start font-medium">المصدر</th>
                                    <th className="py-3 text-start font-medium">الرسالة</th>
                                    <th className="py-3 text-start font-medium">التاريخ</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {fullVersionRequests.map((req) => (
                                    <tr key={req.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                        <td className="py-3 font-medium">{req.full_name ?? '—'}</td>
                                        <td className="py-3">{req.email}</td>
                                        <td className="py-3">{req.firm_name ?? '—'}</td>
                                        <td className="py-3">{req.type === 'delete_request' ? 'طلب حذف' : 'طلب تفعيل'}</td>
                                        <td className="py-3">{req.source}</td>
                                        <td className="py-3">{compactText(req.message)}</td>
                                        <td className="py-3">{new Date(req.created_at).toLocaleDateString('ar-SA')}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )
            ) : null}

            {activeTab === 'leads' ? (
                leads.length === 0 ? (
                    <p className="text-sm text-slate-500">لا توجد Leads بعد.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead className="border-b border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300">
                                <tr>
                                    <th className="py-3 text-start font-medium">الاسم</th>
                                    <th className="py-3 text-start font-medium">البريد</th>
                                    <th className="py-3 text-start font-medium">المكتب</th>
                                    <th className="py-3 text-start font-medium">الموضوع</th>
                                    <th className="py-3 text-start font-medium">الهاتف</th>
                                    <th className="py-3 text-start font-medium">الرسالة</th>
                                    <th className="py-3 text-start font-medium">التاريخ</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {leads.map((lead) => (
                                    <tr key={lead.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                        <td className="py-3 font-medium">{lead.full_name}</td>
                                        <td className="py-3">{lead.email}</td>
                                        <td className="py-3">{lead.firm_name ?? '—'}</td>
                                        <td className="py-3">{lead.topic ?? '—'}</td>
                                        <td className="py-3">{lead.phone ?? '—'}</td>
                                        <td className="py-3">{compactText(lead.message)}</td>
                                        <td className="py-3">{new Date(lead.created_at).toLocaleDateString('ar-SA')}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )
            ) : null}
        </div>
    );
}

function compactText(value: string | null, max = 120) {
    if (!value) return '—';
    const normalized = value.replace(/\s+/g, ' ').trim();
    if (normalized.length <= max) return normalized;
    return `${normalized.slice(0, max)}...`;
}
