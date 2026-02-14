'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';

type NajizEnvironment = 'sandbox' | 'production';
type NajizStatus = 'disconnected' | 'connected' | 'error';
type NajizSyncStatus = 'completed' | 'failed';

type NajizIntegrationState = {
  status: NajizStatus;
  config: {
    environment?: NajizEnvironment;
    base_url?: string;
    last_error?: string | null;
    sync_path?: string;
  };
  hasSecrets: boolean;
};

type NajizLastSync = {
  status: NajizSyncStatus;
  imported_count: number;
  endpoint_path: string;
  created_at: string;
};

type NajizIntegrationClientProps = {
  initial: NajizIntegrationState;
  lastSync?: NajizLastSync | null;
};

const statusLabel: Record<NajizStatus, { label: string; variant: 'default' | 'success' | 'warning' | 'danger' }> = {
  disconnected: { label: 'غير متصل', variant: 'warning' },
  connected: { label: 'متصل', variant: 'success' },
  error: { label: 'خطأ', variant: 'danger' },
};

export function NajizIntegrationClient({ initial, lastSync: initialLastSync }: NajizIntegrationClientProps) {
  const [state, setState] = useState<NajizIntegrationState>(initial);
  const [environment, setEnvironment] = useState<NajizEnvironment>(initial.config.environment ?? 'sandbox');
  const [baseUrl, setBaseUrl] = useState(initial.config.base_url ?? '');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [scope, setScope] = useState('');
  const [syncPath, setSyncPath] = useState(initial.config.sync_path ?? '');
  const [lastSync, setLastSync] = useState<NajizLastSync | null>(initialLastSync ?? null);
  const [loading, setLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const badge = statusLabel[state.status];

  const isConfigured = useMemo(() => Boolean((state.config.base_url ?? '').trim() && state.hasSecrets), [state]);

  async function syncNow() {
    setSyncLoading(true);
    setMessage('');
    setError('');

    try {
      const response = await fetch('/app/api/integrations/najiz/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint_path: syncPath || undefined,
        }),
      });

      const json = (await response.json().catch(() => ({}))) as any;
      if (!response.ok) {
        setError(String(json?.error ?? json?.message ?? 'تعذر تنفيذ المزامنة.'));
        return;
      }

      const nextPath = syncPath.trim();
      const imported = Number(json?.imported_count ?? 0);
      setMessage(`تمت المزامنة. تم استيراد ${imported} عنصر.`);

      setState((prev) => ({
        ...prev,
        status: 'connected',
        config: { ...prev.config, sync_path: nextPath || prev.config.sync_path, last_error: null },
      }));
      setSyncPath(nextPath);

      setLastSync({
        status: 'completed',
        imported_count: imported,
        endpoint_path: nextPath || (state.config.sync_path ?? ''),
        created_at: new Date().toISOString(),
      });
    } catch {
      setError('تعذر تنفيذ المزامنة.');
    } finally {
      setSyncLoading(false);
    }
  }

  async function connect() {
    setLoading(true);
    setMessage('');
    setError('');

    try {
      const response = await fetch('/app/api/integrations/najiz/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          environment,
          base_url: baseUrl,
          client_id: clientId,
          client_secret: clientSecret,
          scope_optional: scope || undefined,
        }),
      });

      const json = (await response.json().catch(() => ({}))) as any;
      if (!response.ok) {
        setError(String(json?.error ?? json?.message ?? 'تعذر ربط التكامل.'));
        setState((prev) => ({
          ...prev,
          status: 'error',
          config: { ...prev.config, last_error: String(json?.error ?? json?.message ?? '') || null },
        }));
        return;
      }

      setState({
        status: (json?.status as NajizStatus) || 'connected',
        config: (json?.config as any) || { environment, base_url: baseUrl, last_error: null },
        hasSecrets: true,
      });
      setMessage(String(json?.message ?? 'تم حفظ الإعدادات واختبار الاتصال.'));
      setClientSecret('');
    } catch {
      setError('تعذر ربط التكامل.');
    } finally {
      setLoading(false);
    }
  }

  async function testConnection() {
    setLoading(true);
    setMessage('');
    setError('');

    try {
      const response = await fetch('/app/api/integrations/najiz/test', { method: 'POST' });
      const json = (await response.json().catch(() => ({}))) as any;
      if (!response.ok) {
        setError(String(json?.error ?? json?.message ?? 'تعذر اختبار الاتصال.'));
        setState((prev) => ({
          ...prev,
          status: (json?.status as NajizStatus) || 'error',
          config: { ...prev.config, last_error: String(json?.error ?? json?.message ?? '') || null },
        }));
        return;
      }

      setState((prev) => ({
        ...prev,
        status: (json?.status as NajizStatus) || 'connected',
        config: { ...prev.config, last_error: null },
      }));
      setMessage(String(json?.message ?? 'تم الاتصال بنجاح.'));
    } catch {
      setError('تعذر اختبار الاتصال.');
    } finally {
      setLoading(false);
    }
  }

  async function disconnect() {
    if (!confirm('هل تريد فصل التكامل؟')) return;

    setLoading(true);
    setMessage('');
    setError('');

    try {
      const response = await fetch('/app/api/integrations/najiz/disconnect', { method: 'POST' });
      const json = (await response.json().catch(() => ({}))) as any;
      if (!response.ok) {
        setError(String(json?.error ?? 'تعذر فصل التكامل.'));
        return;
      }

      setState((prev) => ({
        ...prev,
        status: 'disconnected',
        hasSecrets: false,
        config: { ...prev.config, last_error: null },
      }));
      setMessage('تم فصل التكامل.');
    } catch {
      setError('تعذر فصل التكامل.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-brand-border bg-white p-4 dark:border-slate-700 dark:bg-slate-950">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-brand-navy dark:text-slate-100">تكامل ناجز (Najiz)</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              إعداد ربط رسمي عبر بيانات OAuth (بدون scraping).
            </p>
          </div>
          <Badge variant={badge.variant}>{badge.label}</Badge>
        </div>

        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-200">
          <p>لا تشارك مفاتيح التكامل.</p>
          <p className="mt-1">التكامل يتطلب اعتماد رسمي.</p>
        </div>

        {state.config.last_error ? (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
            {state.config.last_error}
          </p>
        ) : null}

        {message ? (
          <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200">
            {message}
          </p>
        ) : null}

        {error ? (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </p>
        ) : null}
      </div>

      <div className="rounded-lg border border-brand-border bg-white p-4 dark:border-slate-700 dark:bg-slate-950">
        <h3 className="font-semibold text-brand-navy dark:text-slate-100">إعداد الاتصال</h3>
        <form
          className="mt-4 grid gap-4 lg:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            connect();
          }}
        >
          <label className="block space-y-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">البيئة</span>
            <select
              value={environment}
              onChange={(event) => setEnvironment(event.target.value as NajizEnvironment)}
              className="h-11 w-full rounded-lg border border-brand-border bg-white px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
            >
              <option value="sandbox">Sandbox</option>
              <option value="production">Production</option>
            </select>
          </label>

          <label className="block space-y-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              Base URL <span className="text-red-600">*</span>
            </span>
            <input
              value={baseUrl}
              onChange={(event) => setBaseUrl(event.target.value)}
              placeholder="https://api.example.gov.sa"
              className="h-11 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
            />
          </label>

          <label className="block space-y-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              Client ID <span className="text-red-600">*</span>
            </span>
            <input
              value={clientId}
              onChange={(event) => setClientId(event.target.value)}
              className="h-11 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
            />
          </label>

          <label className="block space-y-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              Client Secret <span className="text-red-600">*</span>
            </span>
            <input
              type="password"
              value={clientSecret}
              onChange={(event) => setClientSecret(event.target.value)}
              className="h-11 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
              placeholder={state.hasSecrets ? '•••••••• (أدخل من جديد للتحديث)' : ''}
            />
          </label>

          <label className="block space-y-1 text-sm lg:col-span-2">
            <span className="font-medium text-slate-700 dark:text-slate-200">Scope (اختياري)</span>
            <input
              value={scope}
              onChange={(event) => setScope(event.target.value)}
              className="h-11 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
              placeholder="scope1 scope2"
            />
          </label>

          <div className="flex flex-wrap items-center gap-2 lg:col-span-2">
            <Button type="submit" variant="primary" size="md" disabled={loading}>
              {loading ? 'جارٍ الحفظ...' : 'حفظ + اختبار الاتصال'}
            </Button>
            <Button type="button" variant="outline" size="md" disabled={loading || !isConfigured} onClick={testConnection}>
              اختبار الاتصال
            </Button>
            <button
              type="button"
              className={buttonVariants('outline', 'md')}
              disabled={loading || state.status === 'disconnected'}
              onClick={disconnect}
            >
              فصل
            </button>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 lg:col-span-2">
            يتم حفظ المفاتيح بشكل مشفر في قاعدة البيانات، ولا يتم عرضها مرة أخرى داخل المنصة.
          </p>
        </form>
      </div>

      <div className="rounded-lg border border-brand-border bg-white p-4 dark:border-slate-700 dark:bg-slate-950">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold text-brand-navy dark:text-slate-100">المزامنة</h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              أدخل مسار الـ endpoint من وثائق Najiz ثم اضغط مزامنة الآن.
            </p>
          </div>
          <Link href="/app/external/najiz" className={buttonVariants('outline', 'sm')}>
            عرض البيانات المستوردة
          </Link>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <label className="block space-y-1 text-sm lg:col-span-2">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              مسار Endpoint <span className="text-red-600">*</span>
            </span>
            <input
              value={syncPath}
              onChange={(event) => setSyncPath(event.target.value)}
              className="h-11 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
              placeholder="/api/v1/cases"
            />
          </label>

          <div className="flex flex-wrap items-center gap-2 lg:col-span-2">
            <Button
              type="button"
              variant="primary"
              size="md"
              disabled={loading || syncLoading || !isConfigured || !syncPath.trim()}
              onClick={syncNow}
            >
              {syncLoading ? 'جارٍ المزامنة...' : 'مزامنة الآن'}
            </Button>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              يتم حفظ المسار داخل إعدادات التكامل تلقائيًا.
            </p>
          </div>
        </div>

        {lastSync ? (
          <div className="mt-4 rounded-lg border border-brand-border bg-brand-background px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
            <p className="font-medium">آخر مزامنة</p>
            <p className="mt-1">
              الحالة: {lastSync.status === 'completed' ? 'ناجحة' : 'فاشلة'} • العناصر: {lastSync.imported_count} •{' '}
              {new Date(lastSync.created_at).toLocaleString('ar-SA')}
            </p>
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">لم يتم تنفيذ مزامنة بعد.</p>
        )}
      </div>
    </div>
  );
}
