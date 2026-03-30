'use client';

import { useEffect, useState } from 'react';
import { applyApplicationResult } from './partners-tab-helpers';
import {
  APPLICATION_STATUS_OPTIONS,
  COMMISSION_STATUS_OPTIONS,
  PAYOUT_STATUS_OPTIONS,
  type AuditRow,
  type CommissionRow,
  type PartnerApplication,
  type PartnerRow,
  type PartnersView,
  type PayoutRow,
} from './partners-tab-types';
import {
  ApplicationsPanel,
  AuditPanel,
  CommissionsPanel,
  PartnersFilters,
  PartnersPanel,
  PartnersTabs,
  PayoutsPanel,
} from './partners-tab-ui';

export default function PartnersTab() {
  const [view, setView] = useState<PartnersView>('applications');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [applicationStatus, setApplicationStatus] = useState<(typeof APPLICATION_STATUS_OPTIONS)[number]>('all');
  const [commissionStatus, setCommissionStatus] = useState<(typeof COMMISSION_STATUS_OPTIONS)[number]>('all');
  const [payoutStatus, setPayoutStatus] = useState<(typeof PAYOUT_STATUS_OPTIONS)[number]>('all');
  const [partnerActive, setPartnerActive] = useState<'all' | 'active' | 'inactive'>('all');

  const [applications, setApplications] = useState<PartnerApplication[]>([]);
  const [partners, setPartners] = useState<PartnerRow[]>([]);
  const [commissions, setCommissions] = useState<CommissionRow[]>([]);
  const [payouts, setPayouts] = useState<PayoutRow[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditRow[]>([]);

  async function fetchJson(url: string, init?: RequestInit) {
    const response = await fetch(url, {
      cache: 'no-store',
      ...init,
      headers: {
        'Cache-Control': 'no-store',
        ...(init?.headers || {}),
      },
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || 'تعذر تحميل البيانات.');
    }

    return payload;
  }

  async function loadCurrentView() {
    setLoading(true);
    setError(null);

    try {
      if (view === 'applications') {
        const payload = await fetchJson(
          `/admin/api/partners/applications?status=${applicationStatus}&query=${encodeURIComponent(query)}`,
        );
        setApplications(payload.applications || []);
      }

      if (view === 'partners') {
        const payload = await fetchJson(
          `/admin/api/partners/partners?active=${partnerActive}&query=${encodeURIComponent(query)}`,
        );
        setPartners(payload.partners || []);
      }

      if (view === 'commissions') {
        const payload = await fetchJson(
          `/admin/api/partners/commissions?status=${commissionStatus}&query=${encodeURIComponent(query)}`,
        );
        setCommissions(payload.commissions || []);
      }

      if (view === 'payouts') {
        const payload = await fetchJson(`/admin/api/partners/payouts?status=${payoutStatus}`);
        setPayouts(payload.payouts || []);
      }

      if (view === 'audit') {
        const payload = await fetchJson('/admin/api/partners/audit');
        setAuditLogs(payload.logs || []);
      }
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'حدث خطأ أثناء تحميل البيانات.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCurrentView();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, applicationStatus, commissionStatus, payoutStatus, partnerActive, query]);

  async function patch(url: string, body: Record<string, unknown>) {
    return fetchJson(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  async function applyApplicationAction(id: string, action: 'approve' | 'reject' | 'needs_review' | 'delete') {
    if (action === 'delete') {
      const proceed = window.confirm('سيتم حذف طلب الشريك نهائيًا. هل تريد المتابعة؟');
      if (!proceed) return;
    }

    const notes =
      action === 'reject' || action === 'needs_review' ? prompt('ملاحظات الإدارة (اختياري):') || undefined : undefined;

    setActionBusy(id);
    setError(null);
    try {
      const payload = await patch('/admin/api/partners/applications', {
        id,
        action,
        admin_notes: notes,
      });
      if (action === 'delete') {
        setApplications((current) => current.filter((application) => application.id !== id));
      } else {
        setApplications((current) => applyApplicationResult(current, payload.result, applicationStatus, id, notes));
      }
      await loadCurrentView();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'تعذر تحديث الطلب.');
    } finally {
      setActionBusy(null);
    }
  }

  async function applyPartnerAction(id: string, action: 'regenerate_code' | 'deactivate' | 'reactivate' | 'delete') {
    if (action === 'regenerate_code') {
      const proceed = window.confirm('سيتم إنشاء كود إحالة جديد، هل تريد المتابعة؟');
      if (!proceed) return;
    }

    if (action === 'delete') {
      const proceed = window.confirm(
        'تحذير: سيتم حذف هذا الشريك وكافة سجلاته (الزيارات، العملاء، العمولات، والدفعات) نهائياً. لن يتأثر حساب المستخدم أو المكتب الخاص به. هل أنت متأكد؟',
      );
      if (!proceed) return;
    }

    setActionBusy(id);
    setError(null);
    try {
      await patch('/admin/api/partners/partners', { id, action });
      await loadCurrentView();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'تعذر تحديث الشريك.');
    } finally {
      setActionBusy(null);
    }
  }

  async function applyCommissionAction(id: string, action: 'approve' | 'mark_payable' | 'mark_paid' | 'reverse') {
    const notes = action === 'reverse' ? prompt('سبب عكس العمولة (اختياري):') || undefined : undefined;

    setActionBusy(id);
    setError(null);
    try {
      await patch('/admin/api/partners/commissions', { id, action, notes });
      await loadCurrentView();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'تعذر تحديث العمولة.');
    } finally {
      setActionBusy(null);
    }
  }

  async function applyPayoutAction(id: string, action: 'mark_processing' | 'mark_paid' | 'mark_failed' | 'cancel') {
    const reference_number = action === 'mark_paid' ? prompt('أدخل مرجع عملية الصرف (اختياري):') || undefined : undefined;

    setActionBusy(id);
    setError(null);
    try {
      await patch('/admin/api/partners/payouts', { id, action, reference_number });
      await loadCurrentView();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'تعذر تحديث حالة الصرف.');
    } finally {
      setActionBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-navy dark:text-slate-100">شركاء النجاح</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          إدارة طلبات البرنامج، الشركاء المعتمدين، العمولات، الدفعات، وسجل العمليات.
        </p>
      </div>

      <PartnersTabs view={view} onChange={setView} />

      <PartnersFilters
        view={view}
        query={query}
        applicationStatus={applicationStatus}
        commissionStatus={commissionStatus}
        payoutStatus={payoutStatus}
        partnerActive={partnerActive}
        onQueryChange={setQuery}
        onApplicationStatusChange={setApplicationStatus}
        onCommissionStatusChange={setCommissionStatus}
        onPayoutStatusChange={setPayoutStatus}
        onPartnerActiveChange={setPartnerActive}
      />

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </p>
      ) : null}

      {loading ? <p className="animate-pulse text-sm text-slate-500">جارٍ التحميل...</p> : null}

      {!loading && view === 'applications' ? (
        <ApplicationsPanel applications={applications} actionBusy={actionBusy} onAction={applyApplicationAction} />
      ) : null}

      {!loading && view === 'partners' ? (
        <PartnersPanel partners={partners} actionBusy={actionBusy} onAction={applyPartnerAction} />
      ) : null}

      {!loading && view === 'commissions' ? (
        <CommissionsPanel commissions={commissions} actionBusy={actionBusy} onAction={applyCommissionAction} />
      ) : null}

      {!loading && view === 'payouts' ? (
        <PayoutsPanel payouts={payouts} actionBusy={actionBusy} onAction={applyPayoutAction} />
      ) : null}

      {!loading && view === 'audit' ? <AuditPanel logs={auditLogs} /> : null}
    </div>
  );
}
