'use client';

import { useEffect, useMemo, useState } from 'react';
import { getPricingPlanCardByCode } from '@/lib/subscription-pricing';
import {
  ActivationRequestsPanel,
  LeadsPanel,
  RequestsTabs,
  SubscriptionRequestsPanel,
} from './requests-tab-sections';
import type {
  RequestDeleteKind,
  RequestsPayload,
  RequestsTabId,
  SubRequest,
  FullVersionRequest,
  Lead,
} from './requests-tab-types';

function actionKey(id: string, kind: RequestDeleteKind) {
  return `${kind}:${id}`;
}

export default function AdminRequestsPage() {
  const [requests, setRequests] = useState<SubRequest[]>([]);
  const [fullVersionRequests, setFullVersionRequests] = useState<FullVersionRequest[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<RequestsTabId>('subscription');
  const [loadError, setLoadError] = useState<string | null>(null);

  async function fetchRequests() {
    const response = await fetch('/admin/api/requests');
    const payload: RequestsPayload = await response.json();

    if (!response.ok) {
      throw new Error((payload as { error?: string }).error ?? 'تعذر تحميل الطلبات.');
    }

    setRequests(payload.requests ?? []);
    setFullVersionRequests(payload.fullVersionRequests ?? []);
    setLeads(payload.leads ?? []);
  }

  useEffect(() => {
    fetchRequests()
      .catch((error) => {
        const message = error instanceof Error ? error.message : 'تعذر تحميل الطلبات.';
        setLoadError(message);
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleAction(id: string, requestKind: SubRequest['request_kind'], action: 'approve' | 'reject') {
    const notes = action === 'reject' ? prompt('سبب الرفض (اختياري):') : null;
    const key = actionKey(id, requestKind);
    setActionId(key);
    setLoadError(null);

    try {
      const response = await fetch('/admin/api/requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action, notes, request_kind: requestKind }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error((payload as { error?: string }).error ?? 'تعذر تحديث الطلب.');
      }
      await fetchRequests();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'تعذر تحديث الطلب.';
      setLoadError(message);
    } finally {
      setActionId(null);
    }
  }

  async function handleDelete(id: string, kind: RequestDeleteKind) {
    const proceed = window.confirm('سيتم حذف هذا الطلب نهائيًا. هل تريد المتابعة؟');
    if (!proceed) return;

    const key = actionKey(id, kind);
    setActionId(key);
    setLoadError(null);

    try {
      const response = await fetch('/admin/api/requests', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, kind }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error((payload as { error?: string }).error ?? 'تعذر حذف الطلب.');
      }
      await fetchRequests();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'تعذر حذف الطلب.';
      setLoadError(message);
    } finally {
      setActionId(null);
    }
  }

  const statusBadge = (status: string) => {
    if (status === 'approved') return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300';
    if (status === 'rejected') return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
    return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
  };

  const statusLabel = (status: string) => {
    if (status === 'approved') return 'مقبول';
    if (status === 'rejected') return 'مرفوض';
    return 'قيد الانتظار';
  };

  const planLabel = (planCode: string) => {
    const card = getPricingPlanCardByCode(planCode);
    if (card) {
      return `${card.title} (${card.seatsLabel.replace('حد المقاعد: ', '')})`;
    }
    return planCode;
  };

  const tabs = useMemo(
    () => [
      { id: 'subscription' as const, label: 'طلبات الاشتراك', count: requests.length },
      { id: 'activation' as const, label: 'طلبات التفعيل/الحذف', count: fullVersionRequests.length },
      { id: 'leads' as const, label: 'طلبات التسويق (Leads)', count: leads.length },
    ],
    [requests.length, fullVersionRequests.length, leads.length],
  );

  if (loading) {
    return <div className="animate-pulse text-slate-500">جارٍ التحميل...</div>;
  }

  if (loadError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/10 dark:text-red-300">
        {loadError}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-brand-navy dark:text-slate-100">إدارة الطلبات</h1>

      <RequestsTabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === 'subscription' ? (
        <SubscriptionRequestsPanel
          requests={requests}
          actionId={actionId}
          actionKey={actionKey}
          statusBadge={statusBadge}
          statusLabel={statusLabel}
          planLabel={planLabel}
          onAction={handleAction}
          onDelete={handleDelete}
        />
      ) : null}

      {activeTab === 'activation' ? (
        <ActivationRequestsPanel
          requests={fullVersionRequests}
          actionId={actionId}
          actionKey={actionKey}
          compactText={compactText}
          onDelete={handleDelete}
        />
      ) : null}

      {activeTab === 'leads' ? (
        <LeadsPanel
          leads={leads}
          actionId={actionId}
          actionKey={actionKey}
          compactText={compactText}
          onDelete={handleDelete}
        />
      ) : null}
    </div>
  );
}

function compactText(value: string | null, max = 120) {
  if (!value) return '—';
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max)}...`;
}
