import 'server-only';

import { najizFetch } from '@/lib/integrations/najizClient';
import { integrationError } from '../../domain/errors';
import type {
  IntegrationAccount,
  IntegrationEnvironmentConfig,
  JsonObject,
  SyncCaseInput,
  SyncDocumentsInput,
  SyncEnforcementRequestsInput,
  SyncJudicialCostsInput,
  SyncSessionMinutesInput,
  VerifyLawyerInput,
} from '../../domain/models';
import { NajizMockAdapter } from './mock-adapter';

export interface NajizProviderAdapter {
  checkHealth(account: IntegrationAccount): Promise<{ message: string; rawPayload: JsonObject }>;
  fetchLawyerVerification(account: IntegrationAccount, input: VerifyLawyerInput): Promise<JsonObject>;
  fetchCases(account: IntegrationAccount, input: SyncCaseInput): Promise<JsonObject>;
  fetchJudicialCosts(account: IntegrationAccount, input: SyncJudicialCostsInput): Promise<JsonObject>;
  fetchEnforcementRequests(account: IntegrationAccount, input: SyncEnforcementRequestsInput): Promise<JsonObject>;
  fetchDocuments(account: IntegrationAccount, input: SyncDocumentsInput): Promise<JsonObject>;
  fetchSessionMinutes(account: IntegrationAccount, input: SyncSessionMinutesInput): Promise<JsonObject>;
}

export function resolveNajizProviderAdapter(account: IntegrationAccount): NajizProviderAdapter {
  const environmentConfig = account.environments[account.activeEnvironment];
  if (environmentConfig.useMock || process.env.NAJIZ_USE_MOCK_ADAPTER?.trim() === '1') {
    return new NajizMockAdapter();
  }

  return new NajizHttpAdapter();
}

class NajizHttpAdapter implements NajizProviderAdapter {
  async checkHealth(account: IntegrationAccount) {
    const accessToken = await requestAccessToken(account);
    return {
      message: accessToken ? 'تم التحقق من الاتصال بـ Najiz.' : 'تعذر الحصول على رمز الوصول.',
      rawPayload: {
        access_token_received: Boolean(accessToken),
        active_environment: account.activeEnvironment,
      },
    };
  }

  async fetchLawyerVerification(account: IntegrationAccount, input: VerifyLawyerInput) {
    const environmentConfig = getEnvironmentConfig(account);
    const path =
      input.endpointPath ||
      environmentConfig.syncPaths.lawyerVerification ||
      '/api/v1/lawyers/verify';

    return requestJson(account, {
      path,
      method: 'POST',
      body: {
        lawyerUserId: input.lawyerUserId,
        licenseNumber: input.licenseNumber,
        nationalId: input.nationalId,
      },
    });
  }

  async fetchCases(account: IntegrationAccount, input: SyncCaseInput) {
    const environmentConfig = getEnvironmentConfig(account);
    const path = input.endpointPath || environmentConfig.syncPaths.cases || '/api/v1/cases';

    return requestJson(account, {
      path,
      method: 'GET',
      query: input.caseNumber ? { caseNumber: input.caseNumber } : undefined,
    });
  }

  async fetchJudicialCosts(account: IntegrationAccount, input: SyncJudicialCostsInput) {
    const environmentConfig = getEnvironmentConfig(account);
    const path =
      input.endpointPath ||
      environmentConfig.syncPaths.judicialCosts ||
      '/api/v1/judicial-costs';

    return requestJson(account, {
      path,
      method: 'GET',
      query: input.caseNumber ? { caseNumber: input.caseNumber } : undefined,
    });
  }

  async fetchEnforcementRequests(account: IntegrationAccount, input: SyncEnforcementRequestsInput) {
    const environmentConfig = getEnvironmentConfig(account);
    const path =
      input.endpointPath ||
      environmentConfig.syncPaths.enforcementRequests ||
      '/api/v1/enforcement-requests';

    return requestJson(account, {
      path,
      method: 'GET',
      query: {
        caseNumber: input.caseNumber,
        externalCaseId: input.externalCaseId,
      },
    });
  }

  async fetchDocuments(account: IntegrationAccount, input: SyncDocumentsInput) {
    const environmentConfig = getEnvironmentConfig(account);
    const path = input.endpointPath || environmentConfig.syncPaths.documents || '/api/v1/case-documents';

    return requestJson(account, {
      path,
      method: 'GET',
      query: {
        caseNumber: input.caseNumber,
        externalCaseId: input.externalCaseId,
      },
    });
  }

  async fetchSessionMinutes(account: IntegrationAccount, input: SyncSessionMinutesInput) {
    const environmentConfig = getEnvironmentConfig(account);
    const path = input.endpointPath || environmentConfig.syncPaths.sessionMinutes || '/api/v1/session-minutes';

    return requestJson(account, {
      path,
      method: 'GET',
      query: {
        caseNumber: input.caseNumber,
        externalCaseId: input.externalCaseId,
      },
    });
  }
}

type RequestJsonOptions = {
  path: string;
  method: 'GET' | 'POST';
  query?: Record<string, string | null | undefined>;
  body?: JsonObject;
};

function getEnvironmentConfig(account: IntegrationAccount): IntegrationEnvironmentConfig {
  const environmentConfig = account.environments[account.activeEnvironment];
  if (!environmentConfig.baseUrl) {
    throw integrationError('integration_not_configured', 'رابط Najiz غير مضبوط لهذه البيئة.', {
      statusCode: 400,
    });
  }

  return environmentConfig;
}

async function requestAccessToken(account: IntegrationAccount): Promise<string> {
  const environmentConfig = getEnvironmentConfig(account);
  const credentials = account.credentials[account.activeEnvironment];
  if (!credentials?.clientId || !credentials.clientSecret) {
    throw integrationError('integration_not_configured', 'بيانات Najiz غير مكتملة لهذه البيئة.', {
      statusCode: 400,
    });
  }

  const tokenUrl = buildAbsoluteUrl(
    environmentConfig.baseUrl,
    environmentConfig.tokenPath || '/oauth/token',
  );

  const body = new URLSearchParams();
  body.set('grant_type', 'client_credentials');
  body.set('client_id', credentials.clientId);
  body.set('client_secret', credentials.clientSecret);
  if (credentials.scope) {
    body.set('scope', credentials.scope);
  }

  const response = await najizFetch(
    tokenUrl,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body,
      cache: 'no-store',
    },
    { throttleKey: environmentConfig.baseUrl, maxAttempts: 3, timeoutMs: 12_000 },
  );

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw integrationError('provider_unauthorized', 'بيانات Najiz غير صحيحة أو لا تملك صلاحية الوصول.', {
        statusCode: 400,
      });
    }

    throw integrationError('provider_token_failed', `فشل الحصول على رمز الوصول (${response.status}).`, {
      statusCode: 502,
      retryable: response.status >= 500,
    });
  }

  const payload = (await response.json().catch(() => null)) as { access_token?: string } | null;
  if (!payload?.access_token) {
    throw integrationError('provider_token_invalid', 'تعذر قراءة رمز الوصول من Najiz.', {
      statusCode: 502,
    });
  }

  return payload.access_token;
}

async function requestJson(account: IntegrationAccount, options: RequestJsonOptions): Promise<JsonObject> {
  const environmentConfig = getEnvironmentConfig(account);
  const accessToken = await requestAccessToken(account);
  const url = buildUrl(environmentConfig.baseUrl, options.path, options.query);

  const response = await najizFetch(
    url,
    {
      method: options.method,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      cache: 'no-store',
    },
    { throttleKey: environmentConfig.baseUrl, maxAttempts: 3, timeoutMs: 15_000 },
  );

  if (!response.ok) {
    throw integrationError(
      'provider_request_failed',
      `فشل طلب Najiz (${response.status}). تحقق من مسار التكامل وإعداداته.`,
      {
        statusCode: response.status >= 500 ? 502 : 400,
        retryable: response.status >= 500 || response.status === 429,
      },
    );
  }

  const payload = (await response.json().catch(() => null)) as JsonObject | null;
  if (!payload || typeof payload !== 'object') {
    throw integrationError('provider_invalid_payload', 'استجاب Najiz ببيانات غير متوقعة.', {
      statusCode: 502,
    });
  }

  return payload;
}

function buildUrl(baseUrl: string, path: string, query?: Record<string, string | null | undefined>) {
  const absolute = buildAbsoluteUrl(baseUrl, path);
  const url = new URL(absolute);

  for (const [key, value] of Object.entries(query ?? {})) {
    if (!value) {
      continue;
    }
    url.searchParams.set(key, value);
  }

  return url.toString();
}

function buildAbsoluteUrl(baseUrl: string, path: string) {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }

  const normalizedBase = baseUrl.replace(/\/+$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}
