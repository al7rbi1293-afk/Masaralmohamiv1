'use client';

import { useEffect, useState } from 'react';

type User = {
    user_id: string;
    full_name: string;
    phone: string | null;
    status: string;
    created_at: string;
    memberships: Array<{
        org_id: string;
        role: string;
        organizations: { name: string; status: string } | null;
    }>;
};

export default function AdminUsersPage() {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionId, setActionId] = useState<string | null>(null);

    useEffect(() => {
        fetch('/admin/api/users')
            .then((r) => r.json())
            .then((d) => setUsers(d.users ?? []))
            .finally(() => setLoading(false));
    }, []);

    async function handleAction(userId: string, action: 'suspend' | 'activate') {
        setActionId(userId);
        await fetch('/admin/api/users', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId, action }),
        });
        const res = await fetch('/admin/api/users');
        const data = await res.json();
        setUsers(data.users ?? []);
        setActionId(null);
    }

    if (loading) {
        return <div className="animate-pulse text-slate-500">جارٍ التحميل...</div>;
    }

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-brand-navy dark:text-slate-100">المستخدمون</h1>

            {users.length === 0 ? (
                <p className="text-sm text-slate-500">لا يوجد مستخدمون.</p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                        <thead className="border-b border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300">
                            <tr>
                                <th className="py-3 text-start font-medium">الاسم</th>
                                <th className="py-3 text-start font-medium">المكتب</th>
                                <th className="py-3 text-start font-medium">الدور</th>
                                <th className="py-3 text-start font-medium">الحالة</th>
                                <th className="py-3 text-start font-medium">التسجيل</th>
                                <th className="py-3 text-start font-medium">إجراءات</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {users.map((u) => {
                                const m = Array.isArray(u.memberships) ? u.memberships[0] : null;
                                return (
                                    <tr key={u.user_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                        <td className="py-3 font-medium">{u.full_name || '—'}</td>
                                        <td className="py-3">{m?.organizations?.name ?? '—'}</td>
                                        <td className="py-3">{m?.role ?? '—'}</td>
                                        <td className="py-3">
                                            <span
                                                className={`rounded-full px-2 py-0.5 text-xs font-medium ${u.status === 'suspended'
                                                        ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                                                        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                                                    }`}
                                            >
                                                {u.status === 'suspended' ? 'معلّق' : 'نشط'}
                                            </span>
                                        </td>
                                        <td className="py-3">{new Date(u.created_at).toLocaleDateString('ar-SA')}</td>
                                        <td className="py-3">
                                            {u.status === 'active' ? (
                                                <button
                                                    disabled={actionId === u.user_id}
                                                    onClick={() => handleAction(u.user_id, 'suspend')}
                                                    className="rounded bg-red-600 px-3 py-1 text-xs text-white hover:bg-red-700 disabled:opacity-50"
                                                >
                                                    تعليق
                                                </button>
                                            ) : (
                                                <button
                                                    disabled={actionId === u.user_id}
                                                    onClick={() => handleAction(u.user_id, 'activate')}
                                                    className="rounded bg-emerald-600 px-3 py-1 text-xs text-white hover:bg-emerald-700 disabled:opacity-50"
                                                >
                                                    تفعيل
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
