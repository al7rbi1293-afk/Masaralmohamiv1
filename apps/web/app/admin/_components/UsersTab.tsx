'use client';

import { useEffect, useState } from 'react';
import { Search, User as UserIcon, Building, Calendar, Shield, Activity, Phone, Mail } from 'lucide-react';
import {
  SlideOver,
  SlideOverContent,
  SlideOverHeader,
  SlideOverTitle,
  SlideOverDescription,
} from '@/components/ui/slide-over';

type User = {
  user_id: string;
  email?: string | null;
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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | PendingUser | null>(null);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const limit = 20;

  // Reset page when search changes
  useEffect(() => {
    setPage(1);
  }, [searchTerm]);

  // Type guard to distinguish User from PendingUser
  const isConfirmedUser = (u: User | PendingUser): u is User => 'status' in u;

  async function loadUsers(query: string = searchTerm, p: number = page) {
    const res = await fetch(`/admin/api/users?query=${encodeURIComponent(query)}&page=${p}&limit=${limit}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error((data as { error?: string }).error || 'تعذر تحميل المستخدمين.');
    }
    setUsers(data.users ?? []);
    setPendingUsers(data.pending ?? []);
    setTotalCount(data.total_count ?? 0);
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(true);
      loadUsers(searchTerm, page)
        .catch((error) => {
          const message = error instanceof Error ? error.message : 'تعذر تحميل المستخدمين.';
          setLoadError(message);
        })
        .finally(() => setLoading(false));
    }, 400); // 400ms debounce

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, page]);

  async function handleAction(userId: string, action: 'suspend' | 'activate' | 'delete_pending') {
    setLoadError(null);
    setActionId(userId);
    const res = await fetch('/admin/api/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, action }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      setActionId(null);
      throw new Error((payload as { error?: string }).error || 'تعذر تنفيذ العملية.');
    }
    await loadUsers();
    setActionId(null);
  }

  async function handleBulkAction(action: 'suspend' | 'activate' | 'delete_pending') {
    if (selectedUserIds.size === 0) return;
    const confirmMessage = action === 'delete_pending'
      ? `هل أنت متأكد من حذف ${selectedUserIds.size} حساب غير مفعّل؟`
      : `هل أنت متأكد من تنفيذ هذا الإجراء على ${selectedUserIds.size} مستخدم؟`;

    if (!window.confirm(confirmMessage)) return;

    setLoadError(null);
    setActionId('bulk');

    try {
      const userIdsArray = Array.from(selectedUserIds);
      const res = await fetch('/admin/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_ids: userIdsArray, action }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((payload as { error?: string }).error || 'تعذر تنفيذ الإجراء المجمّع.');
      }
      await loadUsers();
      setSelectedUserIds(new Set());
    } catch (error) {
      const message = error instanceof Error ? error.message : 'تعذر تنفيذ الإجراء المجمّع.';
      setLoadError(message);
    } finally {
      setActionId(null);
    }
  }

  function toggleSelection(userId: string) {
    const newSet = new Set(selectedUserIds);
    if (newSet.has(userId)) {
      newSet.delete(userId);
    } else {
      newSet.add(userId);
    }
    setSelectedUserIds(newSet);
  }

  function toggleAllSelection(userIds: string[]) {
    const allSelected = userIds.every(id => selectedUserIds.has(id));
    const newSet = new Set(selectedUserIds);

    if (allSelected) {
      userIds.forEach(id => newSet.delete(id));
    } else {
      userIds.forEach(id => newSet.add(id));
    }
    setSelectedUserIds(newSet);
  }

  async function handleDeletePending(user: PendingUser) {
    const proceed = window.confirm(
      `هل تريد حذف الحساب غير المفعّل للبريد ${user.email ?? user.user_id}؟`,
    );
    if (!proceed) {
      return;
    }

    try {
      await handleAction(user.user_id, 'delete_pending');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'تعذر حذف الحساب.';
      setLoadError(message);
    }
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
      const res = await fetch('/admin/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.user_id, action: 'delete_pending' }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error((payload as { error?: string }).error || 'تعذر حذف بعض الحسابات.');
      }
    }

    try {
      await loadUsers();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'تعذر تحديث القائمة.';
      setLoadError(message);
    }
  }

  if (loading) {
    return <div className="animate-pulse text-slate-500">جارٍ التحميل...</div>;
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-brand-navy dark:text-slate-100">المستخدمون</h1>
      {loadError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          {loadError}
        </div>
      ) : null}

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

        {/* Global Search Bar */}
        <div className="relative mb-6 max-w-md">
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
            <Search className="h-4 w-4 text-slate-400" />
          </div>
          <input
            type="text"
            className="block w-full rounded-lg border border-slate-200 bg-white py-2 pl-4 pr-10 text-sm placeholder-slate-400 focus:border-brand-emerald focus:outline-none focus:ring-1 focus:ring-brand-emerald dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:placeholder-slate-500"
            placeholder="البحث بالاسم، البريد أو رقم الجوال..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {pendingUsers.length === 0 ? (
          <p className="text-sm text-slate-500">لا توجد حسابات غير مفعّلة حالياً.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
            <table className="min-w-full text-sm">
              <thead className="border-b border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300">
                <tr>
                  <th className="py-3 px-3 w-12 text-start">
                    <input
                      type="checkbox"
                      className="rounded border-slate-300 text-brand-emerald focus:ring-brand-emerald dark:border-slate-700 dark:bg-slate-800"
                      checked={pendingUsers.length > 0 && pendingUsers.every(u => selectedUserIds.has(u.user_id))}
                      onChange={() => toggleAllSelection(pendingUsers.map(u => u.user_id))}
                    />
                  </th>
                  <th className="py-3 text-start font-medium">البريد</th>
                  <th className="py-3 text-start font-medium">التسجيل</th>
                  <th className="py-3 text-start font-medium">العمر</th>
                  <th className="py-3 text-start font-medium">إجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {pendingUsers.map((u) => (
                  <tr
                    key={u.user_id}
                    className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors ${selectedUserIds.has(u.user_id) ? 'bg-brand-emerald/5 dark:bg-emerald-500/10' : ''}`}
                    onClick={() => setSelectedUser(u)}
                  >
                    <td className="py-3 px-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        className="rounded border-slate-300 text-brand-emerald focus:ring-brand-emerald dark:border-slate-700 dark:bg-slate-800"
                        checked={selectedUserIds.has(u.user_id)}
                        onChange={() => toggleSelection(u.user_id)}
                      />
                    </td>
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
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeletePending(u);
                        }}
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
                  <th className="py-3 px-3 w-12 text-start">
                    <input
                      type="checkbox"
                      className="rounded border-slate-300 text-brand-emerald focus:ring-brand-emerald dark:border-slate-700 dark:bg-slate-800"
                      checked={users.length > 0 && users.every(u => selectedUserIds.has(u.user_id))}
                      onChange={() => toggleAllSelection(users.map(u => u.user_id))}
                    />
                  </th>
                  <th className="py-3 text-start font-medium">الاسم</th>
                  <th className="py-3 text-start font-medium">البريد</th>
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
                    <tr
                      key={u.user_id}
                      className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors ${selectedUserIds.has(u.user_id) ? 'bg-brand-emerald/5 dark:bg-emerald-500/10' : ''}`}
                      onClick={() => setSelectedUser(u)}
                    >
                      <td className="py-3 px-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          className="rounded border-slate-300 text-brand-emerald focus:ring-brand-emerald dark:border-slate-700 dark:bg-slate-800"
                          checked={selectedUserIds.has(u.user_id)}
                          onChange={() => toggleSelection(u.user_id)}
                        />
                      </td>
                      <td className="py-3 font-medium">{u.full_name || '—'}</td>
                      <td className="py-3">{u.email ?? '—'}</td>
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
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAction(u.user_id, 'suspend').catch((error) => {
                                const message = error instanceof Error ? error.message : 'تعذر تعليق المستخدم.';
                                setLoadError(message);
                              });
                            }}
                            className="rounded bg-red-600 px-3 py-1 text-xs text-white hover:bg-red-700 disabled:opacity-50"
                          >
                            تعليق
                          </button>
                        ) : (
                          <button
                            disabled={actionId === u.user_id}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAction(u.user_id, 'activate').catch((error) => {
                                const message = error instanceof Error ? error.message : 'تعذر تفعيل المستخدم.';
                                setLoadError(message);
                              });
                            }}
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

        {/* Pagination Footer */}
        {totalCount > 0 && (
          <div className="flex items-center justify-between border-t border-slate-200 pt-4 dark:border-slate-800">
            <div className="text-sm text-slate-500 dark:text-slate-400">
              إجمالي السجلات: <span className="font-semibold text-slate-900 dark:text-slate-100">{totalCount}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1 || loading}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                السابق
              </button>
              <span className="text-sm text-slate-600 dark:text-slate-300">
                صفحة <span className="font-semibold">{page}</span> من <span className="font-semibold">{Math.ceil(totalCount / limit)}</span>
              </span>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={page >= Math.ceil(totalCount / limit) || loading}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                التالي
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Floating Bulk Action Bar */}
      {selectedUserIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-4 rounded-full bg-white px-6 py-3 shadow-2xl border border-slate-200 dark:border-slate-800 dark:bg-slate-900 animate-in slide-in-from-bottom-5">
          <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-navy text-white text-xs ml-2 inline-flex">
              {selectedUserIds.size}
            </span>
            عنصر محدد
          </span>
          <div className="h-4 w-px bg-slate-200 dark:bg-slate-700"></div>
          <div className="flex items-center gap-2">
            <button
              disabled={actionId === 'bulk'}
              onClick={() => handleBulkAction('activate')}
              className="text-sm font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 disabled:opacity-50"
            >
              تفعيل
            </button>
            <button
              disabled={actionId === 'bulk'}
              onClick={() => handleBulkAction('suspend')}
              className="text-sm font-medium text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300 disabled:opacity-50"
            >
              تعليق
            </button>
            <button
              disabled={actionId === 'bulk'}
              onClick={() => handleBulkAction('delete_pending')}
              className="text-sm font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-50"
            >
              حذف نهائي
            </button>
            <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mr-2 ml-2"></div>
            <button
              onClick={() => setSelectedUserIds(new Set())}
              className="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            >
              إلغاء التحديد
            </button>
          </div>
        </div>
      )}

      {/* Slide-over specifically for User details */}
      <SlideOver
        open={selectedUser !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedUser(null);
        }}
      >
        <SlideOverContent>
          {selectedUser && (
            <>
              <SlideOverHeader>
                <SlideOverTitle>تفاصيل المستخدم</SlideOverTitle>
                <SlideOverDescription>معلومات الحساب والارتباط بالمكاتب.</SlideOverDescription>
              </SlideOverHeader>

              <div className="space-y-6">
                {/* Basic Info */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
                  <div className="flex items-center gap-4 border-b border-slate-200 pb-4 dark:border-slate-800">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-emerald/10 text-brand-emerald dark:bg-emerald-500/20 dark:text-emerald-400">
                      <UserIcon className="h-6 w-6" />
                    </div>
                    <div>
                      <h4 className="text-lg font-bold text-brand-navy dark:text-slate-100">
                        {isConfirmedUser(selectedUser) ? selectedUser.full_name || 'بدون اسم' : 'حساب غير مفعّل'}
                      </h4>
                      <div className="mt-1 flex items-center gap-2 text-sm text-slate-500">
                        <Mail className="h-3.5 w-3.5" />
                        <span>{selectedUser.email ?? selectedUser.user_id}</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> التسجيل</p>
                      <p className="font-medium text-slate-900 dark:text-slate-100">{new Date(selectedUser.created_at).toLocaleDateString('ar-SA')}</p>
                    </div>
                    {isConfirmedUser(selectedUser) && (
                      <div>
                        <p className="text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> الجوال</p>
                        <p className="font-medium text-slate-900 dark:text-slate-100" dir="ltr">{selectedUser.phone || '—'}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1"><Activity className="w-3.5 h-3.5" /> الحالة</p>
                      {isConfirmedUser(selectedUser) ? (
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${selectedUser.status === 'suspended'
                          ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                          : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                          }`}>
                          {selectedUser.status === 'suspended' ? 'معلّق' : 'نشط'}
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">غير مفعّل</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Memberships */}
                {isConfirmedUser(selectedUser) && (
                  <div>
                    <h4 className="flex items-center gap-2 text-base font-semibold text-brand-navy dark:text-slate-100 mb-3">
                      <Building className="h-4 w-4 text-brand-emerald" />
                      المكاتب المرتبطة
                    </h4>
                    {selectedUser.memberships.length === 0 ? (
                      <p className="text-sm text-slate-500 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800">لا يوجد ارتباط بأي مكتب.</p>
                    ) : (
                      <div className="space-y-3">
                        {selectedUser.memberships.map((m) => (
                          <div key={m.org_id} className="flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                            <div>
                              <p className="font-medium text-sm text-slate-900 dark:text-slate-100">{m.organizations?.name}</p>
                              <p className="text-xs text-slate-500">{m.role}</p>
                            </div>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${m.organizations?.status === 'active'
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                              : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                              }`}>
                              {m.organizations?.status === 'active' ? 'مكتب نشط' : 'مكتب معلّق'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Quick Actions */}
                <div>
                  <h4 className="flex items-center gap-2 text-base font-semibold text-brand-navy dark:text-slate-100 mb-3">
                    <Shield className="h-4 w-4 text-brand-emerald" />
                    إجراءات سريعة
                  </h4>
                  <div className="flex flex-col gap-2">
                    {isConfirmedUser(selectedUser) ? (
                      selectedUser.status === 'active' ? (
                        <button
                          disabled={actionId === selectedUser.user_id}
                          onClick={() => {
                            handleAction(selectedUser.user_id, 'suspend').then(() => {
                              setSelectedUser({ ...selectedUser, status: 'suspended' });
                            });
                          }}
                          className="w-full rounded-lg bg-red-50 text-red-600 border border-red-200 px-4 py-2.5 text-sm font-medium hover:bg-red-100 dark:bg-red-900/20 dark:border-red-900/30 dark:hover:bg-red-900/40 dark:text-red-400 transition-colors"
                        >
                          تعليق الحساب
                        </button>
                      ) : (
                        <button
                          disabled={actionId === selectedUser.user_id}
                          onClick={() => {
                            handleAction(selectedUser.user_id, 'activate').then(() => {
                              setSelectedUser({ ...selectedUser, status: 'active' });
                            });
                          }}
                          className="w-full rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 px-4 py-2.5 text-sm font-medium hover:bg-emerald-100 dark:bg-emerald-900/20 dark:border-emerald-900/30 dark:hover:bg-emerald-900/40 dark:text-emerald-400 transition-colors"
                        >
                          تفعيل الحساب
                        </button>
                      )
                    ) : (
                      <button
                        disabled={actionId === selectedUser.user_id}
                        onClick={() => {
                          handleDeletePending(selectedUser).then(() => {
                            // Handle closing if successfully deleted
                            if (pendingUsers.find(u => u.user_id === selectedUser.user_id) === undefined) {
                              setSelectedUser(null);
                            }
                          });
                        }}
                        className="w-full rounded-lg bg-red-50 text-red-600 border border-red-200 px-4 py-2.5 text-sm font-medium hover:bg-red-100 dark:bg-red-900/20 dark:border-red-900/30 dark:hover:bg-red-900/40 dark:text-red-400 transition-colors"
                      >
                        حذف حساب غير مفعّل نهائياً
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </SlideOverContent>
      </SlideOver>
    </div>
  );
}
