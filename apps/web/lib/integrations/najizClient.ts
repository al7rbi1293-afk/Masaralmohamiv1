import 'server-only';

import { requireOwner } from '@/lib/org';
import { createSupabaseServerRlsClient } from '@/lib/supabase/server';
import { decryptJson, encryptJson } from '@/lib/crypto';

type NajizEnvironment = 'sandbox' | 'production';

export type NajizIntegrationConfig = {
  environment: NajizEnvironment;
  base_url: string;
  last_error?: string | null;
  sync_path?: string | null;
  last_tested_at?: string | null;
  last_connected_at?: string | null;
};

type NajizSecrets = {
  client_id: string;
  client_secret: string;
  scope?: string | null;
};

export type NajizIntegrationRow = {
  id: string;
  org_id: string;
  provider: 'najiz';
  status: 'disconnected' | 'connected' | 'error';
  config: NajizIntegrationConfig;
  secret_enc: string | null;
  created_by: string;
  updated_at: string;
};

export async function getNajizConfigForOrg(): Promise<NajizIntegrationRow | null> {
  const { orgId } = await requireOwner();
  const supabase = createSupabaseServerRlsClient();

  const { data, error } = await supabase
    .from('org_integrations')
    .select('id, org_id, provider, status, config, secret_enc, created_by, updated_at')
    .eq('org_id', orgId)
    .eq('provider', 'najiz')
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as any) ? (data as NajizIntegrationRow) : null;
}

export async function upsertNajizIntegration(params: {
  environment: NajizEnvironment;
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  scope?: string | null;
}) {
  const { orgId, userId } = await requireOwner();
  const supabase = createSupabaseServerRlsClient();

  const config: NajizIntegrationConfig = {
    environment: params.environment,
    base_url: normalizeBaseUrl(params.baseUrl),
  };

  const secret_enc = encryptJson({
    client_id: params.clientId,
    client_secret: params.clientSecret,
    scope: params.scope ?? null,
  } satisfies NajizSecrets);

  const { data, error } = await supabase
    .from('org_integrations')
    .upsert(
      {
        org_id: orgId,
        provider: 'najiz',
        status: 'disconnected',
        config,
        secret_enc,
        created_by: userId,
      },
      { onConflict: 'org_id,provider' },
    )
    .select('id, org_id, provider, status, config, secret_enc, created_by, updated_at')
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as NajizIntegrationRow) ?? null;
}

export async function disconnectNajizIntegration() {
  const { orgId } = await requireOwner();
  const supabase = createSupabaseServerRlsClient();

  const { error } = await supabase
    .from('org_integrations')
    .update({
      status: 'disconnected',
      config: {},
      secret_enc: null,
    })
    .eq('org_id', orgId)
    .eq('provider', 'najiz');

  if (error) {
    throw error;
  }
}

export async function testNajizConnectionForOrg(): Promise<{ ok: boolean; message: string }> {
  const row = await getNajizConfigForOrg();
  if (!row || !row.secret_enc) {
    return { ok: false, message: 'لم يتم إعداد التكامل بعد.' };
  }

  const secrets = decryptJson<NajizSecrets>(row.secret_enc);
  const config = (row.config ?? {}) as NajizIntegrationConfig;

  if (!config.base_url || !secrets.client_id || !secrets.client_secret) {
    return { ok: false, message: 'بيانات التكامل غير مكتملة.' };
  }

  return testNajizOAuth({
    baseUrl: String(config.base_url),
    clientId: String(secrets.client_id),
    clientSecret: String(secrets.client_secret),
    scope: secrets.scope ? String(secrets.scope) : null,
  });
}

export async function setNajizStatus(status: 'connected' | 'error', lastError?: string | null) {
  const { orgId } = await requireOwner();
  const supabase = createSupabaseServerRlsClient();

  const existing = await getNajizConfigForOrg();
  const currentConfig = (existing?.config ?? {}) as Record<string, any>;

  const mergedConfig: Record<string, any> = {
    ...currentConfig,
    ...(status === 'connected' ? { last_error: null } : {}),
    ...(status === 'error' ? { last_error: lastError ?? 'تعذر الاتصال.' } : {}),
  };

  const { error } = await supabase
    .from('org_integrations')
    .update({
      status,
      config: mergedConfig,
    })
    .eq('org_id', orgId)
    .eq('provider', 'najiz');

  if (error) {
    throw error;
  }
}

export async function testNajizOAuth(params: {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  scope?: string | null;
}) {
  const tokenUrl = buildTokenUrl(params.baseUrl);

  const body = new URLSearchParams();
  body.set('grant_type', 'client_credentials');
  body.set('client_id', params.clientId);
  body.set('client_secret', params.clientSecret);
  if (params.scope) {
    body.set('scope', params.scope);
  }

  let response: Response;
  try {
    response = await najizFetch(
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
      { throttleKey: params.baseUrl, maxAttempts: 2, timeoutMs: 12_000 },
    );
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'تعذر الاتصال بـ Najiz. حاول مرة أخرى.',
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      message: `فشل اختبار الاتصال (${response.status}). تحقق من بيانات Najiz.`,
    };
  }

  const json = (await response.json().catch(() => null)) as any;
  if (!json || typeof json.access_token !== 'string' || !json.access_token) {
    return {
      ok: false,
      message: 'تم الاتصال لكن الرد غير متوقع. تحقق من إعدادات Najiz.',
    };
  }

  return { ok: true, message: 'تم الاتصال بنجاح.' };
}

export async function getNajizAccessToken(params: {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  scope?: string | null;
}): Promise<string> {
  const tokenUrl = buildTokenUrl(params.baseUrl);

  const body = new URLSearchParams();
  body.set('grant_type', 'client_credentials');
  body.set('client_id', params.clientId);
  body.set('client_secret', params.clientSecret);
  if (params.scope) {
    body.set('scope', params.scope);
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
    { throttleKey: params.baseUrl, maxAttempts: 2, timeoutMs: 12_000 },
  );

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error('بيانات Najiz غير صحيحة أو لا تملك صلاحية الوصول.');
    }
    throw new Error(`فشل الحصول على رمز الوصول (${response.status}).`);
  }

  const json = (await response.json().catch(() => null)) as any;
  const token = json?.access_token;
  if (!token || typeof token !== 'string') {
    throw new Error('تعذر قراءة رمز الوصول من Najiz.');
  }

  return token;
}

type NajizFetchOptions = {
  throttleKey?: string;
  throttleMs?: number;
  timeoutMs?: number;
  maxAttempts?: number;
};

const throttleStoreKey = '__masar_najiz_throttle__';

function getThrottleStore() {
  const globalStore = globalThis as typeof globalThis & {
    [throttleStoreKey]?: Map<string, number>;
  };

  if (!globalStore[throttleStoreKey]) {
    globalStore[throttleStoreKey] = new Map<string, number>();
  }

  return globalStore[throttleStoreKey];
}

async function sleep(ms: number) {
  if (!ms || ms <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientStatus(status: number) {
  return status === 408 || status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

function parseRetryAfterSeconds(value: string | null) {
  if (!value) return 0;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds > 0) {
    return seconds;
  }
  return 0;
}

export async function najizFetch(url: string, init: RequestInit, options: NajizFetchOptions = {}) {
  const maxAttempts = options.maxAttempts ?? 3;
  const timeoutMs = options.timeoutMs ?? 15_000;
  const throttleMs = options.throttleMs ?? 250;
  const throttleKey = (options.throttleKey || '').trim() || (() => {
    try {
      return new URL(url).origin;
    } catch {
      return 'najiz';
    }
  })();

  const store = getThrottleStore();
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const now = Date.now();
    const nextAllowedAt = store.get(throttleKey) ?? 0;
    if (nextAllowedAt > now) {
      await sleep(nextAllowedAt - now);
    }
    store.set(throttleKey, Date.now() + throttleMs);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
      }).finally(() => clearTimeout(timeoutId));

      if (response.ok || !isTransientStatus(response.status) || attempt === maxAttempts) {
        return response;
      }

      const retryAfter = parseRetryAfterSeconds(response.headers.get('retry-after'));
      const baseDelay = retryAfter ? retryAfter * 1000 : 300;
      const delay = Math.min(3_000, baseDelay * Math.pow(2, attempt - 1)) + Math.floor(Math.random() * 100);
      await sleep(delay);
      continue;
    } catch (error) {
      clearTimeout(timeoutId);
      lastError = error;

      const message = error instanceof Error ? error.message : '';
      if (message.toLowerCase().includes('aborted')) {
        if (attempt === maxAttempts) {
          throw new Error('انتهت مهلة الاتصال بـ Najiz. حاول مرة أخرى.');
        }
      } else if (attempt === maxAttempts) {
        throw new Error('تعذر الاتصال بـ Najiz. حاول مرة أخرى.');
      }

      const delay = Math.min(3_000, 300 * Math.pow(2, attempt - 1)) + Math.floor(Math.random() * 100);
      await sleep(delay);
    }
  }

  throw lastError instanceof Error ? lastError : new Error('تعذر الاتصال بـ Najiz.');
}

function normalizeBaseUrl(value: string) {
  const trimmed = String(value || '').trim();
  return trimmed.replace(/\/+$/, '');
}

function buildTokenUrl(baseUrl: string) {
  const trimmed = normalizeBaseUrl(baseUrl);
  // Najiz OAuth endpoint may vary. We keep a conservative default and allow
  // users to provide the base URL from the official docs.
  if (trimmed.endsWith('/oauth/token') || trimmed.endsWith('/oauth2/token')) {
    return trimmed;
  }
  return `${trimmed}/oauth/token`;
}
