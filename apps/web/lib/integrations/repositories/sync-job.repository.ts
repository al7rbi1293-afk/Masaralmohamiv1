import 'server-only';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import type {
  JsonObject,
  IntegrationEnvironment,
  IntegrationProviderKey,
  SyncJobKind,
  SyncJobRecord,
  SyncJobStatus,
  SyncLogRecord,
  SyncTriggerMode,
} from '../domain/models';

type SyncJobRow = {
  id: string;
  legacy_run_id: string | null;
  org_id: string;
  integration_id: string | null;
  provider: IntegrationProviderKey;
  source: string;
  job_kind: SyncJobKind;
  status: SyncJobStatus;
  environment: IntegrationEnvironment;
  trigger_mode: SyncTriggerMode;
  requested_by: string | null;
  matter_id: string | null;
  subject_type: string | null;
  subject_id: string | null;
  attempts: number;
  max_attempts: number;
  retryable: boolean;
  started_at: string;
  completed_at: string | null;
  error_code: string | null;
  error_message: string | null;
  summary: JsonObject | null;
  request_payload: JsonObject | null;
  response_payload: JsonObject | null;
  queue_name: string | null;
  available_at: string | null;
  scheduled_for: string | null;
  locked_at: string | null;
  locked_by: string | null;
  parent_job_id: string | null;
  webhook_event_id: string | null;
  dedupe_key: string | null;
  created_at: string;
};

type SyncLogRow = {
  id: string;
  job_id: string;
  org_id: string;
  provider: IntegrationProviderKey;
  level: 'info' | 'warn' | 'error';
  action: string;
  message: string;
  context: JsonObject | null;
  created_by: string | null;
  created_at: string;
};

type CreateSyncJobInput = {
  orgId: string;
  integrationId: string | null;
  provider: IntegrationProviderKey;
  source?: string;
  jobKind: SyncJobKind;
  status?: SyncJobStatus;
  environment: IntegrationEnvironment;
  triggerMode?: SyncTriggerMode;
  requestedBy: string | null;
  matterId?: string | null;
  subjectType?: string | null;
  subjectId?: string | null;
  attempts?: number;
  maxAttempts?: number;
  retryable?: boolean;
  requestPayload?: JsonObject;
  summary?: JsonObject;
  queueName?: string;
  availableAt?: string | null;
  scheduledFor?: string | null;
  lockedAt?: string | null;
  lockedBy?: string | null;
  parentJobId?: string | null;
  webhookEventId?: string | null;
  dedupeKey?: string | null;
};

const JOB_SELECT = [
  'id',
  'legacy_run_id',
  'org_id',
  'integration_id',
  'provider',
  'source',
  'job_kind',
  'status',
  'environment',
  'trigger_mode',
  'requested_by',
  'matter_id',
  'subject_type',
  'subject_id',
  'attempts',
  'max_attempts',
  'retryable',
  'started_at',
  'completed_at',
  'error_code',
  'error_message',
  'summary',
  'request_payload',
  'response_payload',
  'queue_name',
  'available_at',
  'scheduled_for',
  'locked_at',
  'locked_by',
  'parent_job_id',
  'webhook_event_id',
  'dedupe_key',
  'created_at',
].join(', ');

function normalizeJobRow(row: SyncJobRow): SyncJobRecord {
  return {
    id: row.id,
    legacyRunId: row.legacy_run_id,
    orgId: row.org_id,
    integrationId: row.integration_id,
    provider: row.provider,
    source: row.source,
    jobKind: row.job_kind,
    status: row.status,
    environment: row.environment,
    triggerMode: row.trigger_mode,
    requestedBy: row.requested_by,
    matterId: row.matter_id,
    subjectType: row.subject_type,
    subjectId: row.subject_id,
    attempts: row.attempts,
    maxAttempts: row.max_attempts,
    retryable: row.retryable,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    errorCode: row.error_code,
    errorMessage: row.error_message,
    summary: row.summary ?? {},
    requestPayload: row.request_payload ?? {},
    responsePayload: row.response_payload ?? {},
    queueName: row.queue_name ?? 'default',
    availableAt: row.available_at ?? row.started_at,
    scheduledFor: row.scheduled_for,
    lockedAt: row.locked_at,
    lockedBy: row.locked_by,
    parentJobId: row.parent_job_id,
    webhookEventId: row.webhook_event_id,
    dedupeKey: row.dedupe_key,
    createdAt: row.created_at,
  };
}

function normalizeLogRow(row: SyncLogRow): SyncLogRecord {
  return {
    id: row.id,
    jobId: row.job_id,
    orgId: row.org_id,
    provider: row.provider,
    level: row.level,
    action: row.action,
    message: row.message,
    context: row.context ?? {},
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

export async function createSyncJob(input: CreateSyncJobInput) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('integration_sync_jobs')
    .insert({
      org_id: input.orgId,
      integration_id: input.integrationId,
      provider: input.provider,
      source: input.source ?? input.provider,
      job_kind: input.jobKind,
      status: input.status ?? 'running',
      environment: input.environment,
      trigger_mode: input.triggerMode ?? 'manual',
      requested_by: input.requestedBy,
      matter_id: input.matterId ?? null,
      subject_type: input.subjectType ?? null,
      subject_id: input.subjectId ?? null,
      attempts: input.attempts ?? 1,
      max_attempts: input.maxAttempts ?? 3,
      retryable: input.retryable ?? false,
      request_payload: input.requestPayload ?? {},
      summary: input.summary ?? {},
      queue_name: input.queueName ?? 'default',
      available_at: input.availableAt ?? new Date().toISOString(),
      scheduled_for: input.scheduledFor ?? null,
      locked_at: input.lockedAt ?? null,
      locked_by: input.lockedBy ?? null,
      parent_job_id: input.parentJobId ?? null,
      webhook_event_id: input.webhookEventId ?? null,
      dedupe_key: input.dedupeKey ?? null,
    })
    .select(JOB_SELECT)
    .single();

  if (error) {
    throw error;
  }

  return normalizeJobRow((data as unknown) as SyncJobRow);
}

export async function enqueueSyncJob(input: Omit<CreateSyncJobInput, 'status'> & { status?: SyncJobStatus }) {
  return createSyncJob({
    ...input,
    status: input.status ?? 'pending',
  });
}

export async function updateSyncJob(
  jobId: string,
  update: Partial<{
    status: SyncJobStatus;
    attempts: number;
    completedAt: string | null;
    errorCode: string | null;
    errorMessage: string | null;
    summary: JsonObject;
    responsePayload: JsonObject;
    availableAt: string | null;
    scheduledFor: string | null;
    lockedAt: string | null;
    lockedBy: string | null;
    parentJobId: string | null;
    webhookEventId: string | null;
  }>,
) {
  const supabase = createSupabaseServerClient();
  const payload: Record<string, unknown> = {};

  if (update.status) payload.status = update.status;
  if (typeof update.attempts === 'number') payload.attempts = update.attempts;
  if (update.completedAt !== undefined) payload.completed_at = update.completedAt;
  if (update.errorCode !== undefined) payload.error_code = update.errorCode;
  if (update.errorMessage !== undefined) payload.error_message = update.errorMessage;
  if (update.summary !== undefined) payload.summary = update.summary;
  if (update.responsePayload !== undefined) payload.response_payload = update.responsePayload;
  if (update.availableAt !== undefined) payload.available_at = update.availableAt;
  if (update.scheduledFor !== undefined) payload.scheduled_for = update.scheduledFor;
  if (update.lockedAt !== undefined) payload.locked_at = update.lockedAt;
  if (update.lockedBy !== undefined) payload.locked_by = update.lockedBy;
  if (update.parentJobId !== undefined) payload.parent_job_id = update.parentJobId;
  if (update.webhookEventId !== undefined) payload.webhook_event_id = update.webhookEventId;

  const { data, error } = await supabase
    .from('integration_sync_jobs')
    .update(payload)
    .eq('id', jobId)
    .select(JOB_SELECT)
    .single();

  if (error) {
    throw error;
  }

  return normalizeJobRow((data as unknown) as SyncJobRow);
}

export async function appendSyncLog(input: {
  jobId: string;
  orgId: string;
  provider: IntegrationProviderKey;
  level: 'info' | 'warn' | 'error';
  action: string;
  message: string;
  context?: JsonObject;
  createdBy?: string | null;
}) {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from('integration_sync_logs').insert({
    job_id: input.jobId,
    org_id: input.orgId,
    provider: input.provider,
    level: input.level,
    action: input.action,
    message: input.message,
    context: input.context ?? {},
    created_by: input.createdBy ?? null,
  });

  if (error) {
    throw error;
  }
}

export async function listRecentSyncJobs(options: { orgId?: string; limit?: number } = {}) {
  const supabase = createSupabaseServerClient();
  let query = supabase
    .from('integration_sync_jobs')
    .select(JOB_SELECT)
    .order('created_at', { ascending: false })
    .limit(options.limit ?? 50);

  if (options.orgId) {
    query = query.eq('org_id', options.orgId);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  return (((data as unknown) as SyncJobRow[] | null) ?? []).map(normalizeJobRow);
}

export async function claimSyncJobs(input: {
  provider: IntegrationProviderKey;
  limit?: number;
  lockOwner: string;
}) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.rpc('claim_integration_sync_jobs', {
    p_provider: input.provider,
    p_batch_size: input.limit ?? 10,
    p_lock_owner: input.lockOwner,
  });

  if (error) {
    throw error;
  }

  return (((data as unknown) as SyncJobRow[] | null) ?? []).map(normalizeJobRow);
}

export async function findQueuedSyncJobByDedupeKey(input: {
  orgId: string;
  provider: IntegrationProviderKey;
  dedupeKey: string;
}) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('integration_sync_jobs')
    .select(JOB_SELECT)
    .eq('org_id', input.orgId)
    .eq('provider', input.provider)
    .eq('dedupe_key', input.dedupeKey)
    .in('status', ['pending', 'running', 'retrying'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? normalizeJobRow((data as unknown) as SyncJobRow) : null;
}

export async function listRecentSyncLogs(options: { orgId?: string; limit?: number } = {}) {
  const supabase = createSupabaseServerClient();
  let query = supabase
    .from('integration_sync_logs')
    .select('id, job_id, org_id, provider, level, action, message, context, created_by, created_at')
    .order('created_at', { ascending: false })
    .limit(options.limit ?? 100);

  if (options.orgId) {
    query = query.eq('org_id', options.orgId);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  return ((data as SyncLogRow[] | null) ?? []).map(normalizeLogRow);
}

export async function saveLegacyNajizSyncRun(params: {
  orgId: string;
  userId: string | null;
  endpointPath: string;
  status: 'completed' | 'failed';
  importedCount: number;
  error: string | null;
}) {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from('najiz_sync_runs').insert({
    org_id: params.orgId,
    provider: 'najiz',
    endpoint_path: params.endpointPath,
    status: params.status,
    imported_count: params.importedCount,
    error: params.error,
    created_by: params.userId,
  });

  if (error) {
    throw error;
  }
}
