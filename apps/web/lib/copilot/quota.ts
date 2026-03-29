import type { SupabaseClient } from '@supabase/supabase-js';

export type CopilotQuotaState = {
  allowed: boolean;
  requestsUsed: number;
  tokensUsed: number;
  monthStart: string;
};

export async function consumeRequestQuota(params: {
  supabase: SupabaseClient;
  orgId: string;
  requestsLimit: number;
  tokensLimit: number;
  userId?: string;
}): Promise<CopilotQuotaState> {
  return consumeQuota({
    supabase: params.supabase,
    orgId: params.orgId,
    requestInc: 1,
    tokenInc: 0,
    requestsLimit: params.requestsLimit,
    tokensLimit: params.tokensLimit,
    userId: params.userId,
  });
}

export async function addTokenUsage(params: {
  supabase: SupabaseClient;
  orgId: string;
  tokenInc: number;
  userId?: string;
}): Promise<void> {
  await consumeQuota({
    supabase: params.supabase,
    orgId: params.orgId,
    requestInc: 0,
    tokenInc: Math.max(0, params.tokenInc),
    requestsLimit: 2_147_483_647,
    tokensLimit: Number.MAX_SAFE_INTEGER,
    userId: params.userId,
  });
}

async function consumeQuota(params: {
  supabase: SupabaseClient;
  orgId: string;
  requestInc: number;
  tokenInc: number;
  requestsLimit: number;
  tokensLimit: number;
  userId?: string;
}): Promise<CopilotQuotaState> {
  const rpcName = params.userId
    ? 'consume_copilot_quota_for_user'
    : 'consume_copilot_quota';
  const rpcParams = params.userId
    ? {
        p_org_id: params.orgId,
        p_user_id: params.userId,
        p_request_inc: params.requestInc,
        p_token_inc: params.tokenInc,
        p_request_limit: params.requestsLimit,
        p_token_limit: params.tokensLimit,
      }
    : {
        p_org_id: params.orgId,
        p_request_inc: params.requestInc,
        p_token_inc: params.tokenInc,
        p_request_limit: params.requestsLimit,
        p_token_limit: params.tokensLimit,
      };
  const { data, error } = await params.supabase.rpc(rpcName, rpcParams);

  if (error) {
    throw error;
  }

  const row = Array.isArray(data) ? data[0] : null;
  return {
    allowed: Boolean(row?.allowed),
    requestsUsed: Number(row?.requests_used ?? 0),
    tokensUsed: Number(row?.tokens_used ?? 0),
    monthStart: String(row?.month_start ?? ''),
  };
}
