import { decryptJson, encryptJson } from '@/lib/crypto';
import type {
  IntegrationAccount,
  IntegrationConnectionStatus,
  IntegrationCredentials,
  IntegrationEnvironment,
  IntegrationEnvironmentConfig,
  IntegrationHealthStatus,
  IntegrationSyncPaths,
} from '../models';

type IntegrationAccountRow = {
  id: string;
  org_id: string;
  provider: 'najiz';
  status: IntegrationConnectionStatus;
  config: Record<string, unknown> | null;
  secret_enc: string | null;
  created_by: string | null;
  updated_at: string | null;
  active_environment?: string | null;
  health_status?: string | null;
  last_synced_at?: string | null;
  last_health_checked_at?: string | null;
  last_health_error?: string | null;
  updated_by?: string | null;
  config_version?: number | null;
};

type StoredEnvironmentSecrets = {
  client_id: string;
  client_secret: string;
  scope?: string | null;
};

type StoredSecretsV2 = {
  version: 2;
  environments: Partial<Record<IntegrationEnvironment, StoredEnvironmentSecrets>>;
};

function defaultSyncPaths(): IntegrationSyncPaths {
  return {
    cases: null,
    lawyerVerification: null,
    judicialCosts: null,
    enforcementRequests: null,
    documents: null,
    sessionMinutes: null,
  };
}

function defaultEnvironmentConfig(): IntegrationEnvironmentConfig {
  return {
    baseUrl: '',
    tokenPath: null,
    healthPath: null,
    syncPaths: defaultSyncPaths(),
    lastError: null,
    lastTestedAt: null,
    lastConnectedAt: null,
    useMock: false,
  };
}

function emptyEnvironmentMap() {
  return {
    sandbox: defaultEnvironmentConfig(),
    production: defaultEnvironmentConfig(),
  } satisfies Record<IntegrationEnvironment, IntegrationEnvironmentConfig>;
}

function asEnvironment(value: unknown, fallback: IntegrationEnvironment): IntegrationEnvironment {
  return value === 'production' ? 'production' : fallback;
}

function normalizeString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeOptionalString(value: unknown) {
  const normalized = normalizeString(value);
  return normalized || null;
}

function normalizeSyncPaths(value: unknown, legacySyncPath: unknown): IntegrationSyncPaths {
  const raw = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

  return {
    cases: normalizeOptionalString(raw.cases) ?? normalizeOptionalString(legacySyncPath),
    lawyerVerification: normalizeOptionalString(raw.lawyer_verification ?? raw.lawyerVerification),
    judicialCosts: normalizeOptionalString(raw.judicial_costs ?? raw.judicialCosts),
    enforcementRequests: normalizeOptionalString(raw.enforcement_requests ?? raw.enforcementRequests),
    documents: normalizeOptionalString(raw.documents ?? raw.case_documents ?? raw.caseDocuments),
    sessionMinutes: normalizeOptionalString(raw.session_minutes ?? raw.sessionMinutes),
  };
}

function normalizeEnvironmentConfig(value: unknown, legacyConfig?: Record<string, unknown>): IntegrationEnvironmentConfig {
  const raw = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  return {
    baseUrl: normalizeString(raw.base_url ?? raw.baseUrl ?? legacyConfig?.base_url),
    tokenPath: normalizeOptionalString(raw.token_path ?? raw.tokenPath),
    healthPath: normalizeOptionalString(raw.health_path ?? raw.healthPath),
    syncPaths: normalizeSyncPaths(raw.sync_paths ?? raw.syncPaths, legacyConfig?.sync_path),
    lastError: normalizeOptionalString(raw.last_error ?? raw.lastError ?? legacyConfig?.last_error),
    lastTestedAt: normalizeOptionalString(raw.last_tested_at ?? raw.lastTestedAt ?? legacyConfig?.last_tested_at),
    lastConnectedAt: normalizeOptionalString(
      raw.last_connected_at ?? raw.lastConnectedAt ?? legacyConfig?.last_connected_at,
    ),
    useMock: raw.use_mock === true || raw.useMock === true,
  };
}

function decodeSecrets(
  secretEnc: string | null,
  fallbackEnvironment: IntegrationEnvironment,
): Partial<Record<IntegrationEnvironment, IntegrationCredentials>> {
  if (!secretEnc) {
    return {};
  }

  const decrypted = decryptJson<StoredSecretsV2 | StoredEnvironmentSecrets>(secretEnc);
  if (
    decrypted &&
    typeof decrypted === 'object' &&
    'version' in decrypted &&
    (decrypted as StoredSecretsV2).version === 2
  ) {
    const environments = (decrypted as StoredSecretsV2).environments ?? {};
    const output: Partial<Record<IntegrationEnvironment, IntegrationCredentials>> = {};

    for (const environment of ['sandbox', 'production'] as const) {
      const value = environments[environment];
      if (!value?.client_id || !value.client_secret) {
        continue;
      }

      output[environment] = {
        clientId: value.client_id,
        clientSecret: value.client_secret,
        scope: normalizeOptionalString(value.scope),
      };
    }

    return output;
  }

  const legacy = decrypted as StoredEnvironmentSecrets;
  if (!legacy?.client_id || !legacy.client_secret) {
    return {};
  }

  return {
    [fallbackEnvironment]: {
      clientId: legacy.client_id,
      clientSecret: legacy.client_secret,
      scope: normalizeOptionalString(legacy.scope),
    },
  };
}

export function createEmptyIntegrationAccount(orgId: string): IntegrationAccount {
  return {
    id: null,
    orgId,
    provider: 'najiz',
    status: 'disconnected',
    healthStatus: 'not_configured',
    activeEnvironment: 'sandbox',
    configVersion: 2,
    createdBy: null,
    updatedBy: null,
    updatedAt: null,
    lastSyncedAt: null,
    lastHealthCheckedAt: null,
    lastHealthError: null,
    environments: emptyEnvironmentMap(),
    credentials: {},
    rawConfig: {},
    hasCredentials: false,
  };
}

export function parseIntegrationAccountRow(row: IntegrationAccountRow | null): IntegrationAccount | null {
  if (!row) {
    return null;
  }

  const rawConfig = row.config && typeof row.config === 'object' ? row.config : {};
  const activeEnvironment = asEnvironment(
    row.active_environment ?? rawConfig.active_environment ?? rawConfig.environment,
    'sandbox',
  );
  const rawEnvironments =
    rawConfig.environments && typeof rawConfig.environments === 'object'
      ? (rawConfig.environments as Record<string, unknown>)
      : {};
  const environments = emptyEnvironmentMap();

  environments.sandbox = normalizeEnvironmentConfig(rawEnvironments.sandbox, rawConfig);
  environments.production = normalizeEnvironmentConfig(rawEnvironments.production, rawConfig);

  const credentials = decodeSecrets(row.secret_enc, activeEnvironment);

  return {
    id: row.id,
    orgId: row.org_id,
    provider: row.provider,
    status: row.status,
    healthStatus:
      row.health_status === 'healthy' ||
      row.health_status === 'degraded' ||
      row.health_status === 'offline' ||
      row.health_status === 'not_configured'
        ? row.health_status
        : 'not_configured',
    activeEnvironment,
    configVersion: typeof row.config_version === 'number' ? row.config_version : 2,
    createdBy: row.created_by,
    updatedBy: row.updated_by ?? null,
    updatedAt: row.updated_at ?? null,
    lastSyncedAt: row.last_synced_at ?? null,
    lastHealthCheckedAt: row.last_health_checked_at ?? null,
    lastHealthError: row.last_health_error ?? null,
    environments,
    credentials,
    rawConfig,
    hasCredentials: Object.keys(credentials).length > 0,
  };
}

export function serializeIntegrationAccount(account: IntegrationAccount) {
  const activeConfig = account.environments[account.activeEnvironment];

  const config = {
    version: 2,
    active_environment: account.activeEnvironment,
    environment: account.activeEnvironment,
    base_url: activeConfig.baseUrl || null,
    sync_path: activeConfig.syncPaths.cases,
    last_error: activeConfig.lastError,
    last_tested_at: activeConfig.lastTestedAt,
    last_connected_at: activeConfig.lastConnectedAt,
    environments: {
      sandbox: {
        base_url: account.environments.sandbox.baseUrl || null,
        token_path: account.environments.sandbox.tokenPath,
        health_path: account.environments.sandbox.healthPath,
        sync_paths: {
          cases: account.environments.sandbox.syncPaths.cases,
          lawyer_verification: account.environments.sandbox.syncPaths.lawyerVerification,
          judicial_costs: account.environments.sandbox.syncPaths.judicialCosts,
          enforcement_requests: account.environments.sandbox.syncPaths.enforcementRequests,
          documents: account.environments.sandbox.syncPaths.documents,
          session_minutes: account.environments.sandbox.syncPaths.sessionMinutes,
        },
        last_error: account.environments.sandbox.lastError,
        last_tested_at: account.environments.sandbox.lastTestedAt,
        last_connected_at: account.environments.sandbox.lastConnectedAt,
        use_mock: account.environments.sandbox.useMock,
      },
      production: {
        base_url: account.environments.production.baseUrl || null,
        token_path: account.environments.production.tokenPath,
        health_path: account.environments.production.healthPath,
        sync_paths: {
          cases: account.environments.production.syncPaths.cases,
          lawyer_verification: account.environments.production.syncPaths.lawyerVerification,
          judicial_costs: account.environments.production.syncPaths.judicialCosts,
          enforcement_requests: account.environments.production.syncPaths.enforcementRequests,
          documents: account.environments.production.syncPaths.documents,
          session_minutes: account.environments.production.syncPaths.sessionMinutes,
        },
        last_error: account.environments.production.lastError,
        last_tested_at: account.environments.production.lastTestedAt,
        last_connected_at: account.environments.production.lastConnectedAt,
        use_mock: account.environments.production.useMock,
      },
    },
  } satisfies Record<string, unknown>;

  const serializedSecrets: StoredSecretsV2 = {
    version: 2,
    environments: {},
  };

  for (const environment of ['sandbox', 'production'] as const) {
    const credentials = account.credentials[environment];
    if (!credentials?.clientId || !credentials.clientSecret) {
      continue;
    }

    serializedSecrets.environments[environment] = {
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      scope: credentials.scope,
    };
  }

  const secretEnc = Object.keys(serializedSecrets.environments).length
    ? encryptJson(serializedSecrets)
    : null;

  return {
    config,
    secretEnc,
  };
}

export function setEnvironmentConfig(
  account: IntegrationAccount,
  environment: IntegrationEnvironment,
  update: Partial<Omit<IntegrationEnvironmentConfig, 'syncPaths'>> & {
    syncPaths?: Partial<IntegrationSyncPaths>;
  },
) {
  account.environments[environment] = {
    ...account.environments[environment],
    ...update,
    syncPaths: {
      ...account.environments[environment].syncPaths,
      ...(update.syncPaths ?? {}),
    },
  };
}

export function setEnvironmentCredentials(
  account: IntegrationAccount,
  environment: IntegrationEnvironment,
  credentials: Partial<IntegrationCredentials> | null,
) {
  if (!credentials) {
    delete account.credentials[environment];
    account.hasCredentials = Object.keys(account.credentials).length > 0;
    return;
  }

  const current = account.credentials[environment] ?? {
    clientId: '',
    clientSecret: '',
    scope: null,
  };

  account.credentials[environment] = {
    clientId: credentials.clientId ?? current.clientId,
    clientSecret: credentials.clientSecret ?? current.clientSecret,
    scope: credentials.scope ?? current.scope ?? null,
  };
  account.hasCredentials = Object.keys(account.credentials).length > 0;
}

export function setAccountHealth(
  account: IntegrationAccount,
  update: {
    status?: IntegrationConnectionStatus;
    healthStatus?: IntegrationHealthStatus;
    lastHealthCheckedAt?: string | null;
    lastHealthError?: string | null;
    lastSyncedAt?: string | null;
  },
) {
  if (update.status) {
    account.status = update.status;
  }
  if (update.healthStatus) {
    account.healthStatus = update.healthStatus;
  }
  if (update.lastHealthCheckedAt !== undefined) {
    account.lastHealthCheckedAt = update.lastHealthCheckedAt;
  }
  if (update.lastHealthError !== undefined) {
    account.lastHealthError = update.lastHealthError;
  }
  if (update.lastSyncedAt !== undefined) {
    account.lastSyncedAt = update.lastSyncedAt;
  }
}
