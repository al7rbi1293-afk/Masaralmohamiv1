'use client';

import { useEffect, useState } from 'react';
import { SlideOver } from '@/components/ui/slide-over';
import { UserDetailsPanel } from './users-tab-details';
import {
  ActiveUsersSection,
  PendingUsersSection,
  UsersBulkActionBar,
  UsersPagination,
} from './users-tab-sections';
import type { PendingUser, User } from './users-tab-types';

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

  useEffect(() => {
    setPage(1);
  }, [searchTerm]);

  async function loadUsers(query: string = searchTerm, nextPage: number = page) {
    const res = await fetch(`/admin/api/users?query=${encodeURIComponent(query)}&page=${nextPage}&limit=${limit}`);
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
    }, 400);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, page]);

  async function handleAction(userId: string, action: 'suspend' | 'activate' | 'delete_pending' | 'delete') {
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

  async function handleBulkAction(action: 'suspend' | 'activate' | 'delete_pending' | 'delete') {
    if (selectedUserIds.size === 0) return;
    const confirmMessage =
      action === 'delete_pending'
        ? `هل أنت متأكد من حذف ${selectedUserIds.size} حساب غير مفعّل؟`
        : action === 'delete'
          ? `سيتم حذف ${selectedUserIds.size} حساب نهائيًا. هل تريد المتابعة؟`
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
    const nextSet = new Set(selectedUserIds);
    if (nextSet.has(userId)) {
      nextSet.delete(userId);
    } else {
      nextSet.add(userId);
    }
    setSelectedUserIds(nextSet);
  }

  function toggleAllSelection(userIds: string[]) {
    const allSelected = userIds.every((id) => selectedUserIds.has(id));
    const nextSet = new Set(selectedUserIds);

    if (allSelected) {
      userIds.forEach((id) => nextSet.delete(id));
    } else {
      userIds.forEach((id) => nextSet.add(id));
    }
    setSelectedUserIds(nextSet);
  }

  async function handleDeletePending(user: PendingUser) {
    const proceed = window.confirm(`هل تريد حذف الحساب غير المفعّل للبريد ${user.email ?? user.user_id}؟`);
    if (!proceed) return;

    try {
      await handleAction(user.user_id, 'delete_pending');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'تعذر حذف الحساب.';
      setLoadError(message);
    }
  }

  async function handleDeleteConfirmedUser(user: User) {
    const label = user.email ?? user.full_name ?? user.user_id;
    const proceed = window.confirm(`سيتم حذف الحساب المفعّل ${label} نهائيًا. هل تريد المتابعة؟`);
    if (!proceed) return;

    try {
      await handleAction(user.user_id, 'delete');
      if (selectedUser && 'user_id' in selectedUser && selectedUser.user_id === user.user_id) {
        setSelectedUser(null);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'تعذر حذف الحساب.';
      setLoadError(message);
    }
  }

  async function handleDeleteOlderPending() {
    const oldUsers = pendingUsers.filter((item) => item.older_than_3h);
    if (!oldUsers.length) return;

    const proceed = window.confirm(
      `سيتم حذف ${oldUsers.length} حساب/حسابات غير مفعّلة عمرها أكثر من 3 ساعات. هل تريد المتابعة؟`,
    );
    if (!proceed) return;

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

      <PendingUsersSection
        pendingUsers={pendingUsers}
        selectedUserIds={selectedUserIds}
        actionId={actionId}
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
        onDeleteOlderPending={() => {
          void handleDeleteOlderPending().catch((error) => {
            const message = error instanceof Error ? error.message : 'تعذر حذف الحسابات القديمة.';
            setLoadError(message);
          });
        }}
        onToggleSelection={toggleSelection}
        onToggleAllSelection={toggleAllSelection}
        onSelectUser={setSelectedUser}
        onDeletePending={(user) => {
          void handleDeletePending(user);
        }}
      />

      <ActiveUsersSection
        users={users}
        selectedUserIds={selectedUserIds}
        actionId={actionId}
        onToggleSelection={toggleSelection}
        onToggleAllSelection={toggleAllSelection}
        onSelectUser={setSelectedUser}
        onSuspend={(user) => {
          handleAction(user.user_id, 'suspend').catch((error) => {
            const message = error instanceof Error ? error.message : 'تعذر تعليق المستخدم.';
            setLoadError(message);
          });
        }}
        onActivate={(user) => {
          handleAction(user.user_id, 'activate').catch((error) => {
            const message = error instanceof Error ? error.message : 'تعذر تفعيل المستخدم.';
            setLoadError(message);
          });
        }}
        onDeleteConfirmed={(user) => {
          void handleDeleteConfirmedUser(user);
        }}
      />

      <UsersPagination
        totalCount={totalCount}
        page={page}
        limit={limit}
        loading={loading}
        onPrev={() => setPage((current) => Math.max(1, current - 1))}
        onNext={() => setPage((current) => current + 1)}
      />

      <UsersBulkActionBar
        selectedCount={selectedUserIds.size}
        actionId={actionId}
        onActivate={() => {
          void handleBulkAction('activate');
        }}
        onSuspend={() => {
          void handleBulkAction('suspend');
        }}
        onDelete={() => {
          void handleBulkAction('delete');
        }}
        onClearSelection={() => setSelectedUserIds(new Set())}
      />

      <SlideOver
        open={selectedUser !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedUser(null);
          }
        }}
      >
        {selectedUser ? (
          <UserDetailsPanel
            selectedUser={selectedUser}
            actionId={actionId}
            onSuspend={(user) => {
              handleAction(user.user_id, 'suspend').then(() => {
                setSelectedUser({ ...user, status: 'suspended' });
              });
            }}
            onActivate={(user) => {
              handleAction(user.user_id, 'activate').then(() => {
                setSelectedUser({ ...user, status: 'active' });
              });
            }}
            onDeleteConfirmed={(user) => {
              void handleDeleteConfirmedUser(user);
            }}
            onDeletePending={(user) => {
              void handleDeletePending(user).then(() => {
                setSelectedUser(null);
              });
            }}
          />
        ) : null}
      </SlideOver>
    </div>
  );
}
