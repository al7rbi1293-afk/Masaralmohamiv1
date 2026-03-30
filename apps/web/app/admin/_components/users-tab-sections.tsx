import { Search } from 'lucide-react';
import { isUserExpired } from './users-tab-helpers';
import type { PendingUser, User } from './users-tab-types';

type PendingUsersSectionProps = {
  pendingUsers: PendingUser[];
  selectedUserIds: Set<string>;
  actionId: string | null;
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  onDeleteOlderPending: () => void;
  onToggleSelection: (userId: string) => void;
  onToggleAllSelection: (userIds: string[]) => void;
  onSelectUser: (user: PendingUser) => void;
  onDeletePending: (user: PendingUser) => void;
};

export function PendingUsersSection({
  pendingUsers,
  selectedUserIds,
  actionId,
  searchTerm,
  onSearchTermChange,
  onDeleteOlderPending,
  onToggleSelection,
  onToggleAllSelection,
  onSelectUser,
  onDeletePending,
}: PendingUsersSectionProps) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-brand-navy dark:text-slate-100">حسابات غير مفعّلة</h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 dark:text-slate-400">{pendingUsers.length} حساب</span>
          <button
            type="button"
            onClick={onDeleteOlderPending}
            className="rounded border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50 dark:border-red-900/40 dark:text-red-300 dark:hover:bg-red-900/20"
          >
            حذف الأقدم من 3 ساعات
          </button>
        </div>
      </div>

      <div className="relative mb-6 max-w-md">
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
          <Search className="h-4 w-4 text-slate-400" />
        </div>
        <input
          type="text"
          className="block w-full rounded-lg border border-slate-200 bg-white py-2 pl-4 pr-10 text-sm placeholder-slate-400 focus:border-brand-emerald focus:outline-none focus:ring-1 focus:ring-brand-emerald dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:placeholder-slate-500"
          placeholder="البحث بالاسم، البريد أو رقم الجوال..."
          value={searchTerm}
          onChange={(event) => onSearchTermChange(event.target.value)}
        />
      </div>

      {pendingUsers.length === 0 ? (
        <p className="text-sm text-slate-500">لا توجد حسابات غير مفعّلة حالياً.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
          <table className="min-w-full text-sm">
            <thead className="border-b border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300">
              <tr>
                <th className="w-12 px-3 py-3 text-start">
                  <input
                    type="checkbox"
                    className="rounded border-slate-300 text-brand-emerald focus:ring-brand-emerald dark:border-slate-700 dark:bg-slate-800"
                    checked={pendingUsers.length > 0 && pendingUsers.every((item) => selectedUserIds.has(item.user_id))}
                    onChange={() => onToggleAllSelection(pendingUsers.map((item) => item.user_id))}
                  />
                </th>
                <th className="py-3 text-start font-medium">البريد</th>
                <th className="py-3 text-start font-medium">التسجيل</th>
                <th className="py-3 text-start font-medium">العمر</th>
                <th className="py-3 text-start font-medium">إجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {pendingUsers.map((user) => (
                <tr
                  key={user.user_id}
                  className={`cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40 ${selectedUserIds.has(user.user_id) ? 'bg-brand-emerald/5 dark:bg-emerald-500/10' : ''}`}
                  onClick={() => onSelectUser(user)}
                >
                  <td className="px-3 py-3" onClick={(event) => event.stopPropagation()}>
                    <input
                      type="checkbox"
                      className="rounded border-slate-300 text-brand-emerald focus:ring-brand-emerald dark:border-slate-700 dark:bg-slate-800"
                      checked={selectedUserIds.has(user.user_id)}
                      onChange={() => onToggleSelection(user.user_id)}
                    />
                  </td>
                  <td className="py-3 font-medium">{user.email ?? user.user_id}</td>
                  <td className="py-3">{new Date(user.created_at).toLocaleString('ar-SA')}</td>
                  <td className="py-3">
                    {user.older_than_3h ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                        أكثر من 3 ساعات
                      </span>
                    ) : (
                      <span className="text-slate-500">أقل من 3 ساعات</span>
                    )}
                  </td>
                  <td className="py-3">
                    <button
                      disabled={actionId === user.user_id}
                      onClick={(event) => {
                        event.stopPropagation();
                        onDeletePending(user);
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
  );
}

type ActiveUsersSectionProps = {
  users: User[];
  selectedUserIds: Set<string>;
  actionId: string | null;
  onToggleSelection: (userId: string) => void;
  onToggleAllSelection: (userIds: string[]) => void;
  onSelectUser: (user: User) => void;
  onSuspend: (user: User) => void;
  onActivate: (user: User) => void;
  onDeleteConfirmed: (user: User) => void;
};

export function ActiveUsersSection({
  users,
  selectedUserIds,
  actionId,
  onToggleSelection,
  onToggleAllSelection,
  onSelectUser,
  onSuspend,
  onActivate,
  onDeleteConfirmed,
}: ActiveUsersSectionProps) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-brand-navy dark:text-slate-100">المستخدمون المفعّلون</h2>

      {users.length === 0 ? (
        <p className="text-sm text-slate-500">لا يوجد مستخدمون.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300">
              <tr>
                <th className="w-12 px-3 py-3 text-start">
                  <input
                    type="checkbox"
                    className="rounded border-slate-300 text-brand-emerald focus:ring-brand-emerald dark:border-slate-700 dark:bg-slate-800"
                    checked={users.length > 0 && users.every((user) => selectedUserIds.has(user.user_id))}
                    onChange={() => onToggleAllSelection(users.map((user) => user.user_id))}
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
              {users.map((user) => {
                const membership = Array.isArray(user.memberships) ? user.memberships[0] : null;

                return (
                  <tr
                    key={user.user_id}
                    className={`cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40 ${selectedUserIds.has(user.user_id) ? 'bg-brand-emerald/5 dark:bg-emerald-500/10' : ''}`}
                    onClick={() => onSelectUser(user)}
                  >
                    <td className="px-3 py-3" onClick={(event) => event.stopPropagation()}>
                      <input
                        type="checkbox"
                        className="rounded border-slate-300 text-brand-emerald focus:ring-brand-emerald dark:border-slate-700 dark:bg-slate-800"
                        checked={selectedUserIds.has(user.user_id)}
                        onChange={() => onToggleSelection(user.user_id)}
                      />
                    </td>
                    <td className="py-3 font-medium">{user.full_name || '—'}</td>
                    <td className="py-3">{user.email ?? '—'}</td>
                    <td className="py-3">{membership?.organizations?.name ?? '—'}</td>
                    <td className="py-3">{membership?.role ?? '—'}</td>
                    <td className="py-3">
                      <div className="flex items-start gap-1.5">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            user.status === 'suspended'
                              ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                              : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                          }`}
                        >
                          {user.status === 'suspended' ? 'معلّق' : 'نشط'}
                        </span>
                        {isUserExpired(user) && user.status !== 'suspended' ? (
                          <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:bg-red-900/40 dark:text-red-300">
                            منتهي الصلاحية
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="py-3">{new Date(user.created_at).toLocaleDateString('ar-SA')}</td>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        {user.status === 'active' ? (
                          <button
                            disabled={actionId === user.user_id}
                            onClick={(event) => {
                              event.stopPropagation();
                              onSuspend(user);
                            }}
                            className="rounded bg-red-600 px-3 py-1 text-xs text-white hover:bg-red-700 disabled:opacity-50"
                          >
                            تعليق
                          </button>
                        ) : (
                          <button
                            disabled={actionId === user.user_id}
                            onClick={(event) => {
                              event.stopPropagation();
                              onActivate(user);
                            }}
                            className="rounded bg-emerald-600 px-3 py-1 text-xs text-white hover:bg-emerald-700 disabled:opacity-50"
                          >
                            تفعيل
                          </button>
                        )}
                        <button
                          disabled={actionId === user.user_id}
                          onClick={(event) => {
                            event.stopPropagation();
                            onDeleteConfirmed(user);
                          }}
                          className="rounded bg-slate-800 px-3 py-1 text-xs text-white hover:bg-black disabled:opacity-50 dark:bg-slate-700 dark:hover:bg-slate-600"
                        >
                          حذف
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

type UsersPaginationProps = {
  totalCount: number;
  page: number;
  limit: number;
  loading: boolean;
  onPrev: () => void;
  onNext: () => void;
};

export function UsersPagination({ totalCount, page, limit, loading, onPrev, onNext }: UsersPaginationProps) {
  if (totalCount <= 0) {
    return null;
  }

  const totalPages = Math.ceil(totalCount / limit);

  return (
    <div className="flex items-center justify-between border-t border-slate-200 pt-4 dark:border-slate-800">
      <div className="text-sm text-slate-500 dark:text-slate-400">
        إجمالي السجلات: <span className="font-semibold text-slate-900 dark:text-slate-100">{totalCount}</span>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onPrev}
          disabled={page === 1 || loading}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
        >
          السابق
        </button>
        <span className="text-sm text-slate-600 dark:text-slate-300">
          صفحة <span className="font-semibold">{page}</span> من <span className="font-semibold">{totalPages}</span>
        </span>
        <button
          onClick={onNext}
          disabled={page >= totalPages || loading}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
        >
          التالي
        </button>
      </div>
    </div>
  );
}

type BulkActionBarProps = {
  selectedCount: number;
  actionId: string | null;
  onActivate: () => void;
  onSuspend: () => void;
  onDelete: () => void;
  onClearSelection: () => void;
};

export function UsersBulkActionBar({
  selectedCount,
  actionId,
  onActivate,
  onSuspend,
  onDelete,
  onClearSelection,
}: BulkActionBarProps) {
  if (selectedCount === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-4 rounded-full border border-slate-200 bg-white px-6 py-3 shadow-2xl animate-in slide-in-from-bottom-5 dark:border-slate-800 dark:bg-slate-900">
      <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
        <span className="ml-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-brand-navy text-xs text-white">
          {selectedCount}
        </span>
        عنصر محدد
      </span>
      <div className="h-4 w-px bg-slate-200 dark:bg-slate-700" />
      <div className="flex items-center gap-2">
        <button
          disabled={actionId === 'bulk'}
          onClick={onActivate}
          className="text-sm font-medium text-emerald-600 hover:text-emerald-700 disabled:opacity-50 dark:text-emerald-400 dark:hover:text-emerald-300"
        >
          تفعيل
        </button>
        <button
          disabled={actionId === 'bulk'}
          onClick={onSuspend}
          className="text-sm font-medium text-amber-600 hover:text-amber-700 disabled:opacity-50 dark:text-amber-400 dark:hover:text-amber-300"
        >
          تعليق
        </button>
        <button
          disabled={actionId === 'bulk'}
          onClick={onDelete}
          className="text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-50 dark:text-red-400 dark:hover:text-red-300"
        >
          حذف نهائي
        </button>
        <div className="mr-2 ml-2 h-4 w-px bg-slate-200 dark:bg-slate-700" />
        <button
          onClick={onClearSelection}
          className="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
        >
          إلغاء التحديد
        </button>
      </div>
    </div>
  );
}
