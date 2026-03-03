import type { SupabaseClient } from '@supabase/supabase-js';

export async function insertCopilotAuditLog(params: {
  supabase: SupabaseClient;
  requestId: string;
  orgId: string;
  userId: string;
  caseId: string;
  sessionId?: string | null;
  messageId?: string | null;
  status: 'ok' | 'validation_failed' | 'quota_exceeded' | 'rate_limited' | 'forbidden' | 'error';
  model: string;
  intent?: string;
  cached: boolean;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  errorCode?: string | null;
  errorMessage?: string | null;
  meta?: Record<string, unknown>;
}) {
  const { error } = await params.supabase.from('copilot_audit_logs').insert({
    request_id: params.requestId,
    org_id: params.orgId,
    user_id: params.userId,
    case_id: params.caseId,
    session_id: params.sessionId ?? null,
    message_id: params.messageId ?? null,
    status: params.status,
    model: params.model,
    intent: params.intent ?? null,
    cached: params.cached,
    input_tokens: params.inputTokens,
    output_tokens: params.outputTokens,
    latency_ms: params.latencyMs,
    error_code: params.errorCode ?? null,
    error_message: params.errorMessage ?? null,
    meta: params.meta ?? {},
  });

  if (error) {
    throw error;
  }
}
