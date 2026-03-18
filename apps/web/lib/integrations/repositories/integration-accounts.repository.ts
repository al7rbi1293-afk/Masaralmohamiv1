import 'server-only';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  parseIntegrationAccountRow,
  serializeIntegrationAccount,
} from '../domain/services/account-config.service';
import type { IntegrationAccount, IntegrationProviderKey } from '../domain/models';

type IntegrationAccountRow = {
  id: string;
  org_id: string;
  provider: 'najiz';
  status: 'disconnected' | 'connected' | 'error';
  config: Record<string, unknown> | null;
  secret_enc: string | null;
  created_by: string | null;
  updated_at: string | null;
  active_environment: string | null;
  health_status: string | null;
  last_synced_at: string | null;
  last_health_checked_at: string | null;
  last_health_error: string | null;
  updated_by: string | null;
  config_version: number | null;
};

const ACCOUNT_SELECT = [
  'id',
  'org_id',
  'provider',
  'status',
  'config',
  'secret_enc',
  'created_by',
  'updated_at',
  'active_environment',
  'health_status',
  'last_synced_at',
  'last_health_checked_at',
  'last_health_error',
  'updated_by',
  'config_version',
].join(', ');

export async function getIntegrationAccount(
  orgId: string,
  provider: IntegrationProviderKey = 'najiz',
): Promise<IntegrationAccount | null> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('org_integrations')
    .select(ACCOUNT_SELECT)
    .eq('org_id', orgId)
    .eq('provider', provider)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return parseIntegrationAccountRow((data as IntegrationAccountRow | null) ?? null);
}

export async function saveIntegrationAccount(account: IntegrationAccount, actorUserId: string) {
  const supabase = createSupabaseServerClient();
  const { config, secretEnc } = serializeIntegrationAccount(account);

  const payload = {
    id: account.id ?? undefined,
    org_id: account.orgId,
    provider: account.provider,
    status: account.status,
    config,
    secret_enc: secretEnc,
    created_by: account.createdBy ?? actorUserId,
    updated_by: actorUserId,
    active_environment: account.activeEnvironment,
    health_status: account.healthStatus,
    last_synced_at: account.lastSyncedAt,
    last_health_checked_at: account.lastHealthCheckedAt,
    last_health_error: account.lastHealthError,
    config_version: account.configVersion,
  };

  const { data, error } = await supabase
    .from('org_integrations')
    .upsert(payload, { onConflict: 'org_id,provider' })
    .select(ACCOUNT_SELECT)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return parseIntegrationAccountRow((data as IntegrationAccountRow | null) ?? null);
}

export async function listIntegrationAccounts(
  provider: IntegrationProviderKey = 'najiz',
  limit = 100,
): Promise<IntegrationAccount[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('org_integrations')
    .select(ACCOUNT_SELECT)
    .eq('provider', provider)
    .order('updated_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (((data as unknown) as IntegrationAccountRow[] | null) ?? [])
    .map((row) => parseIntegrationAccountRow(row))
    .filter((row): row is IntegrationAccount => Boolean(row));
}
