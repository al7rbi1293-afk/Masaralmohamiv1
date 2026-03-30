'use client';

import { useEffect, useState } from 'react';
import { SlideOver, SlideOverContent, SlideOverDescription, SlideOverHeader, SlideOverTitle } from '@/components/ui/slide-over';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { ActivationDialogPanel, OrgDetailsPanel, TrialDialogPanel } from './orgs-tab-panels';
import {
  OrgsBulkActionBar,
  OrgsPagination,
  OrgsSearchBar,
  OrgsTable,
} from './orgs-tab-sections';
import { clampPositiveNumber } from './orgs-tab-utils';
import type {
  ActivationDialogState,
  ConfirmActionState,
  Org,
  OrgAction,
  TrialDialogState,
} from './orgs-tab-types';

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

      <OrgsSearchBar searchTerm={searchTerm} onSearchTermChange={setSearchTerm} />

      <OrgsTable
        orgs={orgs}
        selectedOrgIds={selectedOrgIds}
        actionId={actionId}
        isExpired={isExpired}
        onSelectOrg={setSelectedOrg}
        onToggleSelection={toggleSelection}
        onToggleAllSelection={toggleAllSelection}
      />

      <OrgsPagination
        totalCount={totalCount}
        page={page}
        totalPages={totalPages}
        loading={loading}
        onPrev={() => setPage((current) => Math.max(1, current - 1))}
        onNext={() => setPage((current) => current + 1)}
      />

      <OrgsBulkActionBar
        selectedCount={selectedOrgIds.size}
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
        onClear={() => setSelectedOrgIds(new Set())}
      />

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
              <OrgDetailsPanel
                org={selectedOrg}
                actionId={actionId}
                isExpired={isExpired}
                onRequestConfirmation={requestConfirmation}
                onOpenActivationDialog={openActivationDialog}
                onOpenTrialDialog={openTrialDialog}
              />
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
        <ActivationDialogPanel
          activationDialog={activationDialog}
          actionId={actionId}
          setActivationDialog={setActivationDialog}
          submitActivationDialog={submitActivationDialog}
        />
      )}

      {trialDialog && (
        <TrialDialogPanel
          trialDialog={trialDialog}
          actionId={actionId}
          setTrialDialog={setTrialDialog}
          submitTrialDialog={submitTrialDialog}
        />
      )}
    </div>
  );
}
