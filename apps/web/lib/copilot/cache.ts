import crypto from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

export type CopilotCacheType = 'embedding' | 'retrieval' | 'answer';

export function stableHash(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

export function buildScopedCacheKey(params: {
  base: string;
  orgId: string;
  userId: string;
  caseId: string;
}): string {
  return stableHash(`${params.base}:${params.orgId}:${params.userId}:${params.caseId}`);
}

export async function getCachePayload<T>(params: {
  supabase: SupabaseClient;
  orgId: string;
  cacheType: CopilotCacheType;
  cacheKey: string;
}): Promise<T | null> {
  const { data, error } = await params.supabase
    .from('copilot_cache')
    .select('payload, expires_at')
    .eq('org_id', params.orgId)
    .eq('cache_type', params.cacheType)
    .eq('cache_key', params.cacheKey)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) return null;
  return (data as any).payload as T;
}

export async function upsertCachePayload(params: {
  supabase: SupabaseClient;
  orgId: string;
  userId: string;
  caseId: string;
  cacheType: CopilotCacheType;
  cacheKey: string;
  payload: unknown;
  ttlSeconds: number;
}) {
  const expiresAt = new Date(Date.now() + Math.max(1, params.ttlSeconds) * 1000).toISOString();

  const { error } = await params.supabase
    .from('copilot_cache')
    .upsert(
      {
        org_id: params.orgId,
        user_id: params.userId,
        case_id: params.caseId,
        cache_type: params.cacheType,
        cache_key: params.cacheKey,
        payload: params.payload,
        expires_at: expiresAt,
      },
      { onConflict: 'org_id,cache_type,cache_key' },
    );

  if (error) {
    throw error;
  }
}
