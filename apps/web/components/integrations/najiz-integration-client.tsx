'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';

type NajizEnvironment = 'sandbox' | 'production';
type NajizStatus = 'disconnected' | 'connected' | 'error';
type NajizHealthStatus = 'healthy' | 'degraded' | 'offline' | 'not_configured' | string;
type NajizMode = 'mock' | 'sandbox' | 'production';

type NajizEnvironmentSnapshot = {
  base_url: string;
  sync_path: string;
  last_error: string | null;
  last_tested_at: string | null;
  last_connected_at: string | null;
  use_mock: boolean;
};

type NajizIntegrationState = {
  status: NajizStatus;
  activeEnvironment: NajizEnvironment;
  activeEnvironmentHasCredentials: boolean;
  credentialsByEnvironment: Record<NajizEnvironment, boolean>;
  environmentConfigs: Record<NajizEnvironment, NajizEnvironmentSnapshot>;
  healthStatus: NajizHealthStatus;
  lastSyncedAt: string | null;
  lastHealthCheckedAt: string | null;
  lastHealthError: string | null;
};

type NajizLastSync = {
  status: 'completed' | 'failed';
  imported_count: number;
  endpoint_path: string;
  created_at: string;
};

type NajizIntegrationClientProps = {
  initial: NajizIntegrationState;
  lastSync?: NajizLastSync | null;
};

type NajizAccountSnapshotResponse = {
  status?: NajizStatus;
  active_environment?: NajizEnvironment;
  active_environment_has_credentials?: boolean;
  credentials_by_environment?: Record<NajizEnvironment, boolean>;
  environment_configs?: Record<NajizEnvironment, NajizEnvironmentSnapshot>;
  health_status?: NajizHealthStatus;
  last_synced_at?: string | null;
  last_health_checked_at?: string | null;
  last_health_error?: string | null;
  is_production_ready?: boolean;
  readiness_label?: string;
  readiness_reason?: string;
  mode?: NajizMode;
};

const statusLabel: Record<NajizStatus, { label: string; variant: 'default' | 'success' | 'warning' | 'danger' }> = {
  disconnected: { label: 'غير متصل', variant: 'warning' },
  connected: { label: 'متصل', variant: 'success' },
  error: { label: 'خطأ', variant: 'danger' },
};

const healthLabel: Record<'healthy' | 'degraded' | 'offline' | 'not_configured', { label: string; variant: 'default' | 'success' | 'warning' | 'danger' }> = {
  healthy: { label: 'Healthy', variant: 'success' },
  degraded: { label: 'Degraded', variant: 'warning' },
  offline: { label: 'Offline', variant: 'danger' },
  not_configured: { label: 'Not configured', variant: 'warning' },
};

const modeLabel: Record<NajizMode, { label: string; variant: 'default' | 'success' | 'warning' | 'danger' }> = {
  mock: { label: 'Mock', variant: 'warning' },
  sandbox: { label: 'Sandbox', variant: 'warning' },
  production: { label: 'Production', variant: 'success' },
};

export function NajizIntegrationClient({ initial, lastSync: initialLastSync }: NajizIntegrationClientProps) {
  const [state, setState] = useState<NajizIntegrationState>(initial);
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [scope, setScope] = useState('');
  const [lastSync, setLastSync] = useState<NajizLastSync | null>(initialLastSync ?? null);
  const [loading, setLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const activeConfig = state.environmentConfigs[state.activeEnvironment] ?? createEmptyEnvironmentSnapshot();
  const readiness = buildReadiness(state);
  const statusBadge = statusLabel[state.status];
  const healthBadge = healthLabel[normalizeHealthStatus(state.healthStatus)];
  const modeBadge = modeLabel[readiness.mode];
  const isFormMissingCredentials = !state.activeEnvironmentHasCredentials && (!clientId.trim() || !clientSecret.trim());
  const isPartialCredentialUpdate = Boolean(clientId.trim()) !== Boolean(clientSecret.trim());

  async function syncNow() {
    setSyncLoading(true);
    setMessage('');
    setError('');

    try {
      const response = await fetch('/app/api/integrations/najiz/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint_path: activeConfig.sync_path || undefined,
        }),
      });

      const json = (await response.json().catch(() => ({}))) as { error?: string; message?: string; imported_count?: number };
      if (!response.ok) {
        setError(String(json?.error ?? json?.message ?? 'تعذر تنفيذ المزامنة.'));
        return;
      }

      const now = new Date().toISOString();
      const imported = Number(json?.imported_count ?? 0);
      setMessage(`تمت المزامنة. تم استيراد ${imported} عنصر.`);
      setLastSync({
        status: 'completed',
        imported_count: imported,
        endpoint_path: activeConfig.sync_path || '',
        created_at: now,
      });
      setState((prev) => ({
        ...prev,
        status: 'connected',
        lastSyncedAt: now,
        lastHealthCheckedAt: prev.lastHealthCheckedAt ?? now,
      }));
    } catch {
      setError('تعذر تنفيذ المزامنة.');
    } finally {
      setSyncLoading(false);
    }
  }

  async function connect() {
    if (!activeConfig.base_url.trim()) {
      setError('Base URL مطلوب قبل الحفظ.');
      return;
    }

    if (isPartialCredentialUpdate) {
      setError('أدخل Client ID وClient Secret معًا، أو اتركهما فارغين للاحتفاظ بالاعتمادات الحالية.');
      return;
    }

    if (isFormMissingCredentials) {
      setError('هذه البيئة لا تملك اعتمادات محفوظة بعد. أدخل Client ID وClient Secret للمتابعة.');
      return;
    }

    setLoading(true);
    setMessage('');
    setError('');

    try {
      const payload: Record<string, unknown> = {
        environment: state.activeEnvironment,
        base_url: activeConfig.base_url,
        scope_optional: scope || undefined,
        use_mock: activeConfig.use_mock,
      };

      if (clientId.trim()) {
        payload.client_id = clientId.trim();
      }

      if (clientSecret.trim()) {
        payload.client_secret = clientSecret.trim();
      }

      const response = await fetch('/app/api/integrations/najiz/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = (await response.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
        account?: NajizAccountSnapshotResponse;
      };

      if (!response.ok || !json.account) {
        throw new Error(json.error || json.message || 'تعذر ربط التكامل.');
      }

      applyAccountSnapshot(json.account);
      setMessage(String(json.message ?? 'تم حفظ الإعدادات واختبار الاتصال.'));
      setClientId('');
      setClientSecret('');
      setScope('');
    } catch (connectError) {
      const messageText = connectError instanceof Error ? connectError.message : 'تعذر ربط التكامل.';
      setError(messageText);
      setState((prev) => ({ ...prev, status: 'error' }));
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
      const json = (await response.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
        account?: NajizAccountSnapshotResponse;
      };

      if (!response.ok || !json.account) {
        throw new Error(json.error || json.message || 'تعذر اختبار الاتصال.');
      }

      applyAccountSnapshot(json.account);
      setMessage(String(json.message ?? 'تم الاتصال بنجاح.'));
    } catch (testError) {
      const messageText = testError instanceof Error ? testError.message : 'تعذر اختبار الاتصال.';
      setError(messageText);
      setState((prev) => ({ ...prev, status: 'error' }));
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
      const json = (await response.json().catch(() => ({}))) as {
        error?: string;
        account?: NajizAccountSnapshotResponse | null;
      };

      if (!response.ok) {
        throw new Error(String(json.error ?? 'تعذر فصل التكامل.'));
      }

      if (json.account) {
        applyAccountSnapshot(json.account);
      } else {
        setState((prev) => ({
          ...prev,
          status: 'disconnected',
          activeEnvironmentHasCredentials: false,
          credentialsByEnvironment: {
            sandbox: false,
            production: false,
          },
          environmentConfigs: {
            sandbox: createEmptyEnvironmentSnapshot(),
            production: createEmptyEnvironmentSnapshot(),
          },
          healthStatus: 'not_configured',
          lastSyncedAt: null,
          lastHealthCheckedAt: null,
          lastHealthError: null,
        }));
      }

      setMessage('تم فصل التكامل.');
    } catch (disconnectError) {
      const messageText = disconnectError instanceof Error ? disconnectError.message : 'تعذر فصل التكامل.';
      setError(messageText);
    } finally {
      setLoading(false);
    }
  }

  function setEnvironment(nextEnvironment: NajizEnvironment) {
    setState((prev) => ({
      ...prev,
      activeEnvironment: nextEnvironment,
      activeEnvironmentHasCredentials: prev.credentialsByEnvironment[nextEnvironment],
    }));
    setClientId('');
    setClientSecret('');
    setScope('');
    setMessage('');
    setError('');
  }

  function updateActiveEnvironmentConfig(update: Partial<NajizEnvironmentSnapshot>) {
    setState((prev) => ({
      ...prev,
      environmentConfigs: {
        ...prev.environmentConfigs,
        [prev.activeEnvironment]: {
          ...prev.environmentConfigs[prev.activeEnvironment],
          ...update,
        },
      },
    }));
  }

  function applyAccountSnapshot(snapshot: NajizAccountSnapshotResponse) {
    const nextEnvironmentConfigs = snapshot.environment_configs
      ? {
          sandbox: normalizeEnvironmentSnapshot(snapshot.environment_configs.sandbox),
          production: normalizeEnvironmentSnapshot(snapshot.environment_configs.production),
        }
      : null;

    setState((prev) => ({
      ...prev,
      status: snapshot.status ?? prev.status,
      activeEnvironment: snapshot.active_environment ?? prev.activeEnvironment,
      activeEnvironmentHasCredentials:
        snapshot.active_environment_has_credentials ?? prev.activeEnvironmentHasCredentials,
      credentialsByEnvironment: snapshot.credentials_by_environment ?? prev.credentialsByEnvironment,
      environmentConfigs: nextEnvironmentConfigs ?? prev.environmentConfigs,
      healthStatus: snapshot.health_status ?? prev.healthStatus,
      lastSyncedAt: snapshot.last_synced_at ?? prev.lastSyncedAt,
      lastHealthCheckedAt: snapshot.last_health_checked_at ?? prev.lastHealthCheckedAt,
      lastHealthError: snapshot.last_health_error ?? prev.lastHealthError,
    }));
  }

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-brand-border bg-white p-4 dark:border-slate-700 dark:bg-slate-950">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-brand-navy dark:text-slate-100">تكامل ناجز (Najiz)</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              إعداد ربط رسمي عبر OAuth، مع تنبيه واضح إذا كانت البيئة sandbox أو mock وليست live.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
            <Badge variant={readiness.isProductionReady ? 'success' : 'warning'}>{readiness.label}</Badge>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <StatusTile
            label="البيئة"
            value={state.activeEnvironment === 'production' ? 'Production' : 'Sandbox'}
            variant={state.activeEnvironment === 'production' ? 'success' : 'warning'}
          />
          <StatusTile label="الوضع" value={modeBadge.label} variant={modeBadge.variant} />
          <StatusTile
            label="اعتمادات البيئة الحالية"
            value={state.activeEnvironmentHasCredentials ? 'موجودة' : 'غير موجودة'}
            variant={state.activeEnvironmentHasCredentials ? 'success' : 'danger'}
          />
          <StatusTile label="الصحة" value={healthBadge.label} variant={healthBadge.variant} />
          <StatusTile
            label="الجاهزية"
            value={readiness.isProductionReady ? 'جاهز' : 'غير جاهز'}
            variant={readiness.isProductionReady ? 'success' : 'danger'}
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <Badge variant={state.credentialsByEnvironment.sandbox ? 'success' : 'warning'}>
            Sandbox creds: {state.credentialsByEnvironment.sandbox ? 'موجودة' : 'غير موجودة'}
          </Badge>
          <Badge variant={state.credentialsByEnvironment.production ? 'success' : 'warning'}>
            Production creds: {state.credentialsByEnvironment.production ? 'موجودة' : 'غير موجودة'}
          </Badge>
        </div>

        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-200">
          <p className="font-medium">{readiness.reason}</p>
          <ul className="mt-2 space-y-1 text-xs text-slate-600 dark:text-slate-300">
            {readiness.issues.map((issue) => (
              <li key={issue}>• {issue}</li>
            ))}
          </ul>
        </div>

        {state.activeEnvironment !== 'production' || activeConfig.use_mock ? (
          <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
            هذه الخلاصة ليست Production-ready. إذا كانت البيئة sandbox أو mock، فالمزامنة اختبارية فقط وليست اتصالًا حيًا مع ناجز.
          </p>
        ) : null}

        {state.lastHealthError ? (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
            آخر خطأ صحة: {state.lastHealthError}
          </p>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-500 dark:text-slate-400">
          <span>آخر فحص صحة: {formatTimestamp(state.lastHealthCheckedAt)}</span>
          <span>آخر مزامنة: {formatTimestamp(state.lastSyncedAt)}</span>
        </div>

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
            void connect();
          }}
        >
          <label className="block space-y-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">البيئة</span>
            <select
              value={state.activeEnvironment}
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
              value={activeConfig.base_url}
              onChange={(event) => updateActiveEnvironmentConfig({ base_url: event.target.value })}
              placeholder="https://api.example.gov.sa"
              required
              className="h-11 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
            />
          </label>

          <label className="block space-y-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              Client ID {!state.activeEnvironmentHasCredentials ? <span className="text-red-600">*</span> : null}
            </span>
            <input
              value={clientId}
              onChange={(event) => setClientId(event.target.value)}
              required={!state.activeEnvironmentHasCredentials}
              className="h-11 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
              placeholder={state.activeEnvironmentHasCredentials ? 'اتركه فارغًا للحفاظ على القيمة الحالية' : ''}
            />
          </label>

          <label className="block space-y-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              Client Secret {!state.activeEnvironmentHasCredentials ? <span className="text-red-600">*</span> : null}
            </span>
            <input
              type="password"
              value={clientSecret}
              onChange={(event) => setClientSecret(event.target.value)}
              required={!state.activeEnvironmentHasCredentials}
              className="h-11 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
              placeholder={state.activeEnvironmentHasCredentials ? '•••••••• (اتركه فارغًا للحفاظ على القيم الحالية)' : ''}
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
            <Button type="button" variant="outline" size="md" disabled={loading || !canTestConnection(activeConfig)} onClick={testConnection}>
              اختبار الإعدادات المحفوظة
            </Button>
            <Button type="button" variant="outline" size="md" disabled={loading || state.status === 'disconnected'} onClick={disconnect}>
              فصل
            </Button>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 lg:col-span-2">
            يتم حفظ المفاتيح بشكل مشفر في قاعدة البيانات، ولا يتم عرضها مرة أخرى داخل المنصة.
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 lg:col-span-2">
            إذا كنت تحدّث Base URL فقط، اترك Client ID وClient Secret فارغين وسنُبقي اعتمادات هذه البيئة كما هي.
          </p>
          <p className="text-xs text-amber-700 dark:text-amber-300 lg:col-span-2">
            اختبار الاتصال يراجع الإعدادات المحفوظة حاليًا، بينما الحقول أعلاه تُستخدم عند حفظ التحديثات الجديدة.
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

        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
          <label className="block space-y-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">مسار الـ endpoint</span>
            <input
              value={activeConfig.sync_path}
              onChange={(event) => updateActiveEnvironmentConfig({ sync_path: event.target.value })}
              placeholder="/api/v1/cases"
              className="h-11 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
            />
          </label>

          <div className="flex items-end">
            <Button type="button" variant="primary" size="md" disabled={syncLoading || !canRunSync(activeConfig)} onClick={syncNow}>
              {syncLoading ? 'جارٍ المزامنة...' : 'مزامنة الآن'}
            </Button>
          </div>
        </div>

        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          إذا كانت البيئة sandbox أو mock، فهذه المزامنة مفيدة للاختبار فقط ولا تعني جاهزية إنتاجية.
        </p>

        {lastSync ? (
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
            <p>آخر مزامنة: {formatTimestamp(lastSync.created_at)}</p>
            <p className="mt-1">النتيجة: {lastSync.status === 'completed' ? 'اكتملت' : 'فشلت'}</p>
            <p className="mt-1">العناصر المستوردة: {lastSync.imported_count}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function createEmptyEnvironmentSnapshot(): NajizEnvironmentSnapshot {
  return {
    base_url: '',
    sync_path: '',
    last_error: null,
    last_tested_at: null,
    last_connected_at: null,
    use_mock: false,
  };
}

function normalizeEnvironmentSnapshot(snapshot?: Partial<NajizEnvironmentSnapshot> | null): NajizEnvironmentSnapshot {
  return {
    base_url: snapshot?.base_url ?? '',
    sync_path: snapshot?.sync_path ?? '',
    last_error: snapshot?.last_error ?? null,
    last_tested_at: snapshot?.last_tested_at ?? null,
    last_connected_at: snapshot?.last_connected_at ?? null,
    use_mock: snapshot?.use_mock ?? false,
  };
}

function buildReadiness(state: NajizIntegrationState) {
  const activeConfig = state.environmentConfigs[state.activeEnvironment] ?? createEmptyEnvironmentSnapshot();
  const health = normalizeHealthStatus(state.healthStatus);
  const mode: NajizMode = activeConfig.use_mock ? 'mock' : state.activeEnvironment;
  const hasBaseUrl = Boolean(activeConfig.base_url.trim());
  const hasCredentials = state.activeEnvironmentHasCredentials;
  const productionReady =
    state.activeEnvironment === 'production' &&
    state.status === 'connected' &&
    health === 'healthy' &&
    hasBaseUrl &&
    hasCredentials &&
    !activeConfig.use_mock;

  const issues = collectIssues({
    activeEnvironment: state.activeEnvironment,
    hasBaseUrl,
    hasCredentials,
    health,
    useMock: activeConfig.use_mock,
  });

  if (productionReady) {
    return {
      isProductionReady: true,
      label: 'جاهز للإنتاج',
      reason: 'هذا الربط مباشر ومهيأ للإنتاج الفعلي.',
      issues: [] as string[],
      mode,
    };
  }

  if (activeConfig.use_mock) {
    return {
      isProductionReady: false,
      label: 'وضع mock',
      reason: 'هذا الربط يعمل عبر mock adapter، وليس عبر Najiz الحقيقي.',
      issues,
      mode,
    };
  }

  if (state.activeEnvironment === 'sandbox') {
    return {
      isProductionReady: false,
      label: 'Sandbox فقط',
      reason: 'هذه بيئة sandbox مخصصة للاختبار فقط.',
      issues,
      mode,
    };
  }

  if (!hasCredentials) {
    return {
      isProductionReady: false,
      label: 'اعتمادات ناقصة',
      reason: 'بيانات الاعتماد لهذه البيئة غير مكتملة.',
      issues,
      mode,
    };
  }

  if (health !== 'healthy') {
    return {
      isProductionReady: false,
      label: 'الصحة تحتاج مراجعة',
      reason: `حالة الصحة الحالية: ${health}.`,
      issues,
      mode,
    };
  }

  if (!hasBaseUrl) {
    return {
      isProductionReady: false,
      label: 'Base URL مفقود',
      reason: 'Base URL غير مضبوط لهذه البيئة.',
      issues,
      mode,
    };
  }

  return {
    isProductionReady: false,
    label: 'غير جاهز',
    reason: 'هذا الربط ما زال يحتاج مراجعة قبل الاعتماد عليه كتشغيل حي.',
    issues,
    mode,
  };
}

function collectIssues({
  activeEnvironment,
  hasBaseUrl,
  hasCredentials,
  health,
  useMock,
}: {
  activeEnvironment: NajizEnvironment;
  hasBaseUrl: boolean;
  hasCredentials: boolean;
  health: 'healthy' | 'degraded' | 'offline' | 'not_configured';
  useMock: boolean;
}) {
  const issues: string[] = [];

  if (useMock) {
    issues.push('وضع mock مفعّل، لذلك هذا ليس اتصالًا live.');
  }

  if (activeEnvironment === 'sandbox') {
    issues.push('البيئة الحالية Sandbox مخصصة للاختبار فقط.');
  }

  if (!hasCredentials) {
    issues.push('بيانات الاعتماد لهذه البيئة غير مكتملة.');
  }

  if (health !== 'healthy') {
    issues.push(`حالة الصحة الحالية: ${health}.`);
  }

  if (activeEnvironment === 'production' && !useMock && !hasBaseUrl) {
    issues.push('Base URL غير مضبوط لهذه البيئة.');
  }

  return issues;
}

function normalizeHealthStatus(value: NajizHealthStatus): 'healthy' | 'degraded' | 'offline' | 'not_configured' {
  if (value === 'healthy' || value === 'degraded' || value === 'offline' || value === 'not_configured') {
    return value;
  }

  return 'not_configured';
}

function canTestConnection(activeConfig: NajizEnvironmentSnapshot) {
  return Boolean(activeConfig.base_url.trim());
}

function canRunSync(activeConfig: NajizEnvironmentSnapshot) {
  return Boolean(activeConfig.base_url.trim() && activeConfig.sync_path.trim());
}

function formatTimestamp(value: string | null) {
  return value ? new Date(value).toLocaleString('ar-SA') : '—';
}

function StatusTile({
  label,
  value,
  variant,
}: {
  label: string;
  value: string;
  variant: 'default' | 'success' | 'warning' | 'danger';
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 dark:border-slate-700 dark:bg-slate-900/40">
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <div className="mt-2">
        <Badge variant={variant}>{value}</Badge>
      </div>
    </div>
  );
}
