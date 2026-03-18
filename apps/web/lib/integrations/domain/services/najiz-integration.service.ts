import 'server-only';

import { getOrgPlanLimits } from '@/lib/plan-limits';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { logError, logInfo } from '@/lib/logger';
import { logIntegrationAudit } from '../../audit/integration-audit.service';
import { withRetry } from '../../jobs/retry';
import { getIntegrationProvider } from '../../providers/provider-registry';
import { integrationError } from '../errors';
import type {
  IntegrationActor,
  IntegrationAccount,
  IntegrationEnvironment,
  JsonObject,
  SyncCaseResult,
  SyncJobKind,
} from '../models';
import {
  createEmptyIntegrationAccount,
  setAccountHealth,
  setEnvironmentConfig,
  setEnvironmentCredentials,
} from './account-config.service';
import { getIntegrationAccount, saveIntegrationAccount } from '../../repositories/integration-accounts.repository';
import {
  appendSyncLog,
  createSyncJob,
  listRecentSyncJobs,
  saveLegacyNajizSyncRun,
  updateSyncJob,
} from '../../repositories/sync-job.repository';
import {
  findMatterExternalCase,
  listMatterExternalCaseOverview,
  upsertExternalCaseEvents,
  upsertExternalCases,
} from '../../repositories/external-cases.repository';
import {
  listMatterExternalDocuments,
  upsertExternalDocuments,
} from '../../repositories/external-documents.repository';
import { appendMatterTimelineEvents, getMatterReference, updateMatterNajizCaseNumber } from '../../repositories/matters.repository';
import {
  listMatterEnforcementRequests,
  upsertEnforcementRequestEvents,
  upsertEnforcementRequests,
} from '../../repositories/enforcement-requests.repository';
import { upsertLawyerVerification } from '../../repositories/lawyer-verifications.repository';
import { listMatterJudicialCosts, upsertJudicialCosts } from '../../repositories/judicial-costs.repository';
import { createIntegrationNotification } from '../../repositories/notifications.repository';
import { listMatterSessionMinutes, upsertSessionMinutes } from '../../repositories/session-minutes.repository';
import { queueNajizDocumentPreparationJobs } from '../../jobs/najiz-document-preparation.service';
import { runNajizSmartActions } from '../../jobs/najiz-smart-actions.service';

type SaveNajizSettingsInput = {
  actor: IntegrationActor;
  environment: IntegrationEnvironment;
  baseUrl: string;
  clientId?: string | null;
  clientSecret?: string | null;
  scope?: string | null;
  tokenPath?: string | null;
  healthPath?: string | null;
  syncPaths?: {
    cases?: string | null;
    lawyerVerification?: string | null;
    judicialCosts?: string | null;
    enforcementRequests?: string | null;
    documents?: string | null;
    sessionMinutes?: string | null;
  };
  useMock?: boolean;
  request?: Request;
};

function shouldRetry(error: unknown) {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const candidate = error as { retryable?: unknown; message?: unknown };
  if (candidate.retryable === true) {
    return true;
  }

  const message = typeof candidate.message === 'string' ? candidate.message.toLowerCase() : '';
  return message.includes('timeout') || message.includes('rate limit');
}

async function ensureAccount(actor: IntegrationActor) {
  const { limits, plan } = await getOrgPlanLimits(actor.orgId);
  if (!limits.najiz_integration) {
    throw integrationError('enterprise_plan_required', 'تكاملات ناجز متاحة فقط لنسخة الشركات.', {
      statusCode: 403,
      details: { plan },
    });
  }

  return (await getIntegrationAccount(actor.orgId, 'najiz')) ?? createEmptyIntegrationAccount(actor.orgId);
}

function getActiveEnvironmentCredentials(account: IntegrationAccount) {
  const environmentConfig = account.environments[account.activeEnvironment];
  const credentials = account.credentials[account.activeEnvironment];
  if (!environmentConfig.useMock && (!credentials?.clientId || !credentials.clientSecret)) {
    throw integrationError('integration_not_configured', 'بيانات Najiz غير مكتملة لهذه البيئة.', {
      statusCode: 400,
    });
  }
}

export async function saveNajizIntegrationSettings(input: SaveNajizSettingsInput) {
  const account = await ensureAccount(input.actor);
  account.createdBy = account.createdBy ?? input.actor.userId;
  account.updatedBy = input.actor.userId;
  account.activeEnvironment = input.environment;

  setEnvironmentConfig(account, input.environment, {
    baseUrl: input.baseUrl.trim().replace(/\/+$/, ''),
    tokenPath: normalizeOptionalString(input.tokenPath),
    healthPath: normalizeOptionalString(input.healthPath),
    syncPaths: {
      cases: normalizeOptionalString(input.syncPaths?.cases),
      lawyerVerification: normalizeOptionalString(input.syncPaths?.lawyerVerification),
      judicialCosts: normalizeOptionalString(input.syncPaths?.judicialCosts),
      enforcementRequests: normalizeOptionalString(input.syncPaths?.enforcementRequests),
      documents: normalizeOptionalString(input.syncPaths?.documents),
      sessionMinutes: normalizeOptionalString(input.syncPaths?.sessionMinutes),
    },
    useMock: input.useMock === true,
    lastError: null,
  });

  if (input.clientId?.trim() || input.clientSecret?.trim() || input.scope !== undefined) {
    setEnvironmentCredentials(account, input.environment, {
      clientId: normalizeOptionalString(input.clientId) ?? undefined,
      clientSecret: normalizeOptionalString(input.clientSecret) ?? undefined,
      scope: normalizeOptionalString(input.scope),
    });
  }

  getActiveEnvironmentCredentials(account);
  setAccountHealth(account, {
    status: 'disconnected',
    healthStatus: 'not_configured',
    lastHealthError: null,
  });

  const saved = await saveIntegrationAccount(account, input.actor.userId);
  if (!saved) {
    throw integrationError('integration_save_failed', 'تعذر حفظ إعدادات Najiz.', { statusCode: 500 });
  }

  const health = await testNajizHealth({
    actor: input.actor,
    request: input.request,
    skipAudit: true,
  });

  await logIntegrationAudit({
    actor: input.actor,
    action: 'najiz.settings_saved',
    entityType: 'integration_account',
    entityId: saved.id,
    meta: {
      environment: input.environment,
      has_client_id: Boolean(input.clientId?.trim()),
      has_client_secret: Boolean(input.clientSecret?.trim()),
    },
    request: input.request,
  });

  return {
    account: health.account,
    health: health.health,
  };
}

export async function disconnectNajizIntegration(input: { actor: IntegrationActor; request?: Request }) {
  const account = await ensureAccount(input.actor);
  account.credentials = {};
  account.hasCredentials = false;
  account.status = 'disconnected';
  account.healthStatus = 'not_configured';
  account.lastHealthError = null;

  for (const environment of ['sandbox', 'production'] as const) {
    setEnvironmentConfig(account, environment, {
      lastError: null,
      lastTestedAt: null,
      lastConnectedAt: null,
    });
  }

  await saveIntegrationAccount(account, input.actor.userId);
  await logIntegrationAudit({
    actor: input.actor,
    action: 'najiz.disconnected',
    entityType: 'integration_account',
    entityId: account.id,
    request: input.request,
  });
}

export async function testNajizHealth(input: {
  actor: IntegrationActor;
  request?: Request;
  skipAudit?: boolean;
}) {
  const account = await ensureConfiguredAccount(input.actor);
  const provider = getIntegrationProvider(account);
  const job = await createSyncJob({
    orgId: input.actor.orgId,
    integrationId: account.id,
    provider: 'najiz',
    jobKind: 'health_check',
    environment: account.activeEnvironment,
    requestedBy: input.actor.userId,
    subjectType: 'environment',
    subjectId: account.activeEnvironment,
    requestPayload: {
      environment: account.activeEnvironment,
    },
  });

  await appendSyncLog({
    jobId: job.id,
    orgId: input.actor.orgId,
    provider: 'najiz',
    level: 'info',
    action: 'health_check_started',
    message: 'بدأ فحص صحة اتصال Najiz.',
    createdBy: input.actor.userId,
  });

  try {
    const health = await withRetry(
      () => provider.getHealthStatus({ actor: input.actor, account }),
      {
        label: 'najiz_health_check',
        attempts: 2,
        shouldRetry,
      },
    );

    setEnvironmentConfig(account, account.activeEnvironment, {
      lastError: null,
      lastTestedAt: health.checkedAt,
      lastConnectedAt: health.ok ? health.checkedAt : account.environments[account.activeEnvironment].lastConnectedAt,
    });
    setAccountHealth(account, {
      status: health.ok ? 'connected' : 'error',
      healthStatus: health.status,
      lastHealthCheckedAt: health.checkedAt,
      lastHealthError: health.ok ? null : health.message,
    });

    const savedAccount = await saveIntegrationAccount(account, input.actor.userId);
    const updatedJob = await updateSyncJob(job.id, {
      status: 'succeeded',
      completedAt: new Date().toISOString(),
      summary: {
        ok: health.ok,
        status: health.status,
      },
      responsePayload: {
        checked_at: health.checkedAt,
        message: health.message,
        ...(health.meta ?? {}),
      },
    });

    await appendSyncLog({
      jobId: updatedJob.id,
      orgId: input.actor.orgId,
      provider: 'najiz',
      level: 'info',
      action: 'health_check_completed',
      message: health.message,
      context: { status: health.status },
      createdBy: input.actor.userId,
    });

    if (!input.skipAudit) {
      await logIntegrationAudit({
        actor: input.actor,
        action: 'najiz.health_checked',
        entityType: 'integration_account',
        entityId: savedAccount?.id,
        meta: {
          status: health.status,
          ok: health.ok,
        },
        request: input.request,
      });
    }

    return {
      account: savedAccount ?? account,
      health,
      job: updatedJob,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'تعذر اختبار اتصال Najiz.';
    setEnvironmentConfig(account, account.activeEnvironment, {
      lastError: message,
      lastTestedAt: new Date().toISOString(),
    });
    setAccountHealth(account, {
      status: 'error',
      healthStatus: 'degraded',
      lastHealthCheckedAt: new Date().toISOString(),
      lastHealthError: message,
    });
    await saveIntegrationAccount(account, input.actor.userId);
    await updateSyncJob(job.id, {
      status: 'failed',
      completedAt: new Date().toISOString(),
      errorMessage: message,
      summary: {
        ok: false,
      },
    });
    await appendSyncLog({
      jobId: job.id,
      orgId: input.actor.orgId,
      provider: 'najiz',
      level: 'error',
      action: 'health_check_failed',
      message,
      createdBy: input.actor.userId,
    });
    throw error;
  }
}

export async function verifyNajizLawyer(input: {
  actor: IntegrationActor;
  lawyerUserId?: string | null;
  licenseNumber?: string | null;
  nationalId?: string | null;
  endpointPath?: string | null;
  request?: Request;
}) {
  const account = await ensureConfiguredAccount(input.actor);
  const provider = getIntegrationProvider(account);
  const lawyerUserId = normalizeOptionalString(input.lawyerUserId) ?? input.actor.userId;
  const licenseNumber =
    normalizeOptionalString(input.licenseNumber) ?? (lawyerUserId ? await getUserLicenseNumber(lawyerUserId) : null);
  const nationalId = normalizeOptionalString(input.nationalId);

  if (!licenseNumber && !nationalId) {
    throw integrationError('missing_license_number', 'رقم الرخصة أو الهوية مطلوب للتحقق من المحامي.', {
      statusCode: 400,
    });
  }

  const job = await createSyncJob({
    orgId: input.actor.orgId,
    integrationId: account.id,
    provider: 'najiz',
    jobKind: 'lawyer_verification',
    environment: account.activeEnvironment,
    requestedBy: input.actor.userId,
    subjectType: 'lawyer_user',
    subjectId: lawyerUserId,
    requestPayload: {
      license_number: licenseNumber,
      national_id: nationalId,
    },
  });

  await appendSyncLog({
    jobId: job.id,
    orgId: input.actor.orgId,
    provider: 'najiz',
    level: 'info',
    action: 'lawyer_verification_started',
    message: 'بدأ التحقق من المحامي عبر Najiz.',
    createdBy: input.actor.userId,
  });

  try {
    const result = await withRetry(
      () =>
        provider.verifyLawyer(
          {
            lawyerUserId,
            licenseNumber,
            nationalId,
            endpointPath: normalizeOptionalString(input.endpointPath),
          },
          { actor: input.actor, account },
        ),
      {
        label: 'najiz_verify_lawyer',
        attempts: 2,
        shouldRetry,
      },
    );

    await upsertLawyerVerification({
      orgId: input.actor.orgId,
      lawyerUserId,
      requestedBy: input.actor.userId,
      syncJobId: job.id,
      verification: result.verification,
    });

    const updatedJob = await updateSyncJob(job.id, {
      status: result.verification.status === 'verified' ? 'succeeded' : 'partial',
      completedAt: new Date().toISOString(),
      summary: {
        verification_status: result.verification.status,
        external_id: result.verification.externalId,
      },
      responsePayload: result.rawPayload,
    });

    await appendSyncLog({
      jobId: updatedJob.id,
      orgId: input.actor.orgId,
      provider: 'najiz',
      level: result.verification.status === 'verified' ? 'info' : 'warn',
      action: 'lawyer_verification_completed',
      message: `اكتمل التحقق من المحامي بحالة ${result.verification.status}.`,
      context: {
        external_id: result.verification.externalId,
      },
      createdBy: input.actor.userId,
    });

    await logIntegrationAudit({
      actor: input.actor,
      action: 'najiz.lawyer_verified',
      entityType: 'lawyer_verification',
      entityId: result.verification.externalId,
      meta: {
        status: result.verification.status,
        lawyer_user_id: lawyerUserId,
      },
      request: input.request,
    });

    return {
      job: updatedJob,
      ...result,
    };
  } catch (error) {
    await handleJobFailure({
      actor: input.actor,
      account,
      jobId: job.id,
      jobKind: 'lawyer_verification',
      message: error instanceof Error ? error.message : 'تعذر التحقق من المحامي.',
      request: input.request,
    });
    throw error;
  }
}

export async function syncNajizCaseCatalog(input: {
  actor: IntegrationActor;
  endpointPath?: string | null;
  request?: Request;
}) {
  const account = await ensureConfiguredAccount(input.actor);
  const provider = getIntegrationProvider(account);
  const endpointPath =
    normalizeOptionalString(input.endpointPath) ??
    account.environments[account.activeEnvironment].syncPaths.cases ??
    null;

  if (!endpointPath) {
    throw integrationError('missing_case_sync_path', 'حدد مسار Endpoint لمزامنة القضايا أولاً.', {
      statusCode: 400,
    });
  }

  const job = await createSyncJob({
    orgId: input.actor.orgId,
    integrationId: account.id,
    provider: 'najiz',
    jobKind: 'case_sync',
    environment: account.activeEnvironment,
    requestedBy: input.actor.userId,
    subjectType: 'endpoint_path',
    subjectId: endpointPath,
    requestPayload: {
      endpoint_path: endpointPath,
    },
  });

  await appendSyncLog({
    jobId: job.id,
    orgId: input.actor.orgId,
    provider: 'najiz',
    level: 'info',
    action: 'case_sync_started',
    message: 'بدأت مزامنة القضايا العامة من Najiz.',
    createdBy: input.actor.userId,
  });

  try {
    const result = await runCaseSync({
      actor: input.actor,
      account,
      provider,
      endpointPath,
      matterId: null,
      caseNumber: null,
    });

    setEnvironmentConfig(account, account.activeEnvironment, {
      syncPaths: { cases: endpointPath },
    });
    setAccountHealth(account, {
      status: 'connected',
      healthStatus: 'healthy',
      lastSyncedAt: new Date().toISOString(),
      lastHealthError: null,
    });

    const savedAccount = await saveIntegrationAccount(account, input.actor.userId);
    const updatedJob = await updateSyncJob(job.id, {
      status: 'succeeded',
      completedAt: new Date().toISOString(),
      summary: {
        imported_count: result.cases.length,
        event_count: result.events.length,
      },
      responsePayload: result.rawPayload,
    });

    await appendSyncLog({
      jobId: updatedJob.id,
      orgId: input.actor.orgId,
      provider: 'najiz',
      level: 'info',
      action: 'case_sync_completed',
      message: `اكتملت مزامنة ${result.cases.length} قضية.`,
      context: { imported_count: result.cases.length },
      createdBy: input.actor.userId,
    });

    await saveLegacyNajizSyncRun({
      orgId: input.actor.orgId,
      userId: input.actor.userId,
      endpointPath,
      status: 'completed',
      importedCount: result.cases.length,
      error: null,
    });

    await logIntegrationAudit({
      actor: input.actor,
      action: 'najiz.case_catalog_synced',
      entityType: 'external_case',
      meta: {
        imported_count: result.cases.length,
        endpoint_path: endpointPath,
      },
      request: input.request,
    });

    return {
      account: savedAccount ?? account,
      job: updatedJob,
      ...result,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'تعذر مزامنة القضايا.';
    await saveLegacyNajizSyncRun({
      orgId: input.actor.orgId,
      userId: input.actor.userId,
      endpointPath,
      status: 'failed',
      importedCount: 0,
      error: message,
    });
    await handleJobFailure({
      actor: input.actor,
      account,
      jobId: job.id,
      jobKind: 'case_sync',
      message,
      request: input.request,
    });
    throw error;
  }
}

export async function syncNajizMatterCase(input: {
  actor: IntegrationActor;
  matterId: string;
  caseNumber?: string | null;
  endpointPath?: string | null;
  request?: Request;
}) {
  const account = await ensureConfiguredAccount(input.actor);
  const provider = getIntegrationProvider(account);
  const matter = await getMatterReference(input.actor.orgId, input.matterId);
  if (!matter) {
    throw integrationError('matter_not_found', 'القضية الداخلية غير موجودة.', { statusCode: 404 });
  }

  const caseNumber = normalizeOptionalString(input.caseNumber) ?? matter.najizCaseNumber;
  if (!caseNumber) {
    throw integrationError('missing_case_number', 'أضف رقم القضية في ناجز قبل بدء المزامنة.', {
      statusCode: 400,
    });
  }

  const job = await createSyncJob({
    orgId: input.actor.orgId,
    integrationId: account.id,
    provider: 'najiz',
    jobKind: 'case_sync',
    environment: account.activeEnvironment,
    requestedBy: input.actor.userId,
    matterId: matter.id,
    subjectType: 'matter',
    subjectId: matter.id,
    requestPayload: {
      matter_id: matter.id,
      case_number: caseNumber,
      endpoint_path: normalizeOptionalString(input.endpointPath),
    },
  });

  try {
    const result = await runCaseSync({
      actor: input.actor,
      account,
      provider,
      endpointPath: normalizeOptionalString(input.endpointPath),
      matterId: matter.id,
      caseNumber,
    });

    const primaryCase = result.cases[0] ?? null;
    if (primaryCase?.caseNumber && primaryCase.caseNumber !== matter.najizCaseNumber) {
      await updateMatterNajizCaseNumber(input.actor.orgId, matter.id, primaryCase.caseNumber);
    }

    setAccountHealth(account, {
      status: 'connected',
      healthStatus: 'healthy',
      lastSyncedAt: new Date().toISOString(),
      lastHealthError: null,
    });
    await saveIntegrationAccount(account, input.actor.userId);

    const updatedJob = await updateSyncJob(job.id, {
      status: 'succeeded',
      completedAt: new Date().toISOString(),
      summary: {
        imported_count: result.cases.length,
        event_count: result.events.length,
        matter_id: matter.id,
      },
      responsePayload: result.rawPayload,
    });

    await logIntegrationAudit({
      actor: input.actor,
      action: 'najiz.case_synced',
      entityType: 'matter',
      entityId: matter.id,
      meta: {
        imported_count: result.cases.length,
        event_count: result.events.length,
      },
      request: input.request,
    });

    return {
      job: updatedJob,
      matter,
      ...result,
    };
  } catch (error) {
    await handleJobFailure({
      actor: input.actor,
      account,
      jobId: job.id,
      jobKind: 'case_sync',
      message: error instanceof Error ? error.message : 'تعذر مزامنة القضية.',
      request: input.request,
      matterId: input.matterId,
    });
    throw error;
  }
}

export async function syncNajizJudicialCosts(input: {
  actor: IntegrationActor;
  matterId?: string | null;
  caseNumber?: string | null;
  externalCaseId?: string | null;
  endpointPath?: string | null;
  request?: Request;
}) {
  const account = await ensureConfiguredAccount(input.actor);
  const provider = getIntegrationProvider(account);
  const matterId = normalizeOptionalString(input.matterId);
  const matter = matterId ? await getMatterReference(input.actor.orgId, matterId) : null;
  const linkedExternalCase = matterId
    ? await findMatterExternalCase(input.actor.orgId, matterId, matter?.najizCaseNumber)
    : null;

  const caseNumber =
    normalizeOptionalString(input.caseNumber) ??
    linkedExternalCase?.case_number ??
    matter?.najizCaseNumber ??
    null;

  if (!caseNumber) {
    throw integrationError('missing_case_number', 'رقم القضية مطلوب لمزامنة التكاليف القضائية.', {
      statusCode: 400,
    });
  }

  const job = await createSyncJob({
    orgId: input.actor.orgId,
    integrationId: account.id,
    provider: 'najiz',
    jobKind: 'judicial_cost_sync',
    environment: account.activeEnvironment,
    requestedBy: input.actor.userId,
    matterId: matterId ?? null,
    subjectType: matterId ? 'matter' : 'case_number',
    subjectId: matterId ?? caseNumber,
    requestPayload: {
      matter_id: matterId,
      case_number: caseNumber,
      endpoint_path: normalizeOptionalString(input.endpointPath),
    },
  });

  try {
    const result = await withRetry(
      () =>
        provider.syncJudicialCosts(
          {
            matterId,
            caseNumber,
            endpointPath: normalizeOptionalString(input.endpointPath),
          },
          { actor: input.actor, account },
        ),
      {
        label: 'najiz_sync_judicial_costs',
        attempts: 2,
        shouldRetry,
      },
    );

    const costs = await upsertJudicialCosts({
      orgId: input.actor.orgId,
      matterId,
      syncJobId: job.id,
      externalCaseDbId: linkedExternalCase?.id ?? null,
      costs: result.costs,
    });

    await runNajizSmartActions({
      orgId: input.actor.orgId,
      actorUserId: input.actor.userId,
      matter,
      judicialCosts: result.costs,
    });

    setAccountHealth(account, {
      status: 'connected',
      healthStatus: 'healthy',
      lastSyncedAt: new Date().toISOString(),
      lastHealthError: null,
    });
    await saveIntegrationAccount(account, input.actor.userId);

    const updatedJob = await updateSyncJob(job.id, {
      status: 'succeeded',
      completedAt: new Date().toISOString(),
      summary: {
        imported_count: costs.length,
      },
      responsePayload: result.rawPayload,
    });

    await logIntegrationAudit({
      actor: input.actor,
      action: 'najiz.judicial_costs_synced',
      entityType: 'judicial_cost',
      meta: {
        imported_count: costs.length,
        matter_id: matterId,
        case_number: caseNumber,
      },
      request: input.request,
    });

    return {
      job: updatedJob,
      ...result,
    };
  } catch (error) {
    await handleJobFailure({
      actor: input.actor,
      account,
      jobId: job.id,
      jobKind: 'judicial_cost_sync',
      message: error instanceof Error ? error.message : 'تعذر مزامنة التكاليف القضائية.',
      request: input.request,
      matterId: matterId ?? undefined,
    });
    throw error;
  }
}

export async function syncNajizEnforcementRequests(input: {
  actor: IntegrationActor;
  matterId?: string | null;
  caseNumber?: string | null;
  externalCaseId?: string | null;
  endpointPath?: string | null;
  request?: Request;
}) {
  const account = await ensureConfiguredAccount(input.actor);
  const provider = getIntegrationProvider(account);
  const matterId = normalizeOptionalString(input.matterId);
  const matter = matterId ? await getMatterReference(input.actor.orgId, matterId) : null;
  const linkedExternalCase = matterId
    ? await findMatterExternalCase(input.actor.orgId, matterId, matter?.najizCaseNumber)
    : null;

  const caseNumber =
    normalizeOptionalString(input.caseNumber) ??
    linkedExternalCase?.case_number ??
    matter?.najizCaseNumber ??
    null;

  if (!caseNumber) {
    throw integrationError('missing_case_number', 'رقم القضية مطلوب لمزامنة طلبات التنفيذ.', {
      statusCode: 400,
    });
  }

  const job = await createSyncJob({
    orgId: input.actor.orgId,
    integrationId: account.id,
    provider: 'najiz',
    jobKind: 'enforcement_request_sync',
    environment: account.activeEnvironment,
    requestedBy: input.actor.userId,
    matterId: matterId ?? null,
    subjectType: matterId ? 'matter' : 'case_number',
    subjectId: matterId ?? caseNumber,
    requestPayload: {
      matter_id: matterId,
      case_number: caseNumber,
      external_case_id: normalizeOptionalString(input.externalCaseId),
      endpoint_path: normalizeOptionalString(input.endpointPath),
    },
  });

  try {
    const result = await withRetry(
      () =>
        provider.syncEnforcementRequests(
          {
            matterId,
            caseNumber,
            externalCaseId: normalizeOptionalString(input.externalCaseId),
            endpointPath: normalizeOptionalString(input.endpointPath),
          },
          { actor: input.actor, account },
        ),
      {
        label: 'najiz_sync_enforcement_requests',
        attempts: 2,
        shouldRetry,
      },
    );

    const requests = await upsertEnforcementRequests({
      orgId: input.actor.orgId,
      matterId,
      syncJobId: job.id,
      externalCaseDbId: linkedExternalCase?.id ?? null,
      requests: result.requests,
    });

    const newEvents = await upsertEnforcementRequestEvents({
      orgId: input.actor.orgId,
      matterId,
      events: result.events,
    });

    if (matterId && newEvents.length) {
      await appendMatterTimelineEvents({
        orgId: input.actor.orgId,
        matterId,
        createdBy: input.actor.userId,
        events: newEvents.map((event) => ({
          provider: 'najiz',
          source: event.source,
          externalCaseId: event.externalRequestId,
          externalEventId: event.externalEventId,
          eventType: event.actionType === 'session' ? 'session' : 'timeline',
          title: event.title,
          description: event.description,
          occurredAt: event.occurredAt,
          payloadJson: event.payloadJson,
          syncedAt: event.syncedAt,
        })),
      });
    }

    await runNajizSmartActions({
      orgId: input.actor.orgId,
      actorUserId: input.actor.userId,
      matter,
      enforcementRequests: result.requests,
    });

    setAccountHealth(account, {
      status: 'connected',
      healthStatus: 'healthy',
      lastSyncedAt: new Date().toISOString(),
      lastHealthError: null,
    });
    await saveIntegrationAccount(account, input.actor.userId);

    const updatedJob = await updateSyncJob(job.id, {
      status: requests.length ? 'succeeded' : 'partial',
      completedAt: new Date().toISOString(),
      summary: {
        imported_count: requests.length,
        event_count: result.events.length,
      },
      responsePayload: result.rawPayload,
    });

    await logIntegrationAudit({
      actor: input.actor,
      action: 'najiz.enforcement_requests_synced',
      entityType: 'enforcement_request',
      meta: {
        imported_count: requests.length,
        matter_id: matterId,
        case_number: caseNumber,
      },
      request: input.request,
    });

    return {
      job: updatedJob,
      ...result,
    };
  } catch (error) {
    await handleJobFailure({
      actor: input.actor,
      account,
      jobId: job.id,
      jobKind: 'enforcement_request_sync',
      message: error instanceof Error ? error.message : 'تعذر مزامنة طلبات التنفيذ.',
      request: input.request,
      matterId: matterId ?? undefined,
    });
    throw error;
  }
}

export async function syncNajizDocuments(input: {
  actor: IntegrationActor;
  matterId?: string | null;
  caseNumber?: string | null;
  externalCaseId?: string | null;
  endpointPath?: string | null;
  request?: Request;
}) {
  const account = await ensureConfiguredAccount(input.actor);
  const provider = getIntegrationProvider(account);
  const matterId = normalizeOptionalString(input.matterId);
  const matter = matterId ? await getMatterReference(input.actor.orgId, matterId) : null;
  const linkedExternalCase = matterId
    ? await findMatterExternalCase(input.actor.orgId, matterId, matter?.najizCaseNumber)
    : null;

  const caseNumber =
    normalizeOptionalString(input.caseNumber) ??
    linkedExternalCase?.case_number ??
    matter?.najizCaseNumber ??
    null;

  if (!caseNumber) {
    throw integrationError('missing_case_number', 'رقم القضية مطلوب لمزامنة المستندات.', {
      statusCode: 400,
    });
  }

  const job = await createSyncJob({
    orgId: input.actor.orgId,
    integrationId: account.id,
    provider: 'najiz',
    jobKind: 'document_sync',
    environment: account.activeEnvironment,
    requestedBy: input.actor.userId,
    matterId: matterId ?? null,
    subjectType: matterId ? 'matter' : 'case_number',
    subjectId: matterId ?? caseNumber,
    requestPayload: {
      matter_id: matterId,
      case_number: caseNumber,
      external_case_id: normalizeOptionalString(input.externalCaseId),
      endpoint_path: normalizeOptionalString(input.endpointPath),
    },
  });

  try {
    const result = await withRetry(
      () =>
        provider.syncDocuments(
          {
            matterId,
            caseNumber,
            externalCaseId: normalizeOptionalString(input.externalCaseId),
            endpointPath: normalizeOptionalString(input.endpointPath),
          },
          { actor: input.actor, account },
        ),
      {
        label: 'najiz_sync_documents',
        attempts: 2,
        shouldRetry,
      },
    );

    const persisted = await upsertExternalDocuments({
      orgId: input.actor.orgId,
      matterId,
      syncJobId: job.id,
      externalCaseDbId: linkedExternalCase?.id ?? null,
      clientId: matter?.clientId ?? null,
      createdBy: input.actor.userId,
      documents: result.documents,
    });

    await queueNajizDocumentPreparationJobs({
      actor: input.actor,
      account,
      parentJobId: job.id,
      documents: persisted.rows,
    });

    await runNajizSmartActions({
      orgId: input.actor.orgId,
      actorUserId: input.actor.userId,
      matter,
      documents: result.documents,
    });

    setAccountHealth(account, {
      status: 'connected',
      healthStatus: 'healthy',
      lastSyncedAt: new Date().toISOString(),
      lastHealthError: null,
    });
    await saveIntegrationAccount(account, input.actor.userId);

    const updatedJob = await updateSyncJob(job.id, {
      status: persisted.rows.length ? 'succeeded' : 'partial',
      completedAt: new Date().toISOString(),
      summary: {
        imported_count: persisted.rows.length,
        created_count: persisted.createdRows.length,
      },
      responsePayload: result.rawPayload,
    });

    await logIntegrationAudit({
      actor: input.actor,
      action: 'najiz.documents_synced',
      entityType: 'document',
      meta: {
        imported_count: persisted.rows.length,
        created_count: persisted.createdRows.length,
        matter_id: matterId,
        case_number: caseNumber,
      },
      request: input.request,
    });

    return {
      job: updatedJob,
      documents: result.documents,
      rawPayload: result.rawPayload,
    };
  } catch (error) {
    await handleJobFailure({
      actor: input.actor,
      account,
      jobId: job.id,
      jobKind: 'document_sync',
      message: error instanceof Error ? error.message : 'تعذر مزامنة مستندات ناجز.',
      request: input.request,
      matterId: matterId ?? undefined,
    });
    throw error;
  }
}

export async function syncNajizSessionMinutes(input: {
  actor: IntegrationActor;
  matterId?: string | null;
  caseNumber?: string | null;
  externalCaseId?: string | null;
  endpointPath?: string | null;
  request?: Request;
}) {
  const account = await ensureConfiguredAccount(input.actor);
  const provider = getIntegrationProvider(account);
  const matterId = normalizeOptionalString(input.matterId);
  const matter = matterId ? await getMatterReference(input.actor.orgId, matterId) : null;
  const linkedExternalCase = matterId
    ? await findMatterExternalCase(input.actor.orgId, matterId, matter?.najizCaseNumber)
    : null;

  const caseNumber =
    normalizeOptionalString(input.caseNumber) ??
    linkedExternalCase?.case_number ??
    matter?.najizCaseNumber ??
    null;

  if (!caseNumber) {
    throw integrationError('missing_case_number', 'رقم القضية مطلوب لمزامنة محاضر الجلسات.', {
      statusCode: 400,
    });
  }

  const job = await createSyncJob({
    orgId: input.actor.orgId,
    integrationId: account.id,
    provider: 'najiz',
    jobKind: 'session_minutes_sync',
    environment: account.activeEnvironment,
    requestedBy: input.actor.userId,
    matterId: matterId ?? null,
    subjectType: matterId ? 'matter' : 'case_number',
    subjectId: matterId ?? caseNumber,
    requestPayload: {
      matter_id: matterId,
      case_number: caseNumber,
      external_case_id: normalizeOptionalString(input.externalCaseId),
      endpoint_path: normalizeOptionalString(input.endpointPath),
    },
  });

  try {
    const result = await withRetry(
      () =>
        provider.syncSessionMinutes(
          {
            matterId,
            caseNumber,
            externalCaseId: normalizeOptionalString(input.externalCaseId),
            endpointPath: normalizeOptionalString(input.endpointPath),
          },
          { actor: input.actor, account },
        ),
      {
        label: 'najiz_sync_session_minutes',
        attempts: 2,
        shouldRetry,
      },
    );

    const persisted = await upsertSessionMinutes({
      orgId: input.actor.orgId,
      matterId,
      syncJobId: job.id,
      externalCaseDbId: linkedExternalCase?.id ?? null,
      minutes: result.minutes,
    });

    if (matterId && persisted.createdRows.length) {
      await appendMatterTimelineEvents({
        orgId: input.actor.orgId,
        matterId,
        createdBy: input.actor.userId,
        events: persisted.createdRows.map((minute) => ({
          provider: 'najiz',
          source: 'najiz',
          externalCaseId: minute.external_id,
          externalEventId: `${minute.external_id}:minute`,
          eventType: 'session',
          title: minute.title,
          description: minute.summary,
          occurredAt: minute.occurred_at,
          payloadJson: (minute.payload_json ?? {}) as JsonObject,
          syncedAt: minute.synced_at,
        })),
      });
    }

    await runNajizSmartActions({
      orgId: input.actor.orgId,
      actorUserId: input.actor.userId,
      matter,
      sessionMinutes: result.minutes,
    });

    setAccountHealth(account, {
      status: 'connected',
      healthStatus: 'healthy',
      lastSyncedAt: new Date().toISOString(),
      lastHealthError: null,
    });
    await saveIntegrationAccount(account, input.actor.userId);

    const updatedJob = await updateSyncJob(job.id, {
      status: persisted.rows.length ? 'succeeded' : 'partial',
      completedAt: new Date().toISOString(),
      summary: {
        imported_count: persisted.rows.length,
        created_count: persisted.createdRows.length,
      },
      responsePayload: result.rawPayload,
    });

    await logIntegrationAudit({
      actor: input.actor,
      action: 'najiz.session_minutes_synced',
      entityType: 'matter_event',
      meta: {
        imported_count: persisted.rows.length,
        created_count: persisted.createdRows.length,
        matter_id: matterId,
        case_number: caseNumber,
      },
      request: input.request,
    });

    return {
      job: updatedJob,
      minutes: result.minutes,
      rawPayload: result.rawPayload,
    };
  } catch (error) {
    await handleJobFailure({
      actor: input.actor,
      account,
      jobId: job.id,
      jobKind: 'session_minutes_sync',
      message: error instanceof Error ? error.message : 'تعذر مزامنة محاضر الجلسات.',
      request: input.request,
      matterId: matterId ?? undefined,
    });
    throw error;
  }
}

export async function getNajizMatterOverview(input: { actor: IntegrationActor; matterId: string }) {
  const matter = await getMatterReference(input.actor.orgId, input.matterId);
  if (!matter) {
    throw integrationError('matter_not_found', 'القضية غير موجودة.', { statusCode: 404 });
  }

  const [externalOverview, judicialCosts, enforcementRequests, externalDocuments, sessionMinutes, recentJobs] =
    await Promise.all([
    listMatterExternalCaseOverview(input.actor.orgId, input.matterId),
    listMatterJudicialCosts(input.actor.orgId, input.matterId),
    listMatterEnforcementRequests(input.actor.orgId, input.matterId),
    listMatterExternalDocuments(input.actor.orgId, input.matterId),
    listMatterSessionMinutes(input.actor.orgId, input.matterId),
    listRecentSyncJobs({ orgId: input.actor.orgId, limit: 20 }),
    ]);

  return {
    matter,
    externalCase: externalOverview.externalCase,
    events: externalOverview.events,
    judicialCosts,
    enforcementRequests,
    documents: externalDocuments,
    sessionMinutes,
    jobs: recentJobs.filter((job) => job.matterId === input.matterId),
  };
}

async function runCaseSync(input: {
  actor: IntegrationActor;
  account: IntegrationAccount;
  provider: ReturnType<typeof getIntegrationProvider>;
  endpointPath: string | null;
  matterId: string | null;
  caseNumber: string | null;
}): Promise<SyncCaseResult> {
  const result = await withRetry(
    () =>
      input.provider.syncCase(
        {
          matterId: input.matterId,
          caseNumber: input.caseNumber,
          endpointPath: input.endpointPath,
        },
        { actor: input.actor, account: input.account },
      ),
    {
      label: 'najiz_sync_case',
      attempts: 2,
      shouldRetry,
    },
  );

  const persistedCases = await upsertExternalCases({
    orgId: input.actor.orgId,
    linkedMatterId: input.matterId,
    linkedBy: input.actor.userId,
    cases: result.cases,
  });

  const newEvents = await upsertExternalCaseEvents({
    orgId: input.actor.orgId,
    linkedMatterId: input.matterId,
    events: result.events,
  });

  if (input.matterId && newEvents.length) {
    await appendMatterTimelineEvents({
      orgId: input.actor.orgId,
      matterId: input.matterId,
      createdBy: input.actor.userId,
      events: newEvents,
    });
  }

  logInfo('najiz_case_sync_completed', {
    org_id: input.actor.orgId,
    matter_id: input.matterId,
    imported_count: persistedCases.length,
    new_event_count: newEvents.length,
  });

  return result;
}

async function handleJobFailure(input: {
  actor: IntegrationActor;
  account: IntegrationAccount;
  jobId: string;
  jobKind: SyncJobKind;
  message: string;
  request?: Request;
  matterId?: string;
}) {
  setEnvironmentConfig(input.account, input.account.activeEnvironment, {
    lastError: input.message,
  });
  setAccountHealth(input.account, {
    status: 'error',
    healthStatus: 'degraded',
    lastHealthError: input.message,
  });
  await saveIntegrationAccount(input.account, input.actor.userId);

  await updateSyncJob(input.jobId, {
    status: 'failed',
    completedAt: new Date().toISOString(),
    errorMessage: input.message,
    summary: {
      ok: false,
      job_kind: input.jobKind,
    },
  });

  await appendSyncLog({
    jobId: input.jobId,
    orgId: input.actor.orgId,
    provider: 'najiz',
    level: 'error',
    action: `${input.jobKind}_failed`,
    message: input.message,
    createdBy: input.actor.userId,
  });

  await createIntegrationNotification({
    orgId: input.actor.orgId,
    recipientUserId: input.actor.userId,
    category:
      input.jobKind === 'lawyer_verification'
        ? 'lawyer_verification'
        : input.jobKind === 'judicial_cost_sync'
        ? 'judicial_cost'
        : input.jobKind === 'enforcement_request_sync'
        ? 'enforcement_request'
        : input.jobKind === 'case_sync'
        ? 'case_sync'
        : 'integration_sync',
    title: 'فشل مزامنة Najiz',
    body: input.message,
    entityType: input.matterId ? 'matter' : 'integration_account',
    entityId: input.matterId ?? input.account.id,
    payloadJson: {
      job_kind: input.jobKind,
    },
  });

  logError('najiz_job_failed', {
    org_id: input.actor.orgId,
    user_id: input.actor.userId,
    job_id: input.jobId,
    job_kind: input.jobKind,
    message: input.message,
  });

  await logIntegrationAudit({
    actor: input.actor,
    action: `najiz.${input.jobKind}.failed`,
    entityType: input.matterId ? 'matter' : 'integration_account',
    entityId: input.matterId ?? input.account.id,
    meta: {
      message: input.message,
    },
    request: input.request,
  });
}

async function ensureConfiguredAccount(actor: IntegrationActor) {
  const account = await ensureAccount(actor);
  getActiveEnvironmentCredentials(account);
  return account;
}

async function getUserLicenseNumber(userId: string) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('app_users')
    .select('license_number')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return normalizeOptionalString((data as { license_number?: string | null } | null)?.license_number);
}

function normalizeOptionalString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

// TODO(phase-2): extend provider orchestration here with enforcement requests and document digitization flows.
// TODO(phase-3): add webhook/event-driven orchestration, session minutes ingestion, and client portal push workflows.
