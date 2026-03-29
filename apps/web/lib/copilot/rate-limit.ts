import type { SupabaseClient } from '@supabase/supabase-js';

export type RateLimitResult = {
  allowed: boolean;
  currentCount: number;
  resetAt: string;
};

export async function consumeCopilotRateLimit(params: {
  supabase: SupabaseClient;
  orgId: string;
  limit: number;
  windowSeconds?: number;
  userId?: string;
}): Promise<RateLimitResult> {
  const rpcName = params.userId
    ? 'consume_copilot_rate_limit_for_user'
    : 'consume_copilot_rate_limit';
  const rpcParams = params.userId
    ? {
        p_org_id: params.orgId,
        p_user_id: params.userId,
        p_limit: params.limit,
        p_window_seconds: params.windowSeconds ?? 60,
      }
    : {
        p_org_id: params.orgId,
        p_limit: params.limit,
        p_window_seconds: params.windowSeconds ?? 60,
      };

  const { data, error } = await params.supabase.rpc(rpcName, rpcParams);

  if (error) {
    throw error;
  }

  const row = Array.isArray(data) ? data[0] : null;
  return {
    allowed: Boolean(row?.allowed),
    currentCount: Number(row?.current_count ?? 0),
    resetAt: String(row?.reset_at ?? new Date(Date.now() + 60_000).toISOString()),
  };
}
