'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

type NajizCaseDetailsClientProps = {
  matterId: string;
  caseNumber?: string | null;
  initialSyncStatus?: 'syncing' | 'idle';
};

type MatterOverview = {
  externalCase: {
    id: string;
    case_number: string | null;
    title: string;
    court: string | null;
    status: string | null;
    synced_at: string;
  } | null;
  events: Array<{
    id: string;
    title: string;
    description: string | null;
    event_type: string;
    occurred_at: string | null;
    synced_at: string;
  }>;
  judicialCosts: Array<{
    id: string;
    title: string;
    amount: number;
    currency: string;
    status: string;
    invoice_reference: string | null;
    due_at: string | null;
  }>;
  enforcementRequests: Array<{
    id: string;
    request_number: string | null;
    request_type: string;
    title: string;
    status: string;
    applicant_name: string | null;
    respondent_name: string | null;
    amount: number | null;
    currency: string;
    submitted_at: string | null;
    closed_at: string | null;
    synced_at: string;
    events: Array<{
      id: string;
      action_type: string;
      title: string;
      description: string | null;
      occurred_at: string | null;
      synced_at: string;
    }>;
  }>;
  documents: Array<{
    id: string;
    document_type: string;
    title: string;
    file_name: string;
    issued_at: string | null;
    portal_visible: boolean;
    synced_at: string;
  }>;
  sessionMinutes: Array<{
    id: string;
    session_reference: string | null;
    title: string;
    summary: string | null;
    occurred_at: string | null;
    synced_at: string;
  }>;
  jobs: Array<{
    id: string;
    status: string;
    jobKind: string;
    createdAt: string;
    errorMessage: string | null;
  }>;
};

export function NajizCaseDetailsClient({ matterId, caseNumber, initialSyncStatus = 'idle' }: NajizCaseDetailsClientProps) {
  const [syncing, setSyncing] = useState(initialSyncStatus === 'syncing');
  const [costSyncing, setCostSyncing] = useState(false);
  const [enforcementSyncing, setEnforcementSyncing] = useState(false);
  const [documentSyncing, setDocumentSyncing] = useState(false);
  const [minuteSyncing, setMinuteSyncing] = useState(false);
  const [refreshQueueing, setRefreshQueueing] = useState(false);
  const [overview, setOverview] = useState<MatterOverview | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoadingOverview(true);
    void fetchMatterOverview(matterId)
      .then(setOverview)
      .catch((err: any) => setError(err.message || 'تعذر تحميل بيانات Najiz للقضية.'))
      .finally(() => setLoadingOverview(false));
  }, [matterId]);

  const refreshOverview = async () => {
    setLoadingOverview(true);
    try {
      const refreshed = await fetchMatterOverview(matterId);
      setOverview(refreshed);
    } finally {
      setLoadingOverview(false);
    }
  };

  const handleSync = async () => {
    if (!caseNumber) {
      setError('يرجى إضافة رقم القضية في ناجز أولاً من خلال تعديل القضية المقيدة.');
      return;
    }

    setSyncing(true);
    setError(null);
    try {
      const response = await fetch(`/app/api/integrations/najiz/matters/${matterId}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ case_number: caseNumber })
      });
      const payload = await response.json();

      if (!response.ok) throw new Error(payload.error || 'فشل مزامنة بيانات القضية');
      await refreshOverview();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSyncing(false);
    }
  };

  const handleJudicialCostsSync = async () => {
    setCostSyncing(true);
    setError(null);
    try {
      const response = await fetch('/app/api/integrations/najiz/judicial-costs/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matter_id: matterId, case_number: caseNumber || undefined }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'فشل مزامنة التكاليف القضائية.');
      }
      await refreshOverview();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCostSyncing(false);
    }
  };

  const handleEnforcementSync = async () => {
    setEnforcementSyncing(true);
    setError(null);
    try {
      const response = await fetch('/app/api/integrations/najiz/enforcement-requests/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matter_id: matterId, case_number: caseNumber || undefined }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'فشل مزامنة طلبات التنفيذ.');
      }
      await refreshOverview();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setEnforcementSyncing(false);
    }
  };

  const handleDocumentSync = async () => {
    setDocumentSyncing(true);
    setError(null);
    try {
      const response = await fetch('/app/api/integrations/najiz/documents/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matter_id: matterId, case_number: caseNumber || undefined }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'فشل مزامنة المستندات.');
      }
      await refreshOverview();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDocumentSyncing(false);
    }
  };

  const handleSessionMinutesSync = async () => {
    setMinuteSyncing(true);
    setError(null);
    try {
      const response = await fetch('/app/api/integrations/najiz/session-minutes/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matter_id: matterId, case_number: caseNumber || undefined }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'فشل مزامنة محاضر الجلسات.');
      }
      await refreshOverview();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setMinuteSyncing(false);
    }
  };

  const handleFullRefresh = async () => {
    setRefreshQueueing(true);
    setError(null);
    try {
      const response = await fetch(`/app/api/integrations/najiz/matters/${matterId}/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ case_number: caseNumber || undefined }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'فشل جدولة التحديث الشامل.');
      }
      await refreshOverview();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setRefreshQueueing(false);
    }
  };

  return (
    <div className="p-4 mt-4 border border-brand-emerald bg-brand-emerald/5 dark:bg-emerald-950/20 dark:border-emerald-900 shadow-sm rounded-lg col-span-full transition-all hover:shadow-md space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="font-semibold text-brand-navy dark:text-slate-100 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-brand-emerald" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            تكامل المنصة الوطنية - ناجز
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            مزامنة تفاصيل القضية والجلسات الفورية من خلال الربط الحكومي
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={handleSync} disabled={syncing || !caseNumber} variant="primary" className="gap-2 shrink-0 bg-brand-emerald hover:bg-brand-emerald/90 text-white">
            {syncing ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                جاري مزامنة القضية...
              </>
            ) : (
              'مزامنة القضية'
            )}
          </Button>
          <Button
            onClick={handleJudicialCostsSync}
            disabled={costSyncing || syncing || enforcementSyncing || !caseNumber}
            variant="outline"
            className="gap-2 shrink-0"
          >
            {costSyncing ? 'جاري مزامنة التكاليف...' : 'مزامنة التكاليف القضائية'}
          </Button>
          <Button
            onClick={handleEnforcementSync}
            disabled={enforcementSyncing || syncing || costSyncing || documentSyncing || minuteSyncing || !caseNumber}
            variant="outline"
            className="gap-2 shrink-0"
          >
            {enforcementSyncing ? 'جاري مزامنة التنفيذ...' : 'مزامنة طلبات التنفيذ'}
          </Button>
          <Button
            onClick={handleDocumentSync}
            disabled={documentSyncing || syncing || costSyncing || enforcementSyncing || minuteSyncing || !caseNumber}
            variant="outline"
            className="gap-2 shrink-0"
          >
            {documentSyncing ? 'جاري مزامنة المستندات...' : 'مزامنة المستندات'}
          </Button>
          <Button
            onClick={handleSessionMinutesSync}
            disabled={minuteSyncing || syncing || costSyncing || enforcementSyncing || documentSyncing || !caseNumber}
            variant="outline"
            className="gap-2 shrink-0"
          >
            {minuteSyncing ? 'جاري مزامنة المحاضر...' : 'مزامنة محاضر الجلسات'}
          </Button>
          <Button
            onClick={handleFullRefresh}
            disabled={refreshQueueing || !caseNumber}
            variant="outline"
            className="gap-2 shrink-0"
          >
            {refreshQueueing ? 'جاري جدولة التحديث...' : 'تحديث شامل بالخلفية'}
          </Button>
        </div>
      </div>

      {error ? (
        <p className="mt-4 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 p-2 rounded-lg border border-red-200">{error}</p>
      ) : null}

      {loadingOverview ? (
        <p className="text-sm text-slate-500">جارٍ تحميل ملخص Najiz...</p>
      ) : null}

      {overview?.externalCase ? (
        <div className="grid gap-4 border-t border-brand-emerald/30 pt-4 md:grid-cols-3">
          <Card className="p-4">
            <p className="text-xs text-slate-500">القضية المرتبطة</p>
            <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
              {overview.externalCase.title}
            </p>
            <p className="mt-2 text-xs text-slate-500">#{overview.externalCase.case_number || '—'}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-slate-500">المحكمة</p>
            <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
              {overview.externalCase.court || '—'}
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-slate-500">الحالة</p>
            <Badge variant="default" className="mt-2 bg-brand-navy">
              {overview.externalCase.status || '—'}
            </Badge>
            <p className="mt-2 text-xs text-slate-500">
              آخر مزامنة: {formatDate(overview.externalCase.synced_at)}
            </p>
          </Card>
        </div>
      ) : !loadingOverview ? (
        <p className="text-sm text-slate-600 dark:text-slate-400">
          لم يتم ربط هذه القضية ببيانات Najiz بعد. ابدأ من زر المزامنة أعلاه.
        </p>
      ) : null}

      {overview?.events?.length ? (
        <div className="border-t border-brand-emerald/30 pt-4">
          <p className="text-sm font-semibold mb-3 text-brand-navy dark:text-slate-100">الخط الزمني من Najiz</p>
          <div className="space-y-3">
            {overview.events.slice(0, 6).map((event) => (
              <div
                key={event.id}
                className="rounded-lg border border-slate-200 bg-white p-3 text-sm dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-medium text-slate-900 dark:text-slate-100">{event.title}</div>
                  <Badge variant="default">{event.event_type}</Badge>
                </div>
                {event.description ? (
                  <p className="mt-2 text-slate-600 dark:text-slate-300">{event.description}</p>
                ) : null}
                <p className="mt-2 text-xs text-slate-500">
                  {formatDate(event.occurred_at || event.synced_at)}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {overview?.judicialCosts?.length ? (
        <div className="border-t border-brand-emerald/30 pt-4">
          <p className="text-sm font-semibold mb-3 text-brand-navy dark:text-slate-100">التكاليف القضائية</p>
          <div className="space-y-3">
            {overview.judicialCosts.slice(0, 6).map((cost) => (
              <div
                key={cost.id}
                className="rounded-lg border border-slate-200 bg-white p-3 text-sm dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-medium text-slate-900 dark:text-slate-100">{cost.title}</div>
                  <Badge variant="warning">{cost.status}</Badge>
                </div>
                <p className="mt-2 text-slate-700 dark:text-slate-200">
                  {Number(cost.amount || 0).toLocaleString('ar-SA')} {cost.currency || 'SAR'}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  {cost.invoice_reference ? `المرجع: ${cost.invoice_reference}` : 'بدون مرجع فاتورة'}
                  {cost.due_at ? ` • الاستحقاق: ${formatDate(cost.due_at)}` : ''}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {overview?.enforcementRequests.length ? (
        <div className="border-t border-brand-emerald/30 pt-4">
          <p className="text-sm font-semibold mb-3 text-brand-navy dark:text-slate-100">طلبات التنفيذ</p>
          <div className="space-y-3">
            {overview.enforcementRequests.slice(0, 6).map((request) => (
              <div
                key={request.id}
                className="rounded-lg border border-slate-200 bg-white p-3 text-sm dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-medium text-slate-900 dark:text-slate-100">{request.title}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {request.request_number ? `#${request.request_number}` : 'بدون رقم طلب'}
                    </div>
                  </div>
                  <Badge variant="default">{request.status}</Badge>
                </div>
                <p className="mt-2 text-slate-700 dark:text-slate-200">
                  النوع: {request.request_type}
                  {request.amount ? ` • ${Number(request.amount).toLocaleString('ar-SA')} ${request.currency || 'SAR'}` : ''}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  {request.submitted_at ? `تاريخ التقديم: ${formatDate(request.submitted_at)}` : 'بدون تاريخ تقديم'}
                  {request.closed_at ? ` • الإغلاق: ${formatDate(request.closed_at)}` : ''}
                </p>
                {request.events?.length ? (
                  <div className="mt-3 space-y-2 rounded-lg bg-slate-50 p-3 dark:bg-slate-950/60">
                    {request.events.slice(0, 3).map((event) => (
                      <div key={event.id}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-medium text-slate-800 dark:text-slate-100">{event.title}</span>
                          <span className="text-xs text-slate-500">{event.action_type}</span>
                        </div>
                        {event.description ? (
                          <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{event.description}</p>
                        ) : null}
                        <p className="mt-1 text-[11px] text-slate-500">
                          {formatDate(event.occurred_at || event.synced_at)}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {overview?.documents?.length ? (
        <div className="border-t border-brand-emerald/30 pt-4">
          <p className="text-sm font-semibold mb-3 text-brand-navy dark:text-slate-100">المستندات المرتبطة</p>
          <div className="space-y-3">
            {overview.documents.slice(0, 6).map((document) => (
              <div
                key={document.id}
                className="rounded-lg border border-slate-200 bg-white p-3 text-sm dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-medium text-slate-900 dark:text-slate-100">{document.title}</div>
                  <Badge variant="default">{document.document_type}</Badge>
                </div>
                <p className="mt-2 text-slate-700 dark:text-slate-200">{document.file_name}</p>
                <p className="mt-2 text-xs text-slate-500">
                  {document.issued_at ? `تاريخ الإصدار: ${formatDate(document.issued_at)}` : 'بدون تاريخ إصدار'}
                  {document.portal_visible ? ' • ظاهر في البوابة' : ''}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {overview?.sessionMinutes?.length ? (
        <div className="border-t border-brand-emerald/30 pt-4">
          <p className="text-sm font-semibold mb-3 text-brand-navy dark:text-slate-100">محاضر الجلسات</p>
          <div className="space-y-3">
            {overview.sessionMinutes.slice(0, 6).map((minute) => (
              <div
                key={minute.id}
                className="rounded-lg border border-slate-200 bg-white p-3 text-sm dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-medium text-slate-900 dark:text-slate-100">{minute.title}</div>
                  <Badge variant="warning">{minute.session_reference || 'جلسة'}</Badge>
                </div>
                {minute.summary ? (
                  <p className="mt-2 text-slate-600 dark:text-slate-300">{minute.summary}</p>
                ) : null}
                <p className="mt-2 text-xs text-slate-500">
                  {formatDate(minute.occurred_at || minute.synced_at)}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {overview?.jobs?.length ? (
        <div className="border-t border-brand-emerald/30 pt-4">
          <p className="text-sm font-semibold mb-3 text-brand-navy dark:text-slate-100">آخر مهام الخلفية</p>
          <div className="space-y-3">
            {overview.jobs.slice(0, 6).map((job) => (
              <div
                key={job.id}
                className="rounded-lg border border-slate-200 bg-white p-3 text-sm dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-medium text-slate-900 dark:text-slate-100">{job.jobKind}</div>
                  <Badge variant="default">{job.status}</Badge>
                </div>
                <p className="mt-2 text-xs text-slate-500">{formatDate(job.createdAt)}</p>
                {job.errorMessage ? (
                  <p className="mt-2 text-xs text-red-600 dark:text-red-300">{job.errorMessage}</p>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function formatDate(value: string | null) {
  if (!value) {
    return '—';
  }

  try {
    return new Date(value).toLocaleString('ar-SA');
  } catch {
    return value;
  }
}

async function fetchMatterOverview(matterId: string) {
  const response = await fetch(`/app/api/integrations/najiz/matters/${matterId}/overview`, {
    cache: 'no-store',
  });
  const payload = (await response.json().catch(() => ({}))) as any;
  if (!response.ok) {
    throw new Error(payload.error || 'تعذر تحميل بيانات Najiz للقضية.');
  }
  return payload as MatterOverview;
}
