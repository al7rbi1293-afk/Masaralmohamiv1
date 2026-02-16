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

type PendingUser = {
  user_id: string;
  email: string | null;
  created_at: string;
  older_than_3h: boolean;
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);

  async function loadUsers() {
    const res = await fetch('/admin/api/users');
    const data = await res.json();
    setUsers(data.users ?? []);
    setPendingUsers(data.pending ?? []);
  }

  useEffect(() => {
    loadUsers().finally(() => setLoading(false));
  }, []);

  async function handleAction(userId: string, action: 'suspend' | 'activate' | 'delete_pending') {
    setActionId(userId);
    await fetch('/admin/api/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, action }),
    });
    await loadUsers();
    setActionId(null);
  }

  async function handleDeletePending(user: PendingUser) {
    const proceed = window.confirm(
      `هل تريد حذف الحساب غير المفعّل للبريد ${user.email ?? user.user_id}؟`,
    );
    if (!proceed) {
      return;
    }

    await handleAction(user.user_id, 'delete_pending');
  }

  async function handleDeleteOlderPending() {
    const oldUsers = pendingUsers.filter((item) => item.older_than_3h);
    if (!oldUsers.length) {
      return;
    }

    const proceed = window.confirm(
      `سيتم حذف ${oldUsers.length} حساب/حسابات غير مفعّلة عمرها أكثر من 3 ساعات. هل تريد المتابعة؟`,
    );
    if (!proceed) {
      return;
    }

    for (const user of oldUsers) {
      await fetch('/admin/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.user_id, action: 'delete_pending' }),
      });
    }

    await loadUsers();
  }

  if (loading) {
    return <div className="animate-pulse text-slate-500">جارٍ التحميل...</div>;
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-brand-navy dark:text-slate-100">المستخدمون</h1>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-brand-navy dark:text-slate-100">
            حسابات غير مفعّلة
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {pendingUsers.length} حساب
            </span>
            <button
              type="button"
              onClick={handleDeleteOlderPending}
              className="rounded border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50 dark:border-red-900/40 dark:text-red-300 dark:hover:bg-red-900/20"
            >
              حذف الأقدم من 3 ساعات
            </button>
          </div>
        </div>

        {pendingUsers.length === 0 ? (
          <p className="text-sm text-slate-500">لا توجد حسابات غير مفعّلة حالياً.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
            <table className="min-w-full text-sm">
              <thead className="border-b border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300">
                <tr>
                  <th className="py-3 text-start font-medium">البريد</th>
                  <th className="py-3 text-start font-medium">التسجيل</th>
                  <th className="py-3 text-start font-medium">العمر</th>
                  <th className="py-3 text-start font-medium">إجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {pendingUsers.map((u) => (
                  <tr key={u.user_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-3 font-medium">{u.email ?? u.user_id}</td>
                    <td className="py-3">{new Date(u.created_at).toLocaleString('ar-SA')}</td>
                    <td className="py-3">
                      {u.older_than_3h ? (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                          أكثر من 3 ساعات
                        </span>
                      ) : (
                        <span className="text-slate-500">أقل من 3 ساعات</span>
                      )}
                    </td>
                    <td className="py-3">
                      <button
                        disabled={actionId === u.user_id}
                        onClick={() => handleDeletePending(u)}
                        className="rounded bg-red-600 px-3 py-1 text-xs text-white hover:bg-red-700 disabled:opacity-50"
                      >
                        حذف الحساب
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-brand-navy dark:text-slate-100">المستخدمون المفعّلون</h2>

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
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            u.status === 'suspended'
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
      </section>
    </div>
  );
}
