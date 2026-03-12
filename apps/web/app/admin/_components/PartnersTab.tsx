'use client';

import { useEffect, useMemo, useState } from 'react';

type PartnerApplication = {
  id: string;
  full_name: string;
  whatsapp_number: string;
  email: string;
  city: string;
  marketing_experience: string;
  audience_notes: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'needs_review';
  admin_notes: string | null;
  created_at: string;
};

type PartnerRow = {
  id: string;
  full_name: string;
  whatsapp_number: string;
  email: string;
  partner_code: string;
  referral_link: string;
  is_active: boolean;
  stats: {
    clicksCount: number;
    signupsCount: number;
    subscribedCount: number;
    totalCommissionAmount: number;
  };
};

type CommissionRow = {
  id: string;
  partner_id: string;
  payment_id: string;
  currency: string;
  base_amount: number;
  partner_amount: number;
  marketing_amount: number;
  status: 'pending' | 'approved' | 'payable' | 'paid' | 'reversed';
  created_at: string;
  notes: string | null;
  partner: {
    id: string;
    full_name: string;
    partner_code: string;
    email: string;
  } | null;
};

type PayoutRow = {
  id: string;
  partner_id: string;
  partner_name: string;
  period_start: string;
  period_end: string;
  total_amount: number;
  payout_method: string | null;
  reference_number: string | null;
  status: 'pending' | 'processing' | 'paid' | 'failed' | 'cancelled';
  pending_amount_for_partner: number;
  created_at: string;
};

type AuditRow = {
  id: string;
  action: string;
  target_type: string;
  target_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
};

type PartnersView = 'applications' | 'partners' | 'commissions' | 'payouts' | 'audit';

const APPLICATION_STATUS_OPTIONS = ['all', 'pending', 'approved', 'rejected', 'needs_review'] as const;
const COMMISSION_STATUS_OPTIONS = ['all', 'pending', 'approved', 'payable', 'paid', 'reversed'] as const;
const PAYOUT_STATUS_OPTIONS = ['all', 'pending', 'processing', 'paid', 'failed', 'cancelled'] as const;

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

  async function loadCurrentView() {
    setLoading(true);
    setError(null);

    try {
      if (view === 'applications') {
        const res = await fetch(`/admin/api/partners/applications?status=${applicationStatus}&query=${encodeURIComponent(query)}`);
        const payload = await res.json();
        if (!res.ok) throw new Error(payload.error || 'تعذر جلب طلبات الشركاء.');
        setApplications(payload.applications || []);
      }

      if (view === 'partners') {
        const res = await fetch(`/admin/api/partners/partners?active=${partnerActive}&query=${encodeURIComponent(query)}`);
        const payload = await res.json();
        if (!res.ok) throw new Error(payload.error || 'تعذر جلب الشركاء.');
        setPartners(payload.partners || []);
      }

      if (view === 'commissions') {
        const res = await fetch(`/admin/api/partners/commissions?status=${commissionStatus}&query=${encodeURIComponent(query)}`);
        const payload = await res.json();
        if (!res.ok) throw new Error(payload.error || 'تعذر جلب العمولات.');
        setCommissions(payload.commissions || []);
      }

      if (view === 'payouts') {
        const res = await fetch(`/admin/api/partners/payouts?status=${payoutStatus}`);
        const payload = await res.json();
        if (!res.ok) throw new Error(payload.error || 'تعذر جلب الدفعات.');
        setPayouts(payload.payouts || []);
      }

      if (view === 'audit') {
        const res = await fetch('/admin/api/partners/audit');
        const payload = await res.json();
        if (!res.ok) throw new Error(payload.error || 'تعذر جلب السجل.');
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
    const response = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || 'تعذر تنفيذ العملية.');
    }

    return payload;
  }

  async function applyApplicationAction(id: string, action: 'approve' | 'reject' | 'needs_review') {
    const notes = action === 'reject' || action === 'needs_review'
      ? prompt('ملاحظات الإدارة (اختياري):') || undefined
      : undefined;

    setActionBusy(id);
    setError(null);
    try {
      await patch('/admin/api/partners/applications', {
        id,
        action,
        admin_notes: notes,
      });
      await loadCurrentView();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'تعذر تحديث الطلب.');
    } finally {
      setActionBusy(null);
    }
  }

  async function applyPartnerAction(id: string, action: 'regenerate_code' | 'deactivate' | 'reactivate') {
    if (action === 'regenerate_code') {
      const proceed = window.confirm('سيتم إنشاء كود إحالة جديد، هل تريد المتابعة؟');
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
    const reference_number = action === 'mark_paid'
      ? prompt('أدخل مرجع عملية الصرف (اختياري):') || undefined
      : undefined;

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

  const tabs = useMemo(
    () => [
      { id: 'applications' as const, label: 'Applications' },
      { id: 'partners' as const, label: 'Partners' },
      { id: 'commissions' as const, label: 'Commissions' },
      { id: 'payouts' as const, label: 'Payouts' },
      { id: 'audit' as const, label: 'Audit Logs' },
    ],
    [],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-navy dark:text-slate-100">شركاء النجاح</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          إدارة طلبات البرنامج، الشركاء المعتمدين، العمولات، الدفعات، وسجل العمليات.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setView(tab.id)}
            className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
              view === tab.id
                ? 'border-brand-green bg-brand-green text-white'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {(view === 'applications' || view === 'partners' || view === 'commissions') ? (
        <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="h-10 rounded-lg border border-brand-border px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
            placeholder="بحث بالاسم / البريد / الجوال / كود الشريك"
          />

          {view === 'applications' ? (
            <select
              value={applicationStatus}
              onChange={(event) => setApplicationStatus(event.target.value as any)}
              className="h-10 rounded-lg border border-brand-border px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
            >
              {APPLICATION_STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          ) : null}

          {view === 'partners' ? (
            <select
              value={partnerActive}
              onChange={(event) => setPartnerActive(event.target.value as any)}
              className="h-10 rounded-lg border border-brand-border px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
            >
              <option value="all">all</option>
              <option value="active">active</option>
              <option value="inactive">inactive</option>
            </select>
          ) : null}

          {view === 'commissions' ? (
            <select
              value={commissionStatus}
              onChange={(event) => setCommissionStatus(event.target.value as any)}
              className="h-10 rounded-lg border border-brand-border px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
            >
              {COMMISSION_STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          ) : null}
        </div>
      ) : null}

      {view === 'payouts' ? (
        <div className="flex justify-end">
          <select
            value={payoutStatus}
            onChange={(event) => setPayoutStatus(event.target.value as any)}
            className="h-10 rounded-lg border border-brand-border px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
          >
            {PAYOUT_STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </div>
      ) : null}

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="animate-pulse text-sm text-slate-500">جارٍ التحميل...</p>
      ) : null}

      {!loading && view === 'applications' ? (
        <div className="overflow-x-auto rounded-xl border border-brand-border bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
          <table className="min-w-full text-sm">
            <thead className="border-b border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300">
              <tr>
                <th className="py-3 text-start font-medium">الاسم</th>
                <th className="py-3 text-start font-medium">البريد</th>
                <th className="py-3 text-start font-medium">الواتساب</th>
                <th className="py-3 text-start font-medium">المدينة</th>
                <th className="py-3 text-start font-medium">الحالة</th>
                <th className="py-3 text-start font-medium">التاريخ</th>
                <th className="py-3 text-start font-medium">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {applications.map((application) => (
                <tr key={application.id} className="align-top">
                  <td className="py-3 font-medium">{application.full_name}</td>
                  <td className="py-3">{application.email}</td>
                  <td className="py-3">{application.whatsapp_number}</td>
                  <td className="py-3">{application.city}</td>
                  <td className="py-3">{application.status}</td>
                  <td className="py-3">{new Date(application.created_at).toLocaleString('ar-SA')}</td>
                  <td className="py-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        disabled={actionBusy === application.id}
                        onClick={() => applyApplicationAction(application.id, 'approve')}
                        className="rounded bg-emerald-600 px-2 py-1 text-xs text-white disabled:opacity-50"
                      >
                        approve
                      </button>
                      <button
                        disabled={actionBusy === application.id}
                        onClick={() => applyApplicationAction(application.id, 'needs_review')}
                        className="rounded bg-amber-600 px-2 py-1 text-xs text-white disabled:opacity-50"
                      >
                        needs_review
                      </button>
                      <button
                        disabled={actionBusy === application.id}
                        onClick={() => applyApplicationAction(application.id, 'reject')}
                        className="rounded bg-red-600 px-2 py-1 text-xs text-white disabled:opacity-50"
                      >
                        reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {applications.length === 0 ? (
                <tr>
                  <td className="py-4 text-center text-slate-500" colSpan={7}>لا توجد طلبات حالياً.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : null}

      {!loading && view === 'partners' ? (
        <div className="overflow-x-auto rounded-xl border border-brand-border bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
          <table className="min-w-full text-sm">
            <thead className="border-b border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300">
              <tr>
                <th className="py-3 text-start font-medium">الاسم</th>
                <th className="py-3 text-start font-medium">البريد</th>
                <th className="py-3 text-start font-medium">الواتساب</th>
                <th className="py-3 text-start font-medium">الكود</th>
                <th className="py-3 text-start font-medium">الرابط</th>
                <th className="py-3 text-start font-medium">الإحصائيات</th>
                <th className="py-3 text-start font-medium">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {partners.map((partner) => (
                <tr key={partner.id}>
                  <td className="py-3 font-medium">{partner.full_name}</td>
                  <td className="py-3">{partner.email}</td>
                  <td className="py-3">{partner.whatsapp_number}</td>
                  <td className="py-3"><code>{partner.partner_code}</code></td>
                  <td className="py-3 text-xs">
                    <a className="text-brand-emerald underline" href={partner.referral_link} target="_blank" rel="noreferrer">
                      فتح الرابط
                    </a>
                  </td>
                  <td className="py-3 text-xs text-slate-600 dark:text-slate-300">
                    زيارات: {partner.stats.clicksCount}<br />
                    تسجيلات: {partner.stats.signupsCount}<br />
                    اشتراكات: {partner.stats.subscribedCount}<br />
                    عمولات: {partner.stats.totalCommissionAmount.toFixed(2)} SAR
                  </td>
                  <td className="py-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        disabled={actionBusy === partner.id}
                        onClick={() => applyPartnerAction(partner.id, 'regenerate_code')}
                        className="rounded bg-slate-700 px-2 py-1 text-xs text-white disabled:opacity-50"
                      >
                        regenerate code
                      </button>
                      {partner.is_active ? (
                        <button
                          disabled={actionBusy === partner.id}
                          onClick={() => applyPartnerAction(partner.id, 'deactivate')}
                          className="rounded bg-red-600 px-2 py-1 text-xs text-white disabled:opacity-50"
                        >
                          deactivate
                        </button>
                      ) : (
                        <button
                          disabled={actionBusy === partner.id}
                          onClick={() => applyPartnerAction(partner.id, 'reactivate')}
                          className="rounded bg-emerald-600 px-2 py-1 text-xs text-white disabled:opacity-50"
                        >
                          reactivate
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {partners.length === 0 ? (
                <tr>
                  <td className="py-4 text-center text-slate-500" colSpan={7}>لا يوجد شركاء معتمدون.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : null}

      {!loading && view === 'commissions' ? (
        <div className="overflow-x-auto rounded-xl border border-brand-border bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
          <table className="min-w-full text-sm">
            <thead className="border-b border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300">
              <tr>
                <th className="py-3 text-start font-medium">الشريك</th>
                <th className="py-3 text-start font-medium">payment_id</th>
                <th className="py-3 text-start font-medium">base</th>
                <th className="py-3 text-start font-medium">partner amount</th>
                <th className="py-3 text-start font-medium">marketing amount</th>
                <th className="py-3 text-start font-medium">status</th>
                <th className="py-3 text-start font-medium">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {commissions.map((commission) => (
                <tr key={commission.id}>
                  <td className="py-3">
                    {commission.partner?.full_name || '—'}
                    <div className="text-xs text-slate-500">{commission.partner?.partner_code || '—'}</div>
                  </td>
                  <td className="py-3"><code>{commission.payment_id}</code></td>
                  <td className="py-3">{Number(commission.base_amount).toFixed(2)} {commission.currency}</td>
                  <td className="py-3">{Number(commission.partner_amount).toFixed(2)} {commission.currency}</td>
                  <td className="py-3">{Number(commission.marketing_amount).toFixed(2)} {commission.currency}</td>
                  <td className="py-3">{commission.status}</td>
                  <td className="py-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        disabled={actionBusy === commission.id}
                        onClick={() => applyCommissionAction(commission.id, 'approve')}
                        className="rounded bg-emerald-600 px-2 py-1 text-xs text-white disabled:opacity-50"
                      >approve</button>
                      <button
                        disabled={actionBusy === commission.id}
                        onClick={() => applyCommissionAction(commission.id, 'mark_payable')}
                        className="rounded bg-indigo-600 px-2 py-1 text-xs text-white disabled:opacity-50"
                      >payable</button>
                      <button
                        disabled={actionBusy === commission.id}
                        onClick={() => applyCommissionAction(commission.id, 'mark_paid')}
                        className="rounded bg-slate-700 px-2 py-1 text-xs text-white disabled:opacity-50"
                      >paid</button>
                      <button
                        disabled={actionBusy === commission.id}
                        onClick={() => applyCommissionAction(commission.id, 'reverse')}
                        className="rounded bg-red-600 px-2 py-1 text-xs text-white disabled:opacity-50"
                      >reverse</button>
                    </div>
                  </td>
                </tr>
              ))}
              {commissions.length === 0 ? (
                <tr>
                  <td className="py-4 text-center text-slate-500" colSpan={7}>لا توجد عمولات.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : null}

      {!loading && view === 'payouts' ? (
        <div className="overflow-x-auto rounded-xl border border-brand-border bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
          <table className="min-w-full text-sm">
            <thead className="border-b border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300">
              <tr>
                <th className="py-3 text-start font-medium">الشريك</th>
                <th className="py-3 text-start font-medium">الفترة</th>
                <th className="py-3 text-start font-medium">المبلغ</th>
                <th className="py-3 text-start font-medium">الحالة</th>
                <th className="py-3 text-start font-medium">المرجع</th>
                <th className="py-3 text-start font-medium">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {payouts.map((payout) => (
                <tr key={payout.id}>
                  <td className="py-3">
                    {payout.partner_name}
                    <div className="text-xs text-slate-500">مستحق حالي: {Number(payout.pending_amount_for_partner).toFixed(2)} SAR</div>
                  </td>
                  <td className="py-3">{payout.period_start} → {payout.period_end}</td>
                  <td className="py-3">{Number(payout.total_amount).toFixed(2)} SAR</td>
                  <td className="py-3">{payout.status}</td>
                  <td className="py-3">{payout.reference_number || '—'}</td>
                  <td className="py-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        disabled={actionBusy === payout.id}
                        onClick={() => applyPayoutAction(payout.id, 'mark_processing')}
                        className="rounded bg-indigo-600 px-2 py-1 text-xs text-white disabled:opacity-50"
                      >processing</button>
                      <button
                        disabled={actionBusy === payout.id}
                        onClick={() => applyPayoutAction(payout.id, 'mark_paid')}
                        className="rounded bg-emerald-600 px-2 py-1 text-xs text-white disabled:opacity-50"
                      >paid</button>
                      <button
                        disabled={actionBusy === payout.id}
                        onClick={() => applyPayoutAction(payout.id, 'mark_failed')}
                        className="rounded bg-red-600 px-2 py-1 text-xs text-white disabled:opacity-50"
                      >failed</button>
                    </div>
                  </td>
                </tr>
              ))}
              {payouts.length === 0 ? (
                <tr>
                  <td className="py-4 text-center text-slate-500" colSpan={6}>لا توجد دفعات مسجلة حالياً.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : null}

      {!loading && view === 'audit' ? (
        <div className="overflow-x-auto rounded-xl border border-brand-border bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
          <table className="min-w-full text-sm">
            <thead className="border-b border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300">
              <tr>
                <th className="py-3 text-start font-medium">action</th>
                <th className="py-3 text-start font-medium">target</th>
                <th className="py-3 text-start font-medium">details</th>
                <th className="py-3 text-start font-medium">created_at</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {auditLogs.map((log) => (
                <tr key={log.id}>
                  <td className="py-3 font-medium">{log.action}</td>
                  <td className="py-3">{log.target_type}</td>
                  <td className="py-3 text-xs text-slate-500">{JSON.stringify(log.details).slice(0, 140)}</td>
                  <td className="py-3">{new Date(log.created_at).toLocaleString('ar-SA')}</td>
                </tr>
              ))}
              {auditLogs.length === 0 ? (
                <tr>
                  <td className="py-4 text-center text-slate-500" colSpan={4}>لا توجد سجلات.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
