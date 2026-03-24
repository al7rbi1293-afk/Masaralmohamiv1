'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import {
  Activity,
  Building,
  Calendar,
  CreditCard,
  Search,
  Shield,
  Sparkles,
  TimerReset,
  Trash2,
  Users,
} from 'lucide-react';
import { SlideOver, SlideOverContent, SlideOverDescription, SlideOverHeader, SlideOverTitle } from '@/components/ui/slide-over';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Button, buttonVariants } from '@/components/ui/button';
import { getPricingPlanCardByCode } from '@/lib/subscription-pricing';

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
  linked_accounts: {
    membership_id: string;
    role: string | null;
    user_id: string;
    email: string | null;
    full_name: string | null;
    status: string | null;
    email_verified: boolean | null;
    is_app_admin: boolean;
  }[];
  primary_account: {
    membership_id: string;
    role: string | null;
    user_id: string;
    email: string | null;
    full_name: string | null;
    status: string | null;
    email_verified: boolean | null;
    is_app_admin: boolean;
  } | null;
  has_admin_account: boolean;
};

type OrgAction = 'suspend' | 'activate' | 'delete' | 'grant_lifetime' | 'extend_trial' | 'activate_subscription';

type ConfirmActionState = {
  org: Org;
  action: Extract<OrgAction, 'suspend' | 'activate' | 'delete' | 'grant_lifetime'>;
  title: string;
  message: string;
  confirmLabel: string;
  destructive?: boolean;
};

type ActivationDurationMode = 'month' | 'year' | 'custom_months' | 'custom_years' | 'lifetime';

type ActivationDialogState = {
  org: Org;
  plan: string;
  durationMode: ActivationDurationMode;
  durationValue: string;
};

type TrialDialogState = {
  org: Org;
  days: string;
};

const roleLabelMap: Record<string, string> = {
  owner: 'مالك',
  admin: 'مدير',
  member: 'عضو',
  lawyer: 'محامي',
};

const PLAN_OPTIONS = [
  { value: 'SOLO', label: 'المحامي المستقل (1 مستخدم)' },
  { value: 'SMALL_OFFICE', label: 'مكتب صغير (من 2 إلى 5 مستخدمين)' },
  { value: 'MEDIUM_OFFICE', label: 'مكتب متوسط (من 6 إلى 10 مستخدمين)' },
  { value: 'ENTERPRISE', label: 'نسخة الشركات (تكاملات ناجز)' },
] as const;

const DURATION_OPTIONS: Array<{ value: ActivationDurationMode; label: string }> = [
  { value: 'month', label: 'شهر واحد' },
  { value: 'year', label: 'سنة واحدة' },
  { value: 'custom_months', label: 'مدة مخصصة بالشهور' },
  { value: 'custom_years', label: 'مدة مخصصة بالسنوات' },
];

function getRoleLabel(role: string | null | undefined) {
  if (!role) return 'غير محدد';
  return roleLabelMap[role] ?? role;
}

function getPlanLabel(planCode: string | null | undefined) {
  if (!planCode) return 'تجريبي';
  const card = getPricingPlanCardByCode(planCode);
  if (card) {
    return `${card.title}${card.seatsLabel ? ` (${card.seatsLabel.replace('حد المقاعد: ', '')})` : ''}`;
  }
  return planCode;
}

function formatArabicDate(value: string | null | undefined) {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleDateString('ar-SA');
}

function parseValidDate(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function buildNextExpiryLabel(mode: ActivationDurationMode, value: string) {
  const now = new Date();
  const next = new Date(now);

  switch (mode) {
    case 'year':
      next.setFullYear(next.getFullYear() + 1);
      break;
    case 'custom_months': {
      const months = clampPositiveNumber(value, 1, 240);
      next.setMonth(next.getMonth() + months);
      break;
    }
    case 'custom_years': {
      const years = clampPositiveNumber(value, 1, 20);
      next.setFullYear(next.getFullYear() + years);
      break;
    }
    case 'lifetime':
      next.setFullYear(next.getFullYear() + 100);
      break;
    case 'month':
    default:
      next.setMonth(next.getMonth() + 1);
      break;
  }

  return formatArabicDate(next.toISOString());
}

function clampPositiveNumber(value: string | number, fallback: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.min(max, Math.floor(parsed));
}

function getCustomDurationLabel(mode: ActivationDurationMode) {
  return mode === 'custom_years' ? 'عدد السنوات' : 'عدد الشهور';
}

export default function AdminOrgsPage() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrg, setSelectedOrg] = useState<Org | null>(null);
  const [selectedOrgIds, setSelectedOrgIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [confirmAction, setConfirmAction] = useState<ConfirmActionState | null>(null);
  const [activationDialog, setActivationDialog] = useState<ActivationDialogState | null>(null);
  const [trialDialog, setTrialDialog] = useState<TrialDialogState | null>(null);
  const limit = 20;

  useEffect(() => {
    setPage(1);
  }, [searchTerm]);

  useEffect(() => {
    let cancelled = false;

    const timer = setTimeout(() => {
      setLoading(true);
      loadOrgs(searchTerm, page)
        .catch((error) => {
          console.error(error);
        })
        .finally(() => {
          if (!cancelled) {
            setLoading(false);
          }
        });
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, page]);

  async function loadOrgs(query: string, currentPage: number) {
    const response = await fetch(
      `/admin/api/orgs?query=${encodeURIComponent(query)}&page=${currentPage}&limit=${limit}`,
    );
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error((payload as { error?: string }).error || 'تعذر تحميل المكاتب.');
    }

    const nextOrgs = ((payload as { orgs?: Org[] }).orgs ?? []) as Org[];
    setOrgs(nextOrgs);
    setTotalCount((payload as { total_count?: number }).total_count ?? 0);
    setSelectedOrg((current) => {
      if (!current) return null;
      return nextOrgs.find((org) => org.id === current.id) ?? null;
    });
  }

  async function handleAction(orgId: string, action: OrgAction, extraData?: Record<string, unknown>) {
    setActionId(orgId);

    try {
      const actionRes = await fetch('/admin/api/orgs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ org_id: orgId, action, extra_data: extraData }),
      });
      const actionPayload = await actionRes.json().catch(() => ({}));

      if (!actionRes.ok) {
        throw new Error((actionPayload as { error?: string }).error || 'تعذر تنفيذ العملية.');
      }

      if (action === 'delete') {
        if (selectedOrg?.id === orgId) {
          setSelectedOrg(null);
        }
      }

      await loadOrgs(searchTerm, page);
    } finally {
      setActionId(null);
    }
  }

  async function handleBulkAction(action: 'suspend' | 'activate' | 'delete') {
    if (selectedOrgIds.size === 0) return;

    const confirmMessage =
      action === 'delete'
        ? `سيتم حذف ${selectedOrgIds.size} مكتب نهائيًا. هل تريد المتابعة؟`
        : `هل أنت متأكد من تنفيذ هذا الإجراء على ${selectedOrgIds.size} مكتب؟`;

    if (!window.confirm(confirmMessage)) return;

    setActionId('bulk');

    try {
      const orgIdsArray = Array.from(selectedOrgIds);
      const res = await fetch('/admin/api/orgs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ org_ids: orgIdsArray, action }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((payload as { error?: string }).error || 'تعذر تنفيذ الإجراء المجمّع.');
      }

      if (action === 'delete' && selectedOrg && orgIdsArray.includes(selectedOrg.id)) {
        setSelectedOrg(null);
      }

      await loadOrgs(searchTerm, page);
      setSelectedOrgIds(new Set());
    } catch (error) {
      const message = error instanceof Error ? error.message : 'تعذر تنفيذ الإجراء المجمّع.';
      alert(message);
    } finally {
      setActionId(null);
    }
  }

  function toggleSelection(orgId: string) {
    const next = new Set(selectedOrgIds);
    if (next.has(orgId)) {
      next.delete(orgId);
    } else {
      next.add(orgId);
    }
    setSelectedOrgIds(next);
  }

  function toggleAllSelection(orgIds: string[]) {
    const allSelected = orgIds.every((id) => selectedOrgIds.has(id));
    const next = new Set(selectedOrgIds);

    if (allSelected) {
      orgIds.forEach((id) => next.delete(id));
    } else {
      orgIds.forEach((id) => next.add(id));
    }

    setSelectedOrgIds(next);
  }

  function openActivationDialog(org: Org) {
    setActivationDialog({
      org,
      plan: org.subscription?.plan || 'SOLO',
      durationMode: 'month',
      durationValue: '1',
    });
  }

  function openTrialDialog(org: Org) {
    setTrialDialog({
      org,
      days: '14',
    });
  }

  async function submitActivationDialog() {
    if (!activationDialog) return;

    const extraData: Record<string, unknown> = {
      plan: activationDialog.plan,
      duration_mode: activationDialog.durationMode,
    };

    if (activationDialog.durationMode === 'custom_months' || activationDialog.durationMode === 'custom_years') {
      extraData.duration_value = clampPositiveNumber(activationDialog.durationValue, 1, activationDialog.durationMode === 'custom_years' ? 20 : 240);
    }

    try {
      await handleAction(activationDialog.org.id, 'activate_subscription', extraData);
      setActivationDialog(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'تعذر تفعيل الاشتراك.';
      alert(message);
    }
  }

  async function submitTrialDialog() {
    if (!trialDialog) return;

    try {
      await handleAction(trialDialog.org.id, 'extend_trial', {
        days: clampPositiveNumber(trialDialog.days, 14, 365),
      });
      setTrialDialog(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'تعذر تمديد الفترة التجريبية.';
      alert(message);
    }
  }

  function requestConfirmation(org: Org, action: ConfirmActionState['action']) {
    if (action === 'delete') {
      setConfirmAction({
        org,
        action,
        title: 'حذف نهائي',
        message: `سيتم حذف المكتب "${org.name}" نهائيًا مع بياناته. هل تريد المتابعة؟`,
        confirmLabel: 'حذف نهائي',
        destructive: true,
      });
      return;
    }

    if (action === 'grant_lifetime') {
      setConfirmAction({
        org,
        action,
        title: 'منح اشتراك مدى الحياة',
        message: `سيتم منح "${org.name}" اشتراكًا مدى الحياة. هذا الإجراء محصور بحساب الإدارة فقط.`,
        confirmLabel: 'منح مدى الحياة',
      });
      return;
    }

    if (action === 'activate') {
      setConfirmAction({
        org,
        action,
        title: 'إلغاء تعليق المكتب',
        message: `سيتم إعادة تفعيل المكتب "${org.name}" وتمكينه من الدخول مرة أخرى.`,
        confirmLabel: 'إلغاء التعليق',
      });
      return;
    }

    setConfirmAction({
      org,
      action,
      title: 'تعليق المكتب',
      message: `سيتم تعليق المكتب "${org.name}" ومنع استخدامه حتى إعادة التفعيل.`,
      confirmLabel: 'تعليق المكتب',
    });
  }

  async function executeConfirmedAction() {
    if (!confirmAction) return;

    try {
      await handleAction(confirmAction.org.id, confirmAction.action);
      setConfirmAction(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'تعذر تنفيذ الإجراء.';
      alert(message);
    }
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / limit));

  function isExpired(org: Org) {
    const now = new Date();

    // Subscription check
    if (org.subscription?.status === 'active' || org.subscription?.status === 'past_due') {
      if (org.subscription.current_period_end) {
        return new Date(org.subscription.current_period_end) < now;
      }
      return false;
    }

    // Trial check
    if (org.trial?.ends_at) {
      return org.trial.status === 'expired' || new Date(org.trial.ends_at) < now;
    }

    return false;
  }

  if (loading) {
    return <div className="animate-pulse text-slate-500">جارٍ التحميل...</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-brand-navy dark:text-slate-100">المكاتب</h1>

      <div className="relative mb-6 max-w-md">
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
          <Search className="h-4 w-4 text-slate-400" />
        </div>
        <input
          type="text"
          className="block w-full rounded-lg border border-slate-200 bg-white py-2 pl-4 pr-10 text-sm placeholder-slate-400 focus:border-brand-emerald focus:outline-none focus:ring-1 focus:ring-brand-emerald dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:placeholder-slate-500"
          placeholder="البحث باسم المكتب..."
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
        />
      </div>

      {orgs.length === 0 ? (
        <p className="text-sm text-slate-500">لا توجد مكاتب.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300">
              <tr>
                <th className="w-12 px-3 py-3 text-start">
                  <input
                    type="checkbox"
                    className="rounded border-slate-300 text-brand-emerald focus:ring-brand-emerald dark:border-slate-700 dark:bg-slate-800"
                    checked={orgs.length > 0 && orgs.every((org) => selectedOrgIds.has(org.id))}
                    onChange={() => toggleAllSelection(orgs.map((org) => org.id))}
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
                  onClick={() => setSelectedOrg(org)}
                >
                  <td className="px-3 py-3" onClick={(event) => event.stopPropagation()}>
                    <input
                      type="checkbox"
                      className="rounded border-slate-300 text-brand-emerald focus:ring-brand-emerald dark:border-slate-700 dark:bg-slate-800"
                      checked={selectedOrgIds.has(org.id)}
                      onChange={() => toggleSelection(org.id)}
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
                      {isExpired(org) && org.status !== 'suspended' && (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:bg-red-900/40 dark:text-red-300">
                          منتهي الصلاحية
                        </span>
                      )}
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
                      onClick={() => setSelectedOrg(org)}
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
      )}

      {totalCount > 0 && (
        <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-4 dark:border-slate-800">
          <div className="text-sm text-slate-500 dark:text-slate-400">
            إجمالي المكاتب: <span className="font-semibold text-slate-900 dark:text-slate-100">{totalCount}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page === 1 || loading}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              السابق
            </button>
            <span className="text-sm text-slate-600 dark:text-slate-300">
              صفحة <span className="font-semibold">{page}</span> من <span className="font-semibold">{totalPages}</span>
            </span>
            <button
              onClick={() => setPage((current) => current + 1)}
              disabled={page >= totalPages || loading}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              التالي
            </button>
          </div>
        </div>
      )}

      {selectedOrgIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-4 rounded-full border border-slate-200 bg-white px-6 py-3 shadow-2xl dark:border-slate-800 dark:bg-slate-900 animate-in slide-in-from-bottom-5">
          <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
            <span className="ml-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-brand-navy text-xs text-white">
              {selectedOrgIds.size}
            </span>
            مكتب محدد
          </span>
          <div className="h-4 w-px bg-slate-200 dark:bg-slate-700" />
          <div className="flex items-center gap-2">
            <button
              disabled={actionId === 'bulk'}
              onClick={() => handleBulkAction('activate')}
              className="text-sm font-medium text-emerald-600 hover:text-emerald-700 disabled:opacity-50 dark:text-emerald-400 dark:hover:text-emerald-300"
            >
              تفعيل
            </button>
            <button
              disabled={actionId === 'bulk'}
              onClick={() => handleBulkAction('suspend')}
              className="text-sm font-medium text-amber-600 hover:text-amber-700 disabled:opacity-50 dark:text-amber-400 dark:hover:text-amber-300"
            >
              تعليق
            </button>
            <button
              disabled={actionId === 'bulk'}
              onClick={() => handleBulkAction('delete')}
              className="text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-50 dark:text-red-400 dark:hover:text-red-300"
            >
              حذف نهائي
            </button>
            <div className="mx-2 h-4 w-px bg-slate-200 dark:bg-slate-700" />
            <button
              onClick={() => setSelectedOrgIds(new Set())}
              className="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            >
              إلغاء التحديد
            </button>
          </div>
        </div>
      )}

      <SlideOver
        open={selectedOrg !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedOrg(null);
        }}
      >
        <SlideOverContent>
          {selectedOrg && (
            <>
              <SlideOverHeader>
                <SlideOverTitle>تفاصيل المكتب</SlideOverTitle>
                <SlideOverDescription>معلومات المكتب، حالة الاشتراك، والإجراءات المتاحة.</SlideOverDescription>
              </SlideOverHeader>

              <div className="space-y-6">
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
                  <div className="flex items-center gap-4 border-b border-slate-200 pb-4 dark:border-slate-800">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-emerald/10 text-brand-emerald dark:bg-emerald-500/20 dark:text-emerald-400">
                      <Building className="h-6 w-6" />
                    </div>
                    <div>
                      <h4 className="text-lg font-bold text-brand-navy dark:text-slate-100">{selectedOrg.name}</h4>
                      <div className="mt-1 flex items-center gap-2 text-sm text-slate-500">
                        <Users className="h-3.5 w-3.5" />
                        <span>عدد المستخدمين: {selectedOrg.members_count}</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="mb-1 flex items-center gap-1 text-slate-500 dark:text-slate-400">
                        <Calendar className="h-3.5 w-3.5" /> تاريخ الإنشاء
                      </p>
                      <p className="font-medium text-slate-900 dark:text-slate-100">{formatArabicDate(selectedOrg.created_at)}</p>
                    </div>
                    <div>
                      <p className="mb-1 flex items-center gap-1 text-slate-500 dark:text-slate-400">
                        <Activity className="h-3.5 w-3.5" /> حالة المكتب
                      </p>
                      <div className="flex flex-col items-start gap-1">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            selectedOrg.status === 'suspended'
                              ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                              : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                          }`}
                        >
                          {selectedOrg.status === 'suspended' ? 'معلّق' : 'نشط'}
                        </span>
                        {isExpired(selectedOrg) && selectedOrg.status !== 'suspended' && (
                          <span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:bg-red-900/40 dark:text-red-300">
                            منتهي الصلاحية
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="mb-3 flex items-center gap-2 text-base font-semibold text-brand-navy dark:text-slate-100">
                    <Users className="h-4 w-4 text-brand-emerald" />
                    الحسابات المرتبطة
                  </h4>
                  {selectedOrg.linked_accounts.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
                      لا يوجد أي حساب مرتبط بهذا المكتب.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {selectedOrg.linked_accounts.map((account) => (
                        <div
                          key={account.membership_id}
                          className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/40"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="font-medium text-slate-900 dark:text-slate-100">
                                {account.full_name || 'بدون اسم'}
                              </p>
                              <p className="text-xs text-slate-500 dark:text-slate-400" dir="ltr">
                                {account.email || '—'}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              {account.is_app_admin && (
                                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                                  إدارة
                                </span>
                              )}
                              <span className="rounded-full bg-brand-emerald/10 px-2 py-0.5 text-xs font-medium text-brand-emerald dark:bg-emerald-500/20 dark:text-emerald-300">
                                {getRoleLabel(account.role)}
                              </span>
                              <span
                                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                  account.status === 'suspended'
                                    ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                                    : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                }`}
                              >
                                {account.status === 'suspended' ? 'معلّق' : 'نشط'}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <h4 className="mb-3 flex items-center gap-2 text-base font-semibold text-brand-navy dark:text-slate-100">
                    <CreditCard className="h-4 w-4 text-brand-emerald" />
                    معلومات الاشتراك
                  </h4>
                  <div className="space-y-3">
                    <InfoCard label="الخطة الحالية" value={getPlanLabel(selectedOrg.subscription?.plan)} />
                    <InfoCard label="حالة الاشتراك" value={selectedOrg.subscription?.status ?? 'تجريبي'} />
                    <InfoCard
                      label="تاريخ الانتهاء"
                      value={
                        selectedOrg.subscription?.current_period_end
                          ? formatArabicDate(selectedOrg.subscription.current_period_end)
                          : selectedOrg.trial?.ends_at
                            ? formatArabicDate(selectedOrg.trial.ends_at)
                            : '—'
                      }
                    />
                  </div>
                </div>

                <div>
                  <h4 className="mb-3 flex items-center gap-2 text-base font-semibold text-brand-navy dark:text-slate-100">
                    <Shield className="h-4 w-4 text-brand-emerald" />
                    خيارات الإجراءات
                  </h4>
                  <div className="grid gap-3">
                    <ActionCard
                      icon={<Shield className="h-4 w-4" />}
                      title={selectedOrg.status === 'suspended' ? 'إلغاء تعليق المكتب' : 'تعليق المكتب'}
                      description={
                        selectedOrg.status === 'suspended'
                          ? 'إعادة تفعيل المكتب والسماح له بالعودة للنظام.'
                          : 'إيقاف المكتب مؤقتًا بدون حذف بياناته.'
                      }
                      tone={selectedOrg.status === 'suspended' ? 'emerald' : 'amber'}
                      disabled={actionId === selectedOrg.id}
                      onClick={() => requestConfirmation(selectedOrg, selectedOrg.status === 'suspended' ? 'activate' : 'suspend')}
                    />
                    <ActionCard
                      icon={<Sparkles className="h-4 w-4" />}
                      title="تفعيل اشتراك"
                      description="اختر الباقة والمدة: شهر، سنة، أو مدة مخصصة بالشهور أو السنوات."
                      tone="emerald"
                      disabled={actionId === selectedOrg.id}
                      onClick={() => openActivationDialog(selectedOrg)}
                    />
                    <ActionCard
                      icon={<TimerReset className="h-4 w-4" />}
                      title="تمديد الفترة التجريبية"
                      description="مدد التجربة لعدد الأيام الذي تحدده بدل التمديد الثابت 14 يوم."
                      tone="slate"
                      disabled={actionId === selectedOrg.id}
                      onClick={() => openTrialDialog(selectedOrg)}
                    />
                    <ActionCard
                      icon={<Trash2 className="h-4 w-4" />}
                      title="حذف نهائي"
                      description="حذف المكتب نهائيًا مع بياناته. استخدمه فقط عند الضرورة."
                      tone="red"
                      disabled={actionId === selectedOrg.id}
                      onClick={() => requestConfirmation(selectedOrg, 'delete')}
                    />
                  </div>

                  {selectedOrg.has_admin_account && (
                    <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/30 dark:bg-amber-950/20">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">خيار خاص بحساب الإدارة</p>
                          <p className="mt-1 text-sm leading-6 text-amber-800 dark:text-amber-300">
                            اشتراك مدى الحياة مخفي عن بقية المكاتب، ولا يظهر إلا للمكتب المرتبط بحساب إدارة فعلي.
                          </p>
                        </div>
                        <button
                          type="button"
                          className={`${buttonVariants('outline', 'sm')} border-amber-300 text-amber-900 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-200 dark:hover:bg-amber-900/30`}
                          onClick={() => requestConfirmation(selectedOrg, 'grant_lifetime')}
                          disabled={actionId === selectedOrg.id}
                        >
                          مدى الحياة
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </SlideOverContent>
      </SlideOver>

      <ConfirmDialog
        open={confirmAction !== null}
        title={confirmAction?.title || ''}
        message={confirmAction?.message || ''}
        confirmLabel={confirmAction?.confirmLabel || 'تأكيد'}
        destructive={Boolean(confirmAction?.destructive)}
        busy={actionId === confirmAction?.org.id}
        onCancel={() => setConfirmAction(null)}
        onConfirm={executeConfirmedAction}
      />

      {activationDialog && (
        <ModalShell
          title="تفعيل اشتراك"
          description={`تفعيل اشتراك للمكتب "${activationDialog.org.name}" مع تحديد الباقة والمدة.`}
          onClose={() => setActivationDialog(null)}
        >
          <div className="space-y-4">
            <FormField label="الباقة">
              <select
                value={activationDialog.plan}
                onChange={(event) =>
                  setActivationDialog((current) =>
                    current
                      ? {
                          ...current,
                          plan: event.target.value,
                        }
                      : current,
                  )
                }
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-emerald focus:outline-none focus:ring-1 focus:ring-brand-emerald dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                {PLAN_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="مدة التفعيل">
              <select
                value={activationDialog.durationMode}
                onChange={(event) =>
                  setActivationDialog((current) =>
                    current
                      ? {
                          ...current,
                          durationMode: event.target.value as ActivationDurationMode,
                          durationValue:
                            event.target.value === 'custom_years' || event.target.value === 'custom_months'
                              ? '1'
                              : current.durationValue,
                        }
                      : current,
                  )
                }
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-emerald focus:outline-none focus:ring-1 focus:ring-brand-emerald dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                {DURATION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
                {activationDialog.org.has_admin_account && <option value="lifetime">مدى الحياة</option>}
              </select>
            </FormField>

            {(activationDialog.durationMode === 'custom_months' || activationDialog.durationMode === 'custom_years') && (
              <FormField label={getCustomDurationLabel(activationDialog.durationMode)}>
                <input
                  type="number"
                  min={1}
                  max={activationDialog.durationMode === 'custom_years' ? 20 : 240}
                  value={activationDialog.durationValue}
                  onChange={(event) =>
                    setActivationDialog((current) =>
                      current
                        ? {
                            ...current,
                            durationValue: event.target.value,
                          }
                        : current,
                    )
                  }
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-emerald focus:outline-none focus:ring-1 focus:ring-brand-emerald dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
              </FormField>
            )}

            <div className="rounded-xl border border-brand-emerald/20 bg-brand-emerald/5 p-4 text-sm text-slate-700 dark:border-emerald-900/30 dark:bg-emerald-950/20 dark:text-slate-200">
              <p className="font-semibold text-brand-navy dark:text-slate-100">ملخص التفعيل</p>
              <p className="mt-2">الباقة المختارة: {getPlanLabel(activationDialog.plan)}</p>
              <p className="mt-1">تاريخ الانتهاء المتوقع: {buildNextExpiryLabel(activationDialog.durationMode, activationDialog.durationValue)}</p>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setActivationDialog(null)} disabled={actionId === activationDialog.org.id}>
              إلغاء
            </Button>
            <Button type="button" onClick={submitActivationDialog} disabled={actionId === activationDialog.org.id}>
              {actionId === activationDialog.org.id ? 'جارٍ التفعيل...' : 'تفعيل الاشتراك'}
            </Button>
          </div>
        </ModalShell>
      )}

      {trialDialog && (
        <ModalShell
          title="تمديد الفترة التجريبية"
          description={`تمديد تجربة المكتب "${trialDialog.org.name}" لعدد أيام تختاره.`}
          onClose={() => setTrialDialog(null)}
        >
          <div className="space-y-4">
            <FormField label="عدد الأيام">
              <input
                type="number"
                min={1}
                max={365}
                value={trialDialog.days}
                onChange={(event) =>
                  setTrialDialog((current) =>
                    current
                      ? {
                          ...current,
                          days: event.target.value,
                        }
                      : current,
                  )
                }
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-emerald focus:outline-none focus:ring-1 focus:ring-brand-emerald dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </FormField>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-200">
              <p>النهاية الحالية: {formatArabicDate(trialDialog.org.trial?.ends_at)}</p>
              <p className="mt-1">عدد الأيام الجديدة: {clampPositiveNumber(trialDialog.days, 14, 365)} يوم</p>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setTrialDialog(null)} disabled={actionId === trialDialog.org.id}>
              إلغاء
            </Button>
            <Button type="button" onClick={submitTrialDialog} disabled={actionId === trialDialog.org.id}>
              {actionId === trialDialog.org.id ? 'جارٍ الحفظ...' : 'تمديد الفترة'}
            </Button>
          </div>
        </ModalShell>
      )}
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/50">
      <p className="mb-1 text-sm text-slate-500 dark:text-slate-400">{label}</p>
      <p className="font-medium text-slate-900 dark:text-slate-100">{value}</p>
    </div>
  );
}

function ActionCard({
  icon,
  title,
  description,
  tone,
  onClick,
  disabled,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  tone: 'emerald' | 'amber' | 'red' | 'slate';
  onClick: () => void;
  disabled?: boolean;
}) {
  const toneClassMap = {
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-900/30 dark:bg-emerald-950/20 dark:text-emerald-300 dark:hover:bg-emerald-900/30',
    amber: 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-300 dark:hover:bg-amber-900/30',
    red: 'border-red-200 bg-red-50 text-red-800 hover:bg-red-100 dark:border-red-900/30 dark:bg-red-950/20 dark:text-red-300 dark:hover:bg-red-900/30',
    slate: 'border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-200 dark:hover:bg-slate-800',
  } as const;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-full rounded-xl border p-4 text-start transition ${toneClassMap[tone]} disabled:cursor-not-allowed disabled:opacity-60`}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5">{icon}</div>
        <div>
          <p className="font-semibold">{title}</p>
          <p className="mt-1 text-sm leading-6 opacity-90">{description}</p>
        </div>
      </div>
    </button>
  );
}

function ModalShell({
  title,
  description,
  children,
  onClose,
}: {
  title: string;
  description: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="mobile-modal-panel w-full max-w-xl rounded-xl border border-brand-border bg-white p-4 shadow-panel sm:p-5 dark:border-slate-700 dark:bg-slate-900"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-brand-navy dark:text-slate-100">{title}</h3>
            <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-300">{description}</p>
          </div>
          <button type="button" className={buttonVariants('ghost', 'sm')} onClick={onClose}>
            إغلاق
          </button>
        </div>
        <div className="mt-5">{children}</div>
      </div>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">{label}</span>
      {children}
    </label>
  );
}
