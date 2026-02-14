import 'server-only';

import { requireOwner } from '@/lib/org';
import { createSupabaseServerRlsClient } from '@/lib/supabase/server';
import { decryptJson, encryptJson } from '@/lib/crypto';

type NajizEnvironment = 'sandbox' | 'production';

export type NajizIntegrationConfig = {
  environment: NajizEnvironment;
  base_url: string;
  last_error?: string | null;
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

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body,
    cache: 'no-store',
  });

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
