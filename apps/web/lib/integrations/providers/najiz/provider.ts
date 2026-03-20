import 'server-only';

import { integrationError } from '../../domain/errors';
import type { IntegrationProvider, ProviderExecutionContext } from '../../domain/contracts';
import type {
  JsonObject,
  NormalizedExternalCase,
  NormalizedExternalCaseEvent,
  NormalizedExternalDocument,
  NormalizedEnforcementRequest,
  NormalizedEnforcementRequestEvent,
  NormalizedJudicialCost,
  NormalizedLawyerVerification,
  NormalizedPowerOfAttorneyValidation,
  NormalizedSessionMinute,
  ProviderHealthResult,
  PowerOfAttorneyValidationStatus,
  ValidatePowerOfAttorneyInput,
  ValidatePowerOfAttorneyResult,
  SyncCaseInput,
  SyncCaseResult,
  SyncDocumentsInput,
  SyncDocumentsResult,
  SyncEnforcementRequestsInput,
  SyncEnforcementRequestsResult,
  SyncJudicialCostsInput,
  SyncJudicialCostsResult,
  SyncSessionMinutesInput,
  SyncSessionMinutesResult,
  VerifyLawyerInput,
  VerifyLawyerResult,
} from '../../domain/models';
import type {
  NajizApiEnvelope,
  NajizCaseEventPayload,
  NajizCasePayload,
  NajizDocumentPayload,
  NajizEnforcementRequestEventPayload,
  NajizEnforcementRequestPayload,
  NajizJudicialCostPayload,
  NajizLawyerVerificationPayload,
  NajizPowerOfAttorneyPayload,
  NajizSessionMinutePayload,
} from './types';
import { resolveNajizProviderAdapter } from './adapter';

export class NajizProvider implements IntegrationProvider {
  readonly providerKey = 'najiz' as const;

  async getHealthStatus(context: ProviderExecutionContext): Promise<ProviderHealthResult> {
    const adapter = resolveNajizProviderAdapter(context.account);
    const result = await adapter.checkHealth(context.account);

    return {
      ok: true,
      status: 'healthy',
      message: result.message,
      checkedAt: new Date().toISOString(),
      meta: result.rawPayload,
    };
  }

  async verifyLawyer(input: VerifyLawyerInput, context: ProviderExecutionContext): Promise<VerifyLawyerResult> {
    if (!input.licenseNumber && !input.nationalId) {
      throw integrationError('missing_verification_identifier', 'رقم الرخصة أو الهوية مطلوب للتحقق من المحامي.', {
        statusCode: 400,
      });
    }

    const adapter = resolveNajizProviderAdapter(context.account);
    const rawPayload = await adapter.fetchLawyerVerification(context.account, input);
    const record = extractSingleRecord<NajizLawyerVerificationPayload>(rawPayload);
    const syncedAt = new Date().toISOString();

    const verification: NormalizedLawyerVerification = {
      provider: 'najiz',
      source: 'najiz',
      externalId:
        pickString(record, ['external_id', 'id', 'lawyerId']) ||
        input.licenseNumber ||
        input.nationalId ||
        `lawyer-${syncedAt}`,
      licenseNumber: pickString(record, ['license_number', 'licenseNumber']) || input.licenseNumber || null,
      nationalId: pickString(record, ['national_id', 'nationalId']) || input.nationalId || null,
      lawyerName: pickString(record, ['lawyer_name', 'name', 'fullName']) || null,
      officeName: pickString(record, ['office_name', 'officeName']) || null,
      status: normalizeLawyerVerificationStatus(
        pickString(record, ['status', 'verificationStatus']) || 'failed',
      ),
      verifiedAt: pickDate(record, ['verified_at', 'verifiedAt']),
      expiresAt: pickDate(record, ['expires_at', 'expiresAt']),
      payloadJson: ensureObject(record),
      syncedAt,
    };

    return {
      verification,
      rawPayload,
    };
  }

  async validatePowerOfAttorney(
    input: ValidatePowerOfAttorneyInput,
    context: ProviderExecutionContext,
  ): Promise<ValidatePowerOfAttorneyResult> {
    if (!input.clientId || !input.poaNumber) {
      throw integrationError('missing_poa_number', 'رقم الوكالة والعميل مطلوبان للتحقق من الوكالة.', {
        statusCode: 400,
      });
    }

    const adapter = resolveNajizProviderAdapter(context.account);
    const rawPayload = await adapter.fetchPowerOfAttorneyValidation(context.account, input);
    const record = extractSingleRecord<NajizPowerOfAttorneyPayload>(rawPayload);
    const syncedAt = new Date().toISOString();
    const verifiedAt = pickDate(record, ['verified_at', 'verifiedAt']) || syncedAt;
    const expiresAt = pickDate(record, ['expires_at', 'expiresAt']);
    const status = normalizePowerOfAttorneyStatus(record, expiresAt);
    const validation: NormalizedPowerOfAttorneyValidation = {
      provider: 'najiz',
      source: 'najiz',
      externalId:
        pickString(record, ['external_id', 'id', 'poa_id', 'poaId']) ||
        input.poaNumber ||
        `poa-${syncedAt}`,
      clientId: input.clientId,
      poaNumber: input.poaNumber,
      status,
      isRevoked: status === 'REVOKED',
      holderName: pickString(record, ['holder_name', 'holderName']) || null,
      issuedAt: pickDate(record, ['issued_at', 'issuedAt']),
      expiresAt,
      verifiedAt,
      payloadJson: ensureObject(record),
      syncedAt,
    };

    return {
      validation,
      rawPayload,
    };
  }

  async syncCase(input: SyncCaseInput, context: ProviderExecutionContext): Promise<SyncCaseResult> {
    const adapter = resolveNajizProviderAdapter(context.account);
    const rawPayload = await adapter.fetchCases(context.account, input);
    const cases = extractCollection<NajizCasePayload>(rawPayload, ['cases', 'items', 'results', 'data']);

    if (!cases.length) {
      throw integrationError('case_payload_empty', 'لم يتم العثور على بيانات قضايا قابلة للمزامنة.', {
        statusCode: 400,
      });
    }

    const syncedAt = new Date().toISOString();
    const normalizedCases: NormalizedExternalCase[] = [];
    const normalizedEvents: NormalizedExternalCaseEvent[] = [];

    for (const item of cases) {
      const externalId =
        pickString(item, ['external_id', 'case_id', 'caseId', 'id', 'case_number', 'caseNumber']) ||
        input.caseNumber ||
        '';

      if (!externalId) {
        continue;
      }

      const caseNumber =
        pickString(item, ['case_number', 'caseNumber', 'reference']) ||
        input.caseNumber ||
        externalId;

      normalizedCases.push({
        provider: 'najiz',
        source: 'najiz',
        externalId,
        caseNumber,
        caseReference: pickString(item, ['reference']) || null,
        title:
          pickString(item, ['title', 'case_title', 'caseTitle', 'subject']) ||
          `قضية ${caseNumber}`,
        court: pickString(item, ['court', 'court_name', 'courtName']) || null,
        status: pickString(item, ['status', 'case_status', 'caseStatus']) || null,
        payloadJson: ensureObject(item),
        syncedAt,
      });

      const events = extractCaseEvents(item);
      for (let index = 0; index < events.length; index += 1) {
        const event = events[index]!;
        normalizedEvents.push({
          provider: 'najiz',
          source: 'najiz',
          externalCaseId: externalId,
          externalEventId:
            pickString(event, ['external_id', 'event_id', 'eventId', 'id']) ||
            `${externalId}:event:${index + 1}:${pickString(event, ['title', 'label']) || 'timeline'}`,
          eventType: normalizeCaseEventType(
            pickString(event, ['event_type', 'eventType', 'type']) || 'timeline',
          ),
          title: pickString(event, ['title', 'label']) || 'تحديث من ناجز',
          description: pickString(event, ['description', 'note']) || null,
          occurredAt: pickDate(event, ['occurred_at', 'occurredAt', 'session_date', 'sessionDate', 'date']),
          payloadJson: ensureObject(event),
          syncedAt,
        });
      }
    }

    if (!normalizedCases.length) {
      throw integrationError('case_payload_invalid', 'لم يتم العثور على قضايا تحمل معرفات خارجية صالحة.', {
        statusCode: 400,
      });
    }

    return {
      cases: normalizedCases,
      events: normalizedEvents,
      rawPayload,
    };
  }

  async syncJudicialCosts(
    input: SyncJudicialCostsInput,
    context: ProviderExecutionContext,
  ): Promise<SyncJudicialCostsResult> {
    const adapter = resolveNajizProviderAdapter(context.account);
    const rawPayload = await adapter.fetchJudicialCosts(context.account, input);
    const costs = extractCollection<NajizJudicialCostPayload>(rawPayload, ['costs', 'items', 'results', 'data']);

    const syncedAt = new Date().toISOString();
    const normalizedCosts: NormalizedJudicialCost[] = costs
      .map((item) => {
        const externalId =
          pickString(item, ['external_id', 'id']) ||
          pickString(item, ['invoice_reference', 'invoiceReference']) ||
          '';
        if (!externalId) {
          return null;
        }

        return {
          provider: 'najiz',
          source: 'najiz',
          externalId,
          externalCaseId:
            pickString(item, ['case_id', 'caseId', 'case_number', 'caseNumber']) || input.caseNumber || null,
          costType: normalizeJudicialCostType(
            pickString(item, ['cost_type', 'costType', 'type']) || 'judicial_cost',
          ),
          title: pickString(item, ['title', 'description']) || `رسم قضائي ${externalId}`,
          amount: pickNumber(item, ['amount', 'total']),
          currency: pickString(item, ['currency']) || 'SAR',
          status: normalizeJudicialCostStatus(pickString(item, ['status']) || 'unknown'),
          invoiceReference: pickString(item, ['invoice_reference', 'invoiceReference']) || null,
          dueAt: pickDate(item, ['due_at', 'dueAt']),
          payloadJson: ensureObject(item),
          syncedAt,
        } satisfies NormalizedJudicialCost;
      })
      .filter((item): item is NormalizedJudicialCost => Boolean(item));

    return {
      costs: normalizedCosts,
      rawPayload,
    };
  }

  async syncEnforcementRequests(
    input: SyncEnforcementRequestsInput,
    context: ProviderExecutionContext,
  ): Promise<SyncEnforcementRequestsResult> {
    const adapter = resolveNajizProviderAdapter(context.account);
    const rawPayload = await adapter.fetchEnforcementRequests(context.account, input);
    const requests = extractCollection<NajizEnforcementRequestPayload>(rawPayload, [
      'requests',
      'enforcement_requests',
      'items',
      'results',
      'data',
    ]);

    const syncedAt = new Date().toISOString();
    const normalizedRequests: NormalizedEnforcementRequest[] = [];
    const normalizedEvents: NormalizedEnforcementRequestEvent[] = [];

    for (const item of requests) {
      const externalId =
        pickString(item, ['external_id', 'request_id', 'requestId', 'id', 'request_number', 'requestNumber']) ||
        '';
      if (!externalId) {
        continue;
      }

      normalizedRequests.push({
        provider: 'najiz',
        source: 'najiz',
        externalId,
        externalCaseId:
          pickString(item, ['case_id', 'caseId', 'case_number', 'caseNumber']) || input.caseNumber || null,
        requestNumber: pickString(item, ['request_number', 'requestNumber']) || externalId,
        requestType: normalizeEnforcementRequestType(
          pickString(item, ['request_type', 'requestType', 'type']) || 'other',
        ),
        title: pickString(item, ['title', 'subject']) || `طلب تنفيذ ${externalId}`,
        status: normalizeEnforcementRequestStatus(pickString(item, ['status']) || 'unknown'),
        applicantName: pickString(item, ['applicant_name', 'applicantName']) || null,
        respondentName: pickString(item, ['respondent_name', 'respondentName']) || null,
        amount: pickNullableNumber(item, ['amount']),
        currency: pickString(item, ['currency']) || 'SAR',
        submittedAt: pickDate(item, ['submitted_at', 'submittedAt']),
        closedAt: pickDate(item, ['closed_at', 'closedAt']),
        payloadJson: ensureObject(item),
        syncedAt,
      });

      const events = extractEnforcementEvents(item);
      for (let index = 0; index < events.length; index += 1) {
        const event = events[index]!;
        normalizedEvents.push({
          provider: 'najiz',
          source: 'najiz',
          externalRequestId: externalId,
          externalEventId:
            pickString(event, ['external_id', 'event_id', 'eventId', 'id']) ||
            `${externalId}:event:${index + 1}:${pickString(event, ['title', 'label']) || 'timeline'}`,
          actionType: normalizeEnforcementActionType(
            pickString(event, ['action_type', 'actionType', 'type']) || 'timeline',
          ),
          title: pickString(event, ['title', 'label']) || 'تحديث طلب التنفيذ',
          description: pickString(event, ['description', 'note']) || null,
          occurredAt: pickDate(event, ['occurred_at', 'occurredAt', 'date']),
          payloadJson: ensureObject(event),
          syncedAt,
        });
      }
    }

    return {
      requests: normalizedRequests,
      events: normalizedEvents,
      rawPayload,
    };
  }

  async syncDocuments(
    input: SyncDocumentsInput,
    context: ProviderExecutionContext,
  ): Promise<SyncDocumentsResult> {
    const adapter = resolveNajizProviderAdapter(context.account);
    const rawPayload = await adapter.fetchDocuments(context.account, input);
    const documents = extractCollection<NajizDocumentPayload>(rawPayload, ['documents', 'items', 'results', 'data']);
    const syncedAt = new Date().toISOString();

    return {
      documents: documents
        .map((item) => {
          const externalId =
            pickString(item, ['external_id', 'document_id', 'documentId', 'id']) ||
            pickString(item, ['file_name', 'fileName']);
          if (!externalId) {
            return null;
          }

          const title = pickString(item, ['title', 'subject']) || `مستند ${externalId}`;
          const fileName =
            pickString(item, ['file_name', 'fileName']) || `${externalId}.${inferFileExtension(item)}`;

          return {
            provider: 'najiz',
            source: 'najiz',
            externalId,
            externalCaseId:
              pickString(item, ['case_id', 'caseId', 'case_number', 'caseNumber']) || input.caseNumber || null,
            documentType: normalizeExternalDocumentType(
              pickString(item, ['document_type', 'documentType', 'type']) || 'other',
            ),
            title,
            fileName,
            mimeType: pickString(item, ['mime_type', 'mimeType']) || null,
            downloadUrl: pickString(item, ['download_url', 'downloadUrl']) || null,
            fileSize: pickNullableNumber(item, ['file_size', 'fileSize']),
            checksum: pickString(item, ['checksum', 'sha256']) || null,
            issuedAt: pickDate(item, ['issued_at', 'issuedAt']),
            portalVisible: item.portal_visible !== false && item.portalVisible !== false,
            payloadJson: ensureObject(item),
            syncedAt,
          } satisfies NormalizedExternalDocument;
        })
        .filter((item): item is NormalizedExternalDocument => Boolean(item)),
      rawPayload,
    };
  }

  async syncSessionMinutes(
    input: SyncSessionMinutesInput,
    context: ProviderExecutionContext,
  ): Promise<SyncSessionMinutesResult> {
    const adapter = resolveNajizProviderAdapter(context.account);
    const rawPayload = await adapter.fetchSessionMinutes(context.account, input);
    const minutes = extractCollection<NajizSessionMinutePayload>(rawPayload, [
      'session_minutes',
      'minutes',
      'items',
      'results',
      'data',
    ]);
    const syncedAt = new Date().toISOString();

    return {
      minutes: minutes
        .map((item) => {
          const externalId =
            pickString(item, ['external_id', 'minute_id', 'minuteId', 'id']) ||
            pickString(item, ['session_reference', 'sessionReference']);
          if (!externalId) {
            return null;
          }

          return {
            provider: 'najiz',
            source: 'najiz',
            externalId,
            externalCaseId:
              pickString(item, ['case_id', 'caseId', 'case_number', 'caseNumber']) || input.caseNumber || null,
            sessionReference: pickString(item, ['session_reference', 'sessionReference']) || null,
            title: pickString(item, ['title']) || `محضر جلسة ${externalId}`,
            summary: pickString(item, ['summary', 'note']) || null,
            occurredAt: pickDate(item, ['occurred_at', 'occurredAt', 'date']),
            minuteDocumentExternalId:
              pickString(item, ['minute_document_id', 'minuteDocumentId', 'document_id', 'documentId']) || null,
            payloadJson: ensureObject(item),
            syncedAt,
          } satisfies NormalizedSessionMinute;
        })
        .filter((item): item is NormalizedSessionMinute => Boolean(item)),
      rawPayload,
    };
  }
}

function extractSingleRecord<T extends Record<string, unknown>>(payload: JsonObject): T {
  const collection = extractCollection<T>(payload, ['items', 'results', 'data']);
  if (collection.length) {
    return collection[0]!;
  }

  return payload as T;
}

function extractCollection<T extends Record<string, unknown>>(payload: JsonObject, keys: string[]): T[] {
  if (Array.isArray(payload)) {
    return payload.filter((entry): entry is T => Boolean(entry && typeof entry === 'object'));
  }

  const envelope = payload as NajizApiEnvelope<T>;
  for (const key of keys) {
    const value = envelope[key as keyof NajizApiEnvelope<T>];
    if (Array.isArray(value)) {
      return value.filter((entry): entry is T => Boolean(entry && typeof entry === 'object'));
    }
    if (value && typeof value === 'object') {
      return [value as T];
    }
  }

  return [];
}

function extractCaseEvents(item: NajizCasePayload): NajizCaseEventPayload[] {
  for (const key of ['events', 'hearings', 'activities'] as const) {
    const value = item[key];
    if (Array.isArray(value)) {
      return value.filter((entry): entry is NajizCaseEventPayload => Boolean(entry && typeof entry === 'object'));
    }
  }
  return [];
}

function extractEnforcementEvents(item: NajizEnforcementRequestPayload): NajizEnforcementRequestEventPayload[] {
  for (const key of ['events', 'actions', 'timeline', 'activities'] as const) {
    const value = item[key];
    if (Array.isArray(value)) {
      return value.filter(
        (entry): entry is NajizEnforcementRequestEventPayload => Boolean(entry && typeof entry === 'object'),
      );
    }
  }

  return [];
}

function pickString(obj: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }
  }
  return '';
}

function pickBoolean(obj: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'number') {
      if (value === 1) return true;
      if (value === 0) return false;
    }
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (['true', '1', 'yes', 'y'].includes(normalized)) return true;
      if (['false', '0', 'no', 'n'].includes(normalized)) return false;
    }
  }
  return null;
}

function pickDate(obj: Record<string, unknown>, keys: string[]) {
  const value = pickString(obj, keys);
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function pickNumber(obj: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string') {
      const parsed = Number(value.replace(/[^\d.-]/g, ''));
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return 0;
}

function pickNullableNumber(obj: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = obj[key];
    if (value === null || value === undefined || value === '') {
      continue;
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string') {
      const parsed = Number(value.replace(/[^\d.-]/g, ''));
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return null;
}

function ensureObject(value: unknown): JsonObject {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as JsonObject;
  }

  return { value: String(value ?? '') };
}

function normalizePowerOfAttorneyStatus(
  record: Record<string, unknown>,
  expiresAt?: string | null,
): PowerOfAttorneyValidationStatus {
  const status = pickString(record, ['status', 'verification_status', 'verificationStatus']).toLowerCase();
  const isRevoked = pickBoolean(record, ['is_revoked', 'isRevoked', 'revoked']);

  if (isRevoked === true || status.includes('revok') || status.includes('فسخ') || status.includes('ملغ')) {
    return 'REVOKED';
  }

  if (expiresAt) {
    const expiry = new Date(expiresAt);
    if (!Number.isNaN(expiry.getTime()) && expiry.getTime() < Date.now()) {
      return 'EXPIRED';
    }
  }

  if (status.includes('expir') || status.includes('انته') || status.includes('منته')) {
    return 'EXPIRED';
  }

  if (
    status.includes('valid') ||
    status.includes('active') ||
    status.includes('ساري') ||
    status.includes('صحيح') ||
    status.includes('موثوق')
  ) {
    return 'VALID';
  }

  return 'VALID';
}

function normalizeLawyerVerificationStatus(value: string) {
  const normalized = value.toLowerCase();
  if (normalized.includes('verified') || normalized.includes('active') || normalized.includes('valid')) {
    return 'verified' as const;
  }
  if (normalized.includes('mismatch')) {
    return 'mismatch' as const;
  }
  if (normalized.includes('not') && normalized.includes('found')) {
    return 'not_found' as const;
  }
  if (normalized.includes('pending')) {
    return 'pending' as const;
  }
  return 'failed' as const;
}

function normalizeCaseEventType(value: string) {
  const normalized = value.toLowerCase();
  if (normalized.includes('session') || normalized.includes('hearing')) return 'session' as const;
  if (normalized.includes('status')) return 'status_change' as const;
  if (normalized.includes('filing')) return 'filing' as const;
  if (normalized.includes('document')) return 'document' as const;
  return 'timeline' as const;
}

function normalizeJudicialCostType(value: string) {
  const normalized = value.toLowerCase();
  if (normalized.includes('invoice')) return 'invoice' as const;
  if (normalized.includes('fee')) return 'fee' as const;
  if (normalized.includes('judicial')) return 'judicial_cost' as const;
  return 'other' as const;
}

function normalizeJudicialCostStatus(value: string) {
  const normalized = value.toLowerCase();
  if (normalized.includes('paid')) return 'paid' as const;
  if (normalized.includes('overdue')) return 'overdue' as const;
  if (normalized.includes('waived')) return 'waived' as const;
  if (normalized.includes('cancel')) return 'cancelled' as const;
  if (normalized.includes('pending')) return 'pending' as const;
  return 'unknown' as const;
}

function normalizeEnforcementRequestType(value: string) {
  const normalized = value.toLowerCase();
  if (normalized.includes('execution') || normalized.includes('order') || normalized.includes('تنفيذ')) {
    return 'execution_order' as const;
  }
  if (normalized.includes('attach') || normalized.includes('حجز')) return 'attachment' as const;
  if (normalized.includes('travel') || normalized.includes('سفر')) return 'travel_ban' as const;
  if (normalized.includes('payment') || normalized.includes('سداد')) return 'payment' as const;
  if (normalized.includes('notice') || normalized.includes('إشعار') || normalized.includes('اعلان')) {
    return 'notice' as const;
  }
  return 'other' as const;
}

function normalizeEnforcementRequestStatus(value: string) {
  const normalized = value.toLowerCase();
  if (normalized.includes('draft') || normalized.includes('مسودة')) return 'draft' as const;
  if (normalized.includes('submitted') || normalized.includes('new') || normalized.includes('مقدم')) {
    return 'submitted' as const;
  }
  if (normalized.includes('review') || normalized.includes('قيد المراجعة')) return 'under_review' as const;
  if (
    normalized.includes('progress') ||
    normalized.includes('processing') ||
    normalized.includes('active') ||
    normalized.includes('قيد التنفيذ')
  ) {
    return 'in_progress' as const;
  }
  if (
    normalized.includes('resolved') ||
    normalized.includes('completed') ||
    normalized.includes('fulfilled') ||
    normalized.includes('منجز')
  ) {
    return 'resolved' as const;
  }
  if (normalized.includes('reject') || normalized.includes('مرفوض')) return 'rejected' as const;
  if (normalized.includes('closed') || normalized.includes('مغلق')) return 'closed' as const;
  return 'unknown' as const;
}

function normalizeEnforcementActionType(value: string) {
  const normalized = value.toLowerCase();
  if (normalized.includes('status') || normalized.includes('حالة')) return 'status_change' as const;
  if (normalized.includes('payment') || normalized.includes('سداد')) return 'payment' as const;
  if (normalized.includes('notice') || normalized.includes('إشعار') || normalized.includes('تبليغ')) {
    return 'notice' as const;
  }
  if (normalized.includes('session') || normalized.includes('hearing') || normalized.includes('جلسة')) {
    return 'session' as const;
  }
  return 'timeline' as const;
}

function normalizeExternalDocumentType(value: string) {
  const normalized = value.toLowerCase();
  if (normalized.includes('petition') || normalized.includes('طلب')) return 'petition' as const;
  if (normalized.includes('judgment') || normalized.includes('حكم')) return 'judgment' as const;
  if (normalized.includes('invoice') || normalized.includes('فاتورة')) return 'invoice' as const;
  if (normalized.includes('minute') || normalized.includes('محضر')) return 'session_minutes' as const;
  if (normalized.includes('evidence') || normalized.includes('مستند') || normalized.includes('مرفق')) {
    return 'evidence' as const;
  }
  if (normalized.includes('notice') || normalized.includes('إشعار')) return 'notice' as const;
  return 'other' as const;
}

function inferFileExtension(item: NajizDocumentPayload) {
  const mimeType = pickString(item, ['mime_type', 'mimeType']).toLowerCase();
  if (mimeType.includes('pdf')) return 'pdf';
  if (mimeType.includes('word') || mimeType.includes('document')) return 'docx';
  return 'bin';
}
