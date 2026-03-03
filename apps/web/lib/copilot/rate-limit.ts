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
}): Promise<RateLimitResult> {
  const { data, error } = await params.supabase.rpc('consume_copilot_rate_limit', {
    p_org_id: params.orgId,
    p_limit: params.limit,
    p_window_seconds: params.windowSeconds ?? 60,
  });

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
