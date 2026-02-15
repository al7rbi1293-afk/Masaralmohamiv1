'use client';

import { useEffect, useState } from 'react';

type AuditLog = {
    id: string;
    org_id: string | null;
    user_id: string | null;
    action: string;
    entity_type: string | null;
    entity_id: string | null;
    meta: Record<string, unknown>;
    created_at: string;
};

export default function AdminAuditPage() {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/admin/api/audit')
            .then((r) => r.json())
            .then((d) => setLogs(d.logs ?? []))
            .finally(() => setLoading(false));
    }, []);

    const actionLabel = (a: string) => {
        const map: Record<string, string> = {
            subscription_approved: 'قبول اشتراك',
            subscription_rejected: 'رفض اشتراك',
            user_suspended: 'تعليق مستخدم',
            user_activated: 'تفعيل مستخدم',
            org_suspended: 'تعليق مكتب',
            org_activated: 'تفعيل مكتب',
        };
        return map[a] || a;
    };

    if (loading) {
        return <div className="animate-pulse text-slate-500">جارٍ التحميل...</div>;
    }

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-brand-navy dark:text-slate-100">سجل التدقيق</h1>

            {logs.length === 0 ? (
                <p className="text-sm text-slate-500">لا توجد سجلات بعد.</p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                        <thead className="border-b border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300">
                            <tr>
                                <th className="py-3 text-start font-medium">الإجراء</th>
                                <th className="py-3 text-start font-medium">النوع</th>
                                <th className="py-3 text-start font-medium">التفاصيل</th>
                                <th className="py-3 text-start font-medium">التاريخ</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {logs.map((log) => (
                                <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                    <td className="py-3 font-medium">{actionLabel(log.action)}</td>
                                    <td className="py-3">{log.entity_type ?? '—'}</td>
                                    <td className="py-3 text-xs text-slate-500">
                                        {JSON.stringify(log.meta).slice(0, 100)}
                                    </td>
                                    <td className="py-3">
                                        {new Date(log.created_at).toLocaleString('ar-SA')}
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
