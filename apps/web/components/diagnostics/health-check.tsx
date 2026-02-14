'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

type HealthResponse = {
  ok: boolean;
  time: string;
  version: string;
};

export function HealthCheck() {
  const [loading, setLoading] = useState(false);
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);
  const [data, setData] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/health', { method: 'GET', cache: 'no-store' });
      const json = (await res.json().catch(() => null)) as HealthResponse | { error?: string } | null;

      if (!res.ok || !json || typeof (json as any).ok !== 'boolean') {
        setData(null);
        setError((json as any)?.error ? String((json as any).error) : 'تعذر تنفيذ الفحص.');
        setLastCheckedAt(new Date().toISOString());
        return;
      }

      setData(json as HealthResponse);
      setLastCheckedAt(new Date().toISOString());
    } catch {
      setData(null);
      setError('تعذر تنفيذ الفحص.');
      setLastCheckedAt(new Date().toISOString());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void run();
  }, [run]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-slate-800 dark:text-slate-100">فحص الصحة</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            آخر فحص: {lastCheckedAt ? formatDateTime(lastCheckedAt) : '—'}
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={run} disabled={loading}>
          {loading ? 'جارٍ الفحص...' : 'تحديث'}
        </Button>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </p>
      ) : null}

      {data ? (
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500 dark:text-slate-400">النتيجة</dt>
            <dd className="mt-1 font-medium text-slate-800 dark:text-slate-100">
              {data.ok ? 'OK' : 'غير طبيعي'}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500 dark:text-slate-400">النسخة</dt>
            <dd className="mt-1 font-medium text-slate-800 dark:text-slate-100">{data.version}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-slate-500 dark:text-slate-400">وقت الخدمة</dt>
            <dd className="mt-1 font-medium text-slate-800 dark:text-slate-100">
              {formatDateTime(data.time)}
            </dd>
          </div>
        </dl>
      ) : null}
    </div>
  );
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.toLocaleDateString('ar-SA')} ${date.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}`;
}

