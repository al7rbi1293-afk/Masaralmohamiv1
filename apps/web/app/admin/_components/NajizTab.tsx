'use client';

import { useEffect, useState } from 'react';

type NajizAdminSummary = {
  totals: {
    accounts: number;
    connected: number;
    error: number;
    disconnected: number;
    healthy: number;
    degraded: number;
    queuedJobs: number;
    pendingWebhooks: number;
  };
  accounts: Array<{
    id: string;
    orgId: string;
    provider: 'najiz';
    status: 'disconnected' | 'connected' | 'error';
    healthStatus: 'healthy' | 'degraded' | 'offline' | 'not_configured';
    activeEnvironment: 'sandbox' | 'production';
    lastSyncedAt: string | null;
    updatedAt: string | null;
  }>;
  jobs: Array<{
    id: string;
    orgId: string;
    jobKind: string;
    status: string;
    environment: string;
    createdAt: string;
    completedAt: string | null;
    errorMessage: string | null;
  }>;
  logs: Array<{
    id: string;
    orgId: string;
    level: 'info' | 'warn' | 'error';
    action: string;
    message: string;
    createdAt: string;
  }>;
  webhooks?: Array<{
    id: string;
    orgId: string | null;
    eventType: string;
    deliveryId: string | null;
    status: string;
    receivedAt: string;
    processedAt: string | null;
    errorMessage: string | null;
  }>;
};

export default function NajizTab() {
  const [data, setData] = useState<NajizAdminSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/admin/api/integrations/najiz')
      .then(async (response) => {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        if (!response.ok) {
          throw new Error(payload.error || 'تعذر تحميل بيانات Najiz.');
        }
        return payload as NajizAdminSummary;
      })
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'تعذر تحميل بيانات Najiz.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="animate-pulse text-slate-500">جارٍ تحميل مرصد Najiz...</div>;
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/10 dark:text-red-300">
        {error || 'تعذر تحميل بيانات Najiz.'}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-navy dark:text-slate-100">مرصد Najiz</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          حسابات الربط، حالات الصحة، وآخر مهام المزامنة وسجلاتها.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-8">
        <StatCard label="الحسابات" value={data.totals.accounts} />
        <StatCard label="متصل" value={data.totals.connected} />
        <StatCard label="بحالة خطأ" value={data.totals.error} />
        <StatCard label="مفصول" value={data.totals.disconnected} />
        <StatCard label="Healthy" value={data.totals.healthy} />
        <StatCard label="Degraded" value={data.totals.degraded} />
        <StatCard label="الطابور" value={data.totals.queuedJobs} />
        <StatCard label="ويبهوكس معلقة" value={data.totals.pendingWebhooks} />
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-brand-navy dark:text-slate-100">حسابات التكامل</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300">
              <tr>
                <th className="py-2 text-start font-medium">المكتب</th>
                <th className="py-2 text-start font-medium">الحالة</th>
                <th className="py-2 text-start font-medium">الصحة</th>
                <th className="py-2 text-start font-medium">البيئة</th>
                <th className="py-2 text-start font-medium">آخر مزامنة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {data.accounts.map((account) => (
                <tr key={account.id || `${account.orgId}-${account.provider}`}>
                  <td className="py-3">{account.orgId}</td>
                  <td className="py-3">{account.status}</td>
                  <td className="py-3">{account.healthStatus}</td>
                  <td className="py-3">{account.activeEnvironment}</td>
                  <td className="py-3">{formatDate(account.lastSyncedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-brand-navy dark:text-slate-100">آخر مهام المزامنة</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300">
              <tr>
                <th className="py-2 text-start font-medium">المكتب</th>
                <th className="py-2 text-start font-medium">النوع</th>
                <th className="py-2 text-start font-medium">الحالة</th>
                <th className="py-2 text-start font-medium">البيئة</th>
                <th className="py-2 text-start font-medium">الوقت</th>
                <th className="py-2 text-start font-medium">الخطأ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {data.jobs.slice(0, 25).map((job) => (
                <tr key={job.id}>
                  <td className="py-3">{job.orgId}</td>
                  <td className="py-3">{job.jobKind}</td>
                  <td className="py-3">{job.status}</td>
                  <td className="py-3">{job.environment}</td>
                  <td className="py-3">{formatDate(job.createdAt)}</td>
                  <td className="py-3 text-xs text-red-600 dark:text-red-300">{job.errorMessage || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-brand-navy dark:text-slate-100">آخر الويبهوكس</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300">
              <tr>
                <th className="py-2 text-start font-medium">المكتب</th>
                <th className="py-2 text-start font-medium">الحدث</th>
                <th className="py-2 text-start font-medium">التسليم</th>
                <th className="py-2 text-start font-medium">الحالة</th>
                <th className="py-2 text-start font-medium">الاستلام</th>
                <th className="py-2 text-start font-medium">الخطأ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {(data.webhooks ?? []).slice(0, 25).map((event) => (
                <tr key={event.id}>
                  <td className="py-3">{event.orgId || '—'}</td>
                  <td className="py-3">{event.eventType}</td>
                  <td className="py-3">{event.deliveryId || '—'}</td>
                  <td className="py-3">{event.status}</td>
                  <td className="py-3">{formatDate(event.receivedAt)}</td>
                  <td className="py-3 text-xs text-red-600 dark:text-red-300">{event.errorMessage || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-brand-navy dark:text-slate-100">آخر السجلات</h2>
        <div className="mt-4 space-y-3">
          {data.logs.slice(0, 25).map((log) => (
            <article
              key={log.id}
              className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-medium text-slate-900 dark:text-slate-100">
                  {log.action} <span className="text-slate-500">[{log.level}]</span>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">{formatDate(log.createdAt)}</div>
              </div>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{log.message}</p>
              <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">Org: {log.orgId}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="text-sm text-slate-500 dark:text-slate-400">{label}</div>
      <div className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">{value}</div>
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
