import 'server-only';

import { getOrgPlanLimits } from '@/lib/plan-limits';
import { logError, logInfo, logWarn } from '@/lib/logger';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { logIntegrationAudit } from '../../audit/integration-audit.service';
import { findMatterExternalCase } from '../../repositories/external-cases.repository';
import { getIntegrationAccount } from '../../repositories/integration-accounts.repository';
import { getMatterReference } from '../../repositories/matters.repository';
import {
  appendSyncLog,
  claimSyncJobs,
  enqueueSyncJob,
  findQueuedSyncJobByDedupeKey,
  updateSyncJob,
} from '../../repositories/sync-job.repository';
import { updateWebhookEvent } from '../../repositories/webhook-events.repository';
import { processNajizDocumentPreparationJob } from '../../jobs/najiz-document-preparation.service';
import { integrationError } from '../errors';
import type {
  IntegrationAccount,
  IntegrationActor,
  IntegrationActorRole,
  JsonObject,
  SyncJobRecord,
  SyncTriggerMode,
} from '../models';
import {
  syncNajizDocuments,
  syncNajizEnforcementRequests,
  syncNajizJudicialCosts,
  syncNajizMatterCase,
  syncNajizSessionMinutes,
} from './najiz-integration.service';

type QueueMatterRefreshInput = {
  actor: IntegrationActor;
  matterId: string;
  caseNumber?: string | null;
  triggerMode?: SyncTriggerMode;
  webhookEventId?: string | null;
  scheduledFor?: string | null;
  request?: Request;
};

type WebhookTarget = {
  matterId: string | null;
  caseNumber: string | null;
  externalCaseId: string | null;
};

export async function enqueueNajizMatterRefresh(input: QueueMatterRefreshInput) {
  const account = await ensureEnterpriseNajizAccount(input.actor.orgId);
  const matter = await getMatterReference(input.actor.orgId, input.matterId);
  if (!matter) {
    throw integrationError('matter_not_found', 'القضية الداخلية غير موجودة.', { statusCode: 404 });
  }

  const caseNumber = normalizeOptionalString(input.caseNumber) ?? matter.najizCaseNumber;
  if (!caseNumber) {
    throw integrationError('missing_case_number', 'أضف رقم القضية في ناجز قبل جدولة التحديث الشامل.', {
      statusCode: 400,
    });
  }

  const dedupeKey = `najiz:matter_refresh:${matter.id}`;
  const existingJob = await findQueuedSyncJobByDedupeKey({
    orgId: input.actor.orgId,
    provider: 'najiz',
    dedupeKey,
  });

  if (existingJob) {
    return { job: existingJob, reused: true };
  }

  const linkedExternalCase = await findMatterExternalCase(input.actor.orgId, matter.id, caseNumber);
  const scheduledFor = normalizeOptionalString(input.scheduledFor);
  const availableAt = scheduledFor ?? new Date().toISOString();

  const job = await enqueueSyncJob({
    orgId: input.actor.orgId,
    integrationId: account.id,
    provider: 'najiz',
    jobKind: 'matter_refresh',
    environment: account.activeEnvironment,
    triggerMode: input.triggerMode ?? 'manual',
    requestedBy: input.actor.userId,
    matterId: matter.id,
    subjectType: 'matter',
    subjectId: matter.id,
    retryable: true,
    maxAttempts: 4,
    queueName: 'najiz.refresh',
    availableAt,
    scheduledFor,
    webhookEventId: input.webhookEventId ?? null,
    dedupeKey,
    requestPayload: {
      matter_id: matter.id,
      case_number: caseNumber,
      external_case_id: linkedExternalCase?.external_id ?? null,
    },
  });

  await appendSyncLog({
    jobId: job.id,
    orgId: input.actor.orgId,
    provider: 'najiz',
    level: 'info',
    action: 'matter_refresh_queued',
    message: 'تمت جدولة تحديث Najiz الشامل في الخلفية.',
    context: {
      matter_id: matter.id,
      case_number: caseNumber,
      trigger_mode: input.triggerMode ?? 'manual',
    },
    createdBy: input.actor.userId,
  });

  await logIntegrationAudit({
    actor: input.actor,
    action: 'najiz.matter_refresh_queued',
    entityType: 'matter',
    entityId: matter.id,
    meta: {
      case_number: caseNumber,
      scheduled_for: scheduledFor,
      trigger_mode: input.triggerMode ?? 'manual',
    },
    request: input.request,
  });

  return { job, reused: false };
}

export async function enqueueNajizMatterRefreshForSystem(input: {
  orgId: string;
  matterId: string;
  caseNumber?: string | null;
  triggerMode?: SyncTriggerMode;
  webhookEventId?: string | null;
  preferredUserId?: string | null;
  scheduledFor?: string | null;
}) {
  const actor = await resolveExecutionActor(input.orgId, input.preferredUserId);
  return enqueueNajizMatterRefresh({
    actor,
    matterId: input.matterId,
    caseNumber: input.caseNumber,
    triggerMode: input.triggerMode,
    webhookEventId: input.webhookEventId,
    scheduledFor: input.scheduledFor,
  });
}

export async function processQueuedNajizSyncJobs(input: { limit?: number; lockOwner: string }) {
  const jobs = await claimSyncJobs({
    provider: 'najiz',
    limit: input.limit ?? 10,
    lockOwner: input.lockOwner,
  });

  let succeeded = 0;
  let failed = 0;
  let partial = 0;
  let retried = 0;

  for (const job of jobs) {
    const processed = await processQueuedNajizJob(job).catch(async (error) => {
      failed += 1;
      await failClaimedJobUnexpectedly(job, error);
      logError('najiz_queue_processor_unhandled_error', {
        job_id: job.id,
        org_id: job.orgId,
        message: error instanceof Error ? error.message : 'unknown_error',
      });
      return null;
    });

    if (!processed) {
      continue;
    }

    if (processed.status === 'succeeded') {
      succeeded += 1;
    } else if (processed.status === 'retrying') {
      retried += 1;
    } else if (processed.status === 'partial') {
      partial += 1;
    } else if (processed.status === 'failed') {
      failed += 1;
    }
  }

  return {
    claimed: jobs.length,
    succeeded,
    partial,
    retried,
    failed,
  };
}

export async function resolveNajizWebhookTarget(orgId: string, payload: JsonObject) {
  const supabase = createSupabaseServerClient();
  const target = extractWebhookTarget(payload);

  if (target.matterId) {
    const matter = await getMatterReference(orgId, target.matterId);
    if (matter) {
      return {
        ...target,
        matterId: matter.id,
        caseNumber: target.caseNumber ?? matter.najizCaseNumber,
      } satisfies WebhookTarget;
    }
  }

  if (target.caseNumber) {
    const { data, error } = await supabase
      .from('matters')
      .select('id, najiz_case_number')
      .eq('org_id', orgId)
      .eq('najiz_case_number', target.caseNumber)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (data?.id) {
      return {
        ...target,
        matterId: String(data.id),
        caseNumber: String((data as { najiz_case_number?: string | null }).najiz_case_number ?? target.caseNumber),
      } satisfies WebhookTarget;
    }
  }

  if (target.externalCaseId) {
    const { data, error } = await supabase
      .from('external_cases')
      .select('matter_id, case_number')
      .eq('org_id', orgId)
      .eq('external_id', target.externalCaseId)
      .order('synced_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (data?.matter_id) {
      return {
        matterId: String(data.matter_id),
        caseNumber: normalizeOptionalString((data as { case_number?: string | null }).case_number) ?? target.caseNumber,
        externalCaseId: target.externalCaseId,
      } satisfies WebhookTarget;
    }
  }

  return target;
}

async function processQueuedNajizJob(job: SyncJobRecord) {
  switch (job.jobKind) {
    case 'matter_refresh':
      return processMatterRefreshJob(job);
    case 'document_prepare':
      return processNajizDocumentPreparationJob(job);
    default:
      await updateSyncJob(job.id, {
        status: 'partial',
        completedAt: new Date().toISOString(),
        errorMessage: `unsupported_job_kind:${job.jobKind}`,
        lockedAt: null,
        lockedBy: null,
      });
      return null;
  }
}

async function processMatterRefreshJob(job: SyncJobRecord) {
  const actor = await resolveExecutionActor(job.orgId, job.requestedBy);
  const matterId = normalizeOptionalString(job.matterId) ?? normalizeOptionalString(job.subjectId);
  if (!matterId) {
    throw new Error('missing_matter_id');
  }

  if (job.webhookEventId) {
    await updateWebhookEvent(job.webhookEventId, {
      status: 'processing',
      errorMessage: null,
    });
  }

  const requestedCaseNumber = normalizeOptionalString(stringFromJson(job.requestPayload.case_number));
  const stepFailures: Array<{ step: string; message: string }> = [];
  const childJobs: string[] = [];
  const summary: JsonObject = {
    matter_id: matterId,
    case_number: requestedCaseNumber,
  };

  const runStep = async <T extends { job?: { id: string } }>(step: string, executor: () => Promise<T>, capture: (result: T) => JsonObject) => {
    try {
      const result = await executor();
      if (result.job?.id) {
        childJobs.push(result.job.id);
        await updateSyncJob(result.job.id, {
          parentJobId: job.id,
          webhookEventId: job.webhookEventId ?? undefined,
        });
      }
      Object.assign(summary, capture(result));
    } catch (error) {
      const message = error instanceof Error ? error.message : `failed_${step}`;
      stepFailures.push({ step, message });
      logWarn('najiz_matter_refresh_step_failed', {
        job_id: job.id,
        org_id: job.orgId,
        matter_id: matterId,
        step,
        message,
      });
    }
  };

  await runStep(
    'case_sync',
    () =>
      syncNajizMatterCase({
        actor,
        matterId,
        caseNumber: requestedCaseNumber,
      }),
    (result) => ({
      case_count: result.cases.length,
      case_event_count: result.events.length,
    }),
  );

  await runStep(
    'judicial_cost_sync',
    () =>
      syncNajizJudicialCosts({
        actor,
        matterId,
        caseNumber: requestedCaseNumber,
      }),
    (result) => ({
      judicial_cost_count: result.costs.length,
    }),
  );

  await runStep(
    'enforcement_request_sync',
    () =>
      syncNajizEnforcementRequests({
        actor,
        matterId,
        caseNumber: requestedCaseNumber,
      }),
    (result) => ({
      enforcement_request_count: result.requests.length,
      enforcement_event_count: result.events.length,
    }),
  );

  await runStep(
    'document_sync',
    () =>
      syncNajizDocuments({
        actor,
        matterId,
        caseNumber: requestedCaseNumber,
      }),
    (result) => ({
      document_count: result.documents.length,
    }),
  );

  await runStep(
    'session_minutes_sync',
    () =>
      syncNajizSessionMinutes({
        actor,
        matterId,
        caseNumber: requestedCaseNumber,
      }),
    (result) => ({
      session_minute_count: result.minutes.length,
    }),
  );

  summary.child_job_ids = childJobs;
  summary.failed_steps = stepFailures.map((failure) => ({
    step: failure.step,
    message: failure.message,
  }));

  if (!stepFailures.length) {
    const updated = await updateSyncJob(job.id, {
      status: 'succeeded',
      completedAt: new Date().toISOString(),
      summary,
      errorMessage: null,
      responsePayload: summary,
      availableAt: null,
      lockedAt: null,
      lockedBy: null,
    });

    await appendSyncLog({
      jobId: job.id,
      orgId: job.orgId,
      provider: 'najiz',
      level: 'info',
      action: 'matter_refresh_completed',
      message: 'اكتمل تحديث Najiz الشامل بنجاح.',
      context: summary,
      createdBy: actor.userId,
    });

    if (job.webhookEventId) {
      await updateWebhookEvent(job.webhookEventId, {
        status: 'processed',
        processedAt: new Date().toISOString(),
        errorMessage: null,
      });
    }

    logInfo('najiz_matter_refresh_completed', {
      job_id: job.id,
      org_id: job.orgId,
      matter_id: matterId,
      child_job_count: childJobs.length,
    });

    return updated;
  }

  const retryable = job.retryable && job.attempts < job.maxAttempts && stepFailures.some((failure) => isRetryableMessage(failure.message));
  const firstError = stepFailures[0]?.message ?? 'najiz_matter_refresh_failed';

  if (retryable) {
    const updated = await updateSyncJob(job.id, {
      status: 'retrying',
      attempts: job.attempts + 1,
      errorMessage: firstError,
      summary,
      responsePayload: summary,
      availableAt: nextRetryAt(job.attempts),
      lockedAt: null,
      lockedBy: null,
    });

    await appendSyncLog({
      jobId: job.id,
      orgId: job.orgId,
      provider: 'najiz',
      level: 'warn',
      action: 'matter_refresh_retry_scheduled',
      message: 'تمت جدولة إعادة المحاولة لتحديث Najiz الشامل.',
      context: summary,
      createdBy: actor.userId,
    });

    if (job.webhookEventId) {
      await updateWebhookEvent(job.webhookEventId, {
        status: 'pending',
        errorMessage: firstError,
      });
    }

    return updated;
  }

  const finalStatus = childJobs.length ? 'partial' : 'failed';
  const updated = await updateSyncJob(job.id, {
    status: finalStatus,
    completedAt: new Date().toISOString(),
    errorMessage: firstError,
    summary,
    responsePayload: summary,
    availableAt: null,
    lockedAt: null,
    lockedBy: null,
  });

  await appendSyncLog({
    jobId: job.id,
    orgId: job.orgId,
    provider: 'najiz',
    level: finalStatus === 'partial' ? 'warn' : 'error',
    action: 'matter_refresh_failed',
    message: firstError,
    context: summary,
    createdBy: actor.userId,
  });

  if (job.webhookEventId) {
    await updateWebhookEvent(job.webhookEventId, {
      status: 'failed',
      processedAt: new Date().toISOString(),
      errorMessage: firstError,
    });
  }

  return updated;
}

async function ensureEnterpriseNajizAccount(orgId: string): Promise<IntegrationAccount> {
  const { limits, plan } = await getOrgPlanLimits(orgId);
  if (!limits.najiz_integration) {
    throw integrationError('enterprise_plan_required', 'تكاملات ناجز متاحة فقط لنسخة الشركات.', {
      statusCode: 403,
      details: { plan },
    });
  }

  const account = await getIntegrationAccount(orgId, 'najiz');
  if (!account) {
    throw integrationError('integration_not_configured', 'حساب Najiz غير مهيأ لهذا المكتب.', {
      statusCode: 400,
    });
  }

  const environmentConfig = account.environments[account.activeEnvironment];
  const credentials = account.credentials[account.activeEnvironment];
  if (!environmentConfig.useMock && (!credentials?.clientId || !credentials.clientSecret)) {
    throw integrationError('integration_not_configured', 'بيانات Najiz غير مكتملة لهذه البيئة.', {
      statusCode: 400,
    });
  }

  return account;
}

async function resolveExecutionActor(orgId: string, preferredUserId?: string | null): Promise<IntegrationActor> {
  const supabase = createSupabaseServerClient();
  const preferred = normalizeOptionalString(preferredUserId);

  if (preferred) {
    const { data, error } = await supabase
      .from('memberships')
      .select('user_id, role')
      .eq('org_id', orgId)
      .eq('user_id', preferred)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (data?.user_id && isSupportedActorRole((data as { role?: string | null }).role)) {
      return {
        userId: String(data.user_id),
        orgId,
        role: (data as { role: IntegrationActorRole }).role,
        isAppAdmin: false,
      };
    }
  }

  const { data: owners, error: ownerError } = await supabase
    .from('memberships')
    .select('user_id, role')
    .eq('org_id', orgId)
    .eq('role', 'owner')
    .limit(1);

  if (ownerError) {
    throw ownerError;
  }

  const owner = (owners as Array<{ user_id: string; role: IntegrationActorRole }> | null)?.[0];
  if (owner?.user_id) {
    return {
      userId: owner.user_id,
      orgId,
      role: owner.role,
      isAppAdmin: false,
    };
  }

  const { data: fallback, error: fallbackError } = await supabase
    .from('memberships')
    .select('user_id, role')
    .eq('org_id', orgId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (fallbackError) {
    throw fallbackError;
  }

  if (fallback?.user_id && isSupportedActorRole((fallback as { role?: string | null }).role)) {
    return {
      userId: String(fallback.user_id),
      orgId,
      role: (fallback as { role: IntegrationActorRole }).role,
      isAppAdmin: false,
    };
  }

  throw integrationError('integration_executor_not_found', 'تعذر تحديد مستخدم صالح لتنفيذ مزامنة Najiz الخلفية.', {
    statusCode: 500,
  });
}

function extractWebhookTarget(payload: JsonObject): WebhookTarget {
  const candidates = [
    payload,
    ensureObject(payload.data),
    ensureObject(payload.case),
    ensureObject(payload.entity),
  ];

  for (const candidate of candidates) {
    const matterId = pickString(candidate, ['matter_id', 'matterId']);
    const caseNumber = pickString(candidate, ['case_number', 'caseNumber', 'reference']);
    const externalCaseId = pickString(candidate, ['external_case_id', 'externalCaseId', 'case_id', 'caseId']);
    if (matterId || caseNumber || externalCaseId) {
      return {
        matterId: matterId ?? null,
        caseNumber: caseNumber ?? null,
        externalCaseId: externalCaseId ?? null,
      };
    }
  }

  return {
    matterId: null,
    caseNumber: null,
    externalCaseId: null,
  };
}

function ensureObject(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonObject) : {};
}

function pickString(source: JsonObject, keys: string[]) {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function stringFromJson(value: unknown) {
  return typeof value === 'string' ? value : null;
}

function isSupportedActorRole(role: unknown): role is IntegrationActorRole {
  return role === 'owner' || role === 'lawyer' || role === 'assistant' || role === 'admin';
}

function isRetryableMessage(message: string) {
  const normalized = message.toLowerCase();
  return normalized.includes('timeout') || normalized.includes('rate limit') || normalized.includes('temporar');
}

function nextRetryAt(attempt: number) {
  const delayMs = Math.min(15 * 60 * 1000, Math.max(30_000, 60_000 * 2 ** Math.max(0, attempt - 1)));
  return new Date(Date.now() + delayMs).toISOString();
}

function normalizeOptionalString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

async function failClaimedJobUnexpectedly(job: SyncJobRecord, error: unknown) {
  const message = error instanceof Error ? error.message : 'najiz_queue_job_failed';

  await updateSyncJob(job.id, {
    status: 'failed',
    completedAt: new Date().toISOString(),
    errorMessage: message,
    lockedAt: null,
    lockedBy: null,
  }).catch(() => undefined);

  await appendSyncLog({
    jobId: job.id,
    orgId: job.orgId,
    provider: 'najiz',
    level: 'error',
    action: 'matter_refresh_failed_unexpectedly',
    message,
    createdBy: job.requestedBy,
  }).catch(() => undefined);

  if (job.webhookEventId) {
    await updateWebhookEvent(job.webhookEventId, {
      status: 'failed',
      processedAt: new Date().toISOString(),
      errorMessage: message,
    }).catch(() => undefined);
  }
}
