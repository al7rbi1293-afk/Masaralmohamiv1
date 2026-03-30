import { Search } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { formatArabicDate, getPlanLabel } from './orgs-tab-utils';
import type { Org } from './orgs-tab-types';

type OrgsSearchBarProps = {
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
};

export function OrgsSearchBar({ searchTerm, onSearchTermChange }: OrgsSearchBarProps) {
  return (
    <div className="relative mb-6 max-w-md">
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
        <Search className="h-4 w-4 text-slate-400" />
      </div>
      <input
        type="text"
        className="block w-full rounded-lg border border-slate-200 bg-white py-2 pl-4 pr-10 text-sm placeholder-slate-400 focus:border-brand-emerald focus:outline-none focus:ring-1 focus:ring-brand-emerald dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:placeholder-slate-500"
        placeholder="البحث باسم المكتب..."
        value={searchTerm}
        onChange={(event) => onSearchTermChange(event.target.value)}
      />
    </div>
  );
}

type OrgsTableProps = {
  orgs: Org[];
  selectedOrgIds: Set<string>;
  actionId: string | null;
  isExpired: (org: Org) => boolean;
  onSelectOrg: (org: Org) => void;
  onToggleSelection: (orgId: string) => void;
  onToggleAllSelection: (orgIds: string[]) => void;
};

export function OrgsTable({
  orgs,
  selectedOrgIds,
  actionId,
  isExpired,
  onSelectOrg,
  onToggleSelection,
  onToggleAllSelection,
}: OrgsTableProps) {
  if (!orgs.length) {
    return <p className="text-sm text-slate-500">لا توجد مكاتب.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="border-b border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300">
          <tr>
            <th className="w-12 px-3 py-3 text-start">
              <input
                type="checkbox"
                className="rounded border-slate-300 text-brand-emerald focus:ring-brand-emerald dark:border-slate-700 dark:bg-slate-800"
                checked={orgs.length > 0 && orgs.every((org) => selectedOrgIds.has(org.id))}
                onChange={() => onToggleAllSelection(orgs.map((org) => org.id))}
              />
            </th>
            <th className="py-3 text-start font-medium">اسم المكتب</th>
            <th className="py-3 text-start font-medium">الأعضاء</th>
            <th className="py-3 text-start font-medium">الحساب المرتبط</th>
            <th className="py-3 text-start font-medium">الخطة</th>
            <th className="py-3 text-start font-medium">حالة الاشتراك</th>
            <th className="py-3 text-start font-medium">حالة المكتب</th>
            <th className="py-3 text-start font-medium">الانتهاء</th>
            <th className="py-3 text-start font-medium">الإجراءات</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {orgs.map((org) => (
            <tr
              key={org.id}
              className={`cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40 ${
                selectedOrgIds.has(org.id) ? 'bg-brand-emerald/5 dark:bg-emerald-500/10' : ''
              }`}
              onClick={() => onSelectOrg(org)}
            >
              <td className="px-3 py-3" onClick={(event) => event.stopPropagation()}>
                <input
                  type="checkbox"
                  className="rounded border-slate-300 text-brand-emerald focus:ring-brand-emerald dark:border-slate-700 dark:bg-slate-800"
                  checked={selectedOrgIds.has(org.id)}
                  onChange={() => onToggleSelection(org.id)}
                />
              </td>
              <td className="py-3 font-medium">{org.name}</td>
              <td className="py-3">{org.members_count}</td>
              <td className="py-3">
                {org.primary_account ? (
                  <div className="space-y-0.5">
                    <p className="font-medium text-slate-900 dark:text-slate-100">
                      {org.primary_account.full_name || 'بدون اسم'}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400" dir="ltr">
                      {org.primary_account.email || '—'}
                    </p>
                  </div>
                ) : (
                  <span className="text-slate-400 dark:text-slate-500">غير مربوط</span>
                )}
              </td>
              <td className="py-3 font-medium text-brand-navy dark:text-brand-light">
                {getPlanLabel(org.subscription?.plan)}
              </td>
              <td className="py-3">{org.subscription?.status ?? '—'}</td>
              <td className="py-3">
                <div className="flex flex-col items-start gap-1">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      org.status === 'suspended'
                        ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                    }`}
                  >
                    {org.status === 'suspended' ? 'معلّق' : 'نشط'}
                  </span>
                  {isExpired(org) && org.status !== 'suspended' ? (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:bg-red-900/40 dark:text-red-300">
                      منتهي الصلاحية
                    </span>
                  ) : null}
                </div>
              </td>
              <td className="py-3">
                {org.subscription?.current_period_end
                  ? formatArabicDate(org.subscription.current_period_end)
                  : org.trial?.ends_at
                    ? formatArabicDate(org.trial.ends_at)
                    : '—'}
              </td>
              <td className="py-3" onClick={(event) => event.stopPropagation()}>
                <button
                  type="button"
                  className={`${buttonVariants('outline', 'sm')} min-w-[96px]`}
                  onClick={() => onSelectOrg(org)}
                  disabled={actionId === org.id}
                >
                  {actionId === org.id ? 'جارٍ التنفيذ...' : 'الإجراءات'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type OrgsPaginationProps = {
  totalCount: number;
  page: number;
  totalPages: number;
  loading: boolean;
  onPrev: () => void;
  onNext: () => void;
};

export function OrgsPagination({
  totalCount,
  page,
  totalPages,
  loading,
  onPrev,
  onNext,
}: OrgsPaginationProps) {
  if (totalCount <= 0) {
    return null;
  }

  return (
    <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-4 dark:border-slate-800">
      <div className="text-sm text-slate-500 dark:text-slate-400">
        إجمالي المكاتب: <span className="font-semibold text-slate-900 dark:text-slate-100">{totalCount}</span>
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

type OrgsBulkActionBarProps = {
  selectedCount: number;
  actionId: string | null;
  onActivate: () => void;
  onSuspend: () => void;
  onDelete: () => void;
  onClear: () => void;
};

export function OrgsBulkActionBar({
  selectedCount,
  actionId,
  onActivate,
  onSuspend,
  onDelete,
  onClear,
}: OrgsBulkActionBarProps) {
  if (selectedCount === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-4 rounded-full border border-slate-200 bg-white px-6 py-3 shadow-2xl animate-in slide-in-from-bottom-5 dark:border-slate-800 dark:bg-slate-900">
      <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
        <span className="ml-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-brand-navy text-xs text-white">
          {selectedCount}
        </span>
        مكتب محدد
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
        <div className="mx-2 h-4 w-px bg-slate-200 dark:bg-slate-700" />
        <button
          onClick={onClear}
          className="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
        >
          إلغاء التحديد
        </button>
      </div>
    </div>
  );
}
