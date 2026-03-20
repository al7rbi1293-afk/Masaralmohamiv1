import type { IntegrationAccount } from '@/lib/integrations/domain/models';

type NajizEnvironment = 'sandbox' | 'production';

type NajizEnvironmentSnapshot = {
  base_url: string;
  sync_path: string;
  last_error: string | null;
  last_tested_at: string | null;
  last_connected_at: string | null;
  use_mock: boolean;
};

export type NajizAccountResponseSnapshot = {
  status: 'disconnected' | 'connected' | 'error';
  active_environment: NajizEnvironment;
  active_environment_has_credentials: boolean;
  credentials_by_environment: Record<NajizEnvironment, boolean>;
  environment_configs: Record<NajizEnvironment, NajizEnvironmentSnapshot>;
  health_status: string;
  last_synced_at: string | null;
  last_health_checked_at: string | null;
  last_health_error: string | null;
  is_production_ready: boolean;
  readiness_label: string;
  readiness_reason: string;
  mode: 'mock' | 'sandbox' | 'production';
};

export function buildNajizAccountResponseSnapshot(account: IntegrationAccount): NajizAccountResponseSnapshot {
  const activeEnvironment = account.activeEnvironment;
  const activeEnvironmentConfig = account.environments[activeEnvironment];
  const activeCredentials = account.credentials[activeEnvironment];
  const credentialsByEnvironment = {
    sandbox: Boolean(account.credentials.sandbox?.clientId && account.credentials.sandbox.clientSecret),
    production: Boolean(account.credentials.production?.clientId && account.credentials.production.clientSecret),
  } as const;
  const environmentConfigs = {
    sandbox: snapshotEnvironment(account.environments.sandbox),
    production: snapshotEnvironment(account.environments.production),
  };
  const hasBaseUrl = Boolean(activeEnvironmentConfig.baseUrl.trim());
  const activeEnvironmentHasCredentials = Boolean(activeCredentials?.clientId && activeCredentials.clientSecret);
  const activeEnvironmentUsesMock = Boolean(activeEnvironmentConfig.useMock);
  const isProductionReady =
    activeEnvironment === 'production' &&
    account.status === 'connected' &&
    account.healthStatus === 'healthy' &&
    hasBaseUrl &&
    activeEnvironmentHasCredentials &&
    !activeEnvironmentUsesMock;

  return {
    status: account.status,
    active_environment: activeEnvironment,
    active_environment_has_credentials: activeEnvironmentHasCredentials,
    credentials_by_environment: credentialsByEnvironment,
    environment_configs: environmentConfigs,
    health_status: account.healthStatus,
    last_synced_at: account.lastSyncedAt,
    last_health_checked_at: account.lastHealthCheckedAt,
    last_health_error: account.lastHealthError,
    is_production_ready: isProductionReady,
    readiness_label: isProductionReady ? 'جاهز للإنتاج' : readinessLabel(account, activeEnvironmentUsesMock, hasBaseUrl, activeEnvironmentHasCredentials),
    readiness_reason: readinessReason(account, activeEnvironmentUsesMock, hasBaseUrl, activeEnvironmentHasCredentials),
    mode: activeEnvironmentUsesMock ? 'mock' : activeEnvironment,
  };
}

function snapshotEnvironment(environment: IntegrationAccount['environments']['sandbox']): NajizEnvironmentSnapshot {
  return {
    base_url: environment.baseUrl,
    sync_path: environment.syncPaths.cases ?? '',
    last_error: environment.lastError,
    last_tested_at: environment.lastTestedAt,
    last_connected_at: environment.lastConnectedAt,
    use_mock: environment.useMock,
  };
}

function readinessLabel(
  account: IntegrationAccount,
  activeEnvironmentUsesMock: boolean,
  hasBaseUrl: boolean,
  activeEnvironmentHasCredentials: boolean,
) {
  if (account.activeEnvironment === 'production' && account.status === 'connected' && account.healthStatus === 'healthy' && hasBaseUrl && activeEnvironmentHasCredentials && !activeEnvironmentUsesMock) {
    return 'جاهز للإنتاج';
  }

  if (activeEnvironmentUsesMock) {
    return 'وضع mock';
  }

  if (account.activeEnvironment === 'sandbox') {
    return 'Sandbox فقط';
  }

  if (!activeEnvironmentHasCredentials) {
    return 'اعتمادات ناقصة';
  }

  if (account.healthStatus !== 'healthy') {
    return 'الصحة تحتاج مراجعة';
  }

  if (!hasBaseUrl) {
    return 'Base URL مفقود';
  }

  return 'غير جاهز';
}

function readinessReason(
  account: IntegrationAccount,
  activeEnvironmentUsesMock: boolean,
  hasBaseUrl: boolean,
  activeEnvironmentHasCredentials: boolean,
) {
  if (account.activeEnvironment === 'production' && account.status === 'connected' && account.healthStatus === 'healthy' && hasBaseUrl && activeEnvironmentHasCredentials && !activeEnvironmentUsesMock) {
    return 'الربط مباشر ومهيأ للإنتاج.';
  }

  if (activeEnvironmentUsesMock) {
    return 'هذا الربط يعمل عبر mock adapter، وليس عبر Najiz الحقيقي.';
  }

  if (account.activeEnvironment === 'sandbox') {
    return 'هذه بيئة sandbox مخصصة للاختبار فقط.';
  }

  if (!activeEnvironmentHasCredentials) {
    return 'بيانات الاعتماد غير مكتملة لهذه البيئة.';
  }

  if (account.healthStatus !== 'healthy') {
    return `حالة الصحة الحالية: ${account.healthStatus}.`;
  }

  if (!hasBaseUrl) {
    return 'Base URL غير مضبوط لهذه البيئة.';
  }

  return 'هذه البيئة تحتاج مراجعة قبل الاعتماد عليها كتشغيل حي.';
}
