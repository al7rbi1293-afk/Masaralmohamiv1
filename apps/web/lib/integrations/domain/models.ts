export type JsonPrimitive = string | number | boolean | null;

export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];

export type JsonObject = {
  [key: string]: JsonValue;
};

export type IntegrationProviderKey = 'najiz';

export type IntegrationEnvironment = 'sandbox' | 'production';

export type IntegrationConnectionStatus = 'disconnected' | 'connected' | 'error';

export type IntegrationHealthStatus = 'healthy' | 'degraded' | 'offline' | 'not_configured';

export type IntegrationActorRole = 'admin' | 'owner' | 'lawyer' | 'assistant';

export type IntegrationActor = {
  userId: string;
  orgId: string;
  role: IntegrationActorRole;
  isAppAdmin: boolean;
};

export type SyncJobKind =
  | 'matter_refresh'
  | 'health_check'
  | 'lawyer_verification'
  | 'case_sync'
  | 'judicial_cost_sync'
  | 'enforcement_request_sync'
  | 'document_sync'
  | 'document_prepare'
  | 'session_minutes_sync'
  | 'smart_notification_dispatch';

export type SyncJobStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'partial' | 'retrying';

export type SyncTriggerMode = 'manual' | 'scheduled' | 'webhook' | 'system';

export type LawyerVerificationStatus = 'pending' | 'verified' | 'not_found' | 'mismatch' | 'failed';

export type JudicialCostStatus = 'pending' | 'paid' | 'overdue' | 'waived' | 'cancelled' | 'unknown';

export type JudicialCostType = 'judicial_cost' | 'invoice' | 'fee' | 'other';

export type ExternalDocumentType =
  | 'petition'
  | 'judgment'
  | 'invoice'
  | 'session_minutes'
  | 'evidence'
  | 'notice'
  | 'other';

export type ExternalDocumentPreparationStatus = 'pending' | 'downloading' | 'ready' | 'failed' | 'skipped';

export type EnforcementRequestStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'in_progress'
  | 'resolved'
  | 'rejected'
  | 'closed'
  | 'unknown';

export type EnforcementRequestType =
  | 'execution_order'
  | 'attachment'
  | 'travel_ban'
  | 'payment'
  | 'notice'
  | 'other';

export type EnforcementRequestActionType = 'status_change' | 'payment' | 'notice' | 'session' | 'timeline';

export type IntegrationWebhookEventStatus = 'pending' | 'processing' | 'processed' | 'ignored' | 'failed';

export type IntegrationSyncPaths = {
  cases: string | null;
  lawyerVerification: string | null;
  judicialCosts: string | null;
  enforcementRequests: string | null;
  documents: string | null;
  sessionMinutes: string | null;
};

export type IntegrationEnvironmentConfig = {
  baseUrl: string;
  tokenPath: string | null;
  healthPath: string | null;
  syncPaths: IntegrationSyncPaths;
  lastError: string | null;
  lastTestedAt: string | null;
  lastConnectedAt: string | null;
  useMock: boolean;
};

export type IntegrationCredentials = {
  clientId: string;
  clientSecret: string;
  scope: string | null;
};

export type IntegrationAccount = {
  id: string | null;
  orgId: string;
  provider: IntegrationProviderKey;
  status: IntegrationConnectionStatus;
  healthStatus: IntegrationHealthStatus;
  activeEnvironment: IntegrationEnvironment;
  configVersion: number;
  createdBy: string | null;
  updatedBy: string | null;
  updatedAt: string | null;
  lastSyncedAt: string | null;
  lastHealthCheckedAt: string | null;
  lastHealthError: string | null;
  environments: Record<IntegrationEnvironment, IntegrationEnvironmentConfig>;
  credentials: Partial<Record<IntegrationEnvironment, IntegrationCredentials>>;
  rawConfig: Record<string, unknown>;
  hasCredentials: boolean;
};

export type MatterReference = {
  id: string;
  orgId: string;
  title: string;
  clientId: string | null;
  najizCaseNumber: string | null;
  assignedUserId: string | null;
  isPrivate: boolean;
};

export type SyncJobRecord = {
  id: string;
  orgId: string;
  integrationId: string | null;
  provider: IntegrationProviderKey;
  source: string;
  jobKind: SyncJobKind;
  status: SyncJobStatus;
  environment: IntegrationEnvironment;
  triggerMode: SyncTriggerMode;
  requestedBy: string | null;
  matterId: string | null;
  subjectType: string | null;
  subjectId: string | null;
  attempts: number;
  maxAttempts: number;
  retryable: boolean;
  startedAt: string;
  completedAt: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  summary: JsonObject;
  requestPayload: JsonObject;
  responsePayload: JsonObject;
  queueName: string;
  availableAt: string;
  scheduledFor: string | null;
  lockedAt: string | null;
  lockedBy: string | null;
  parentJobId: string | null;
  webhookEventId: string | null;
  dedupeKey: string | null;
  createdAt: string;
  legacyRunId: string | null;
};

export type SyncLogRecord = {
  id: string;
  jobId: string;
  orgId: string;
  provider: IntegrationProviderKey;
  level: 'info' | 'warn' | 'error';
  action: string;
  message: string;
  context: JsonObject;
  createdBy: string | null;
  createdAt: string;
};

export type NormalizedLawyerVerification = {
  provider: IntegrationProviderKey;
  source: string;
  externalId: string;
  licenseNumber: string | null;
  nationalId: string | null;
  lawyerName: string | null;
  officeName: string | null;
  status: LawyerVerificationStatus;
  verifiedAt: string | null;
  expiresAt: string | null;
  payloadJson: JsonObject;
  syncedAt: string;
};

export type NormalizedExternalCase = {
  provider: IntegrationProviderKey;
  source: string;
  externalId: string;
  caseNumber: string;
  caseReference: string | null;
  title: string;
  court: string | null;
  status: string | null;
  payloadJson: JsonObject;
  syncedAt: string;
};

export type NormalizedExternalCaseEvent = {
  provider: IntegrationProviderKey;
  source: string;
  externalCaseId: string;
  externalEventId: string;
  eventType: 'status_change' | 'session' | 'filing' | 'document' | 'timeline';
  title: string;
  description: string | null;
  occurredAt: string | null;
  payloadJson: JsonObject;
  syncedAt: string;
};

export type NormalizedJudicialCost = {
  provider: IntegrationProviderKey;
  source: string;
  externalId: string;
  externalCaseId: string | null;
  costType: JudicialCostType;
  title: string;
  amount: number;
  currency: string;
  status: JudicialCostStatus;
  invoiceReference: string | null;
  dueAt: string | null;
  payloadJson: JsonObject;
  syncedAt: string;
};

export type NormalizedExternalDocument = {
  provider: IntegrationProviderKey;
  source: string;
  externalId: string;
  externalCaseId: string | null;
  documentType: ExternalDocumentType;
  title: string;
  fileName: string;
  mimeType: string | null;
  downloadUrl: string | null;
  fileSize: number | null;
  checksum: string | null;
  issuedAt: string | null;
  portalVisible: boolean;
  payloadJson: JsonObject;
  syncedAt: string;
};

export type NormalizedSessionMinute = {
  provider: IntegrationProviderKey;
  source: string;
  externalId: string;
  externalCaseId: string | null;
  sessionReference: string | null;
  title: string;
  summary: string | null;
  occurredAt: string | null;
  minuteDocumentExternalId: string | null;
  payloadJson: JsonObject;
  syncedAt: string;
};

export type ProviderHealthResult = {
  ok: boolean;
  status: IntegrationHealthStatus;
  message: string;
  checkedAt: string;
  meta?: JsonObject;
};

export type VerifyLawyerInput = {
  lawyerUserId: string | null;
  licenseNumber: string | null;
  nationalId: string | null;
  endpointPath?: string | null;
};

export type VerifyLawyerResult = {
  verification: NormalizedLawyerVerification;
  rawPayload: JsonObject;
};

export type PowerOfAttorneyValidationStatus = 'VALID' | 'REVOKED' | 'EXPIRED' | 'UNKNOWN';

export type ValidatePowerOfAttorneyInput = {
  clientId: string;
  poaNumber: string;
  endpointPath?: string | null;
};

export type NormalizedPowerOfAttorneyValidation = {
  provider: IntegrationProviderKey;
  source: string;
  externalId: string;
  clientId: string;
  poaNumber: string;
  status: PowerOfAttorneyValidationStatus;
  isRevoked: boolean;
  holderName: string | null;
  issuedAt: string | null;
  expiresAt: string | null;
  verifiedAt: string;
  payloadJson: JsonObject;
  syncedAt: string;
};

export type ValidatePowerOfAttorneyResult = {
  validation: NormalizedPowerOfAttorneyValidation;
  rawPayload: JsonObject;
};

export type SyncCaseInput = {
  matterId?: string | null;
  caseNumber?: string | null;
  endpointPath?: string | null;
};

export type SyncCaseResult = {
  cases: NormalizedExternalCase[];
  events: NormalizedExternalCaseEvent[];
  rawPayload: JsonObject;
};

export type SyncJudicialCostsInput = {
  matterId?: string | null;
  externalCaseId?: string | null;
  caseNumber?: string | null;
  endpointPath?: string | null;
};

export type SyncJudicialCostsResult = {
  costs: NormalizedJudicialCost[];
  rawPayload: JsonObject;
};

export type SyncDocumentsInput = {
  matterId?: string | null;
  externalCaseId?: string | null;
  caseNumber?: string | null;
  endpointPath?: string | null;
};

export type SyncDocumentsResult = {
  documents: NormalizedExternalDocument[];
  rawPayload: JsonObject;
};

export type NormalizedEnforcementRequest = {
  provider: IntegrationProviderKey;
  source: string;
  externalId: string;
  externalCaseId: string | null;
  requestNumber: string | null;
  requestType: EnforcementRequestType;
  title: string;
  status: EnforcementRequestStatus;
  applicantName: string | null;
  respondentName: string | null;
  amount: number | null;
  currency: string;
  submittedAt: string | null;
  closedAt: string | null;
  payloadJson: JsonObject;
  syncedAt: string;
};

export type NormalizedEnforcementRequestEvent = {
  provider: IntegrationProviderKey;
  source: string;
  externalRequestId: string;
  externalEventId: string;
  actionType: EnforcementRequestActionType;
  title: string;
  description: string | null;
  occurredAt: string | null;
  payloadJson: JsonObject;
  syncedAt: string;
};

export type SyncEnforcementRequestsInput = {
  matterId?: string | null;
  externalCaseId?: string | null;
  caseNumber?: string | null;
  endpointPath?: string | null;
};

export type SyncEnforcementRequestsResult = {
  requests: NormalizedEnforcementRequest[];
  events: NormalizedEnforcementRequestEvent[];
  rawPayload: JsonObject;
};

export type SyncSessionMinutesInput = {
  matterId?: string | null;
  externalCaseId?: string | null;
  caseNumber?: string | null;
  endpointPath?: string | null;
};

export type SyncSessionMinutesResult = {
  minutes: NormalizedSessionMinute[];
  rawPayload: JsonObject;
};

export type IntegrationWebhookEventRecord = {
  id: string;
  orgId: string | null;
  integrationId: string | null;
  provider: IntegrationProviderKey;
  source: string;
  eventType: string;
  deliveryId: string | null;
  externalEntityId: string | null;
  status: IntegrationWebhookEventStatus;
  headersJson: JsonObject;
  payloadJson: JsonObject;
  receivedAt: string;
  processedAt: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

export type IntegrationAdminSummary = {
  totals: {
    accounts: number;
    connected: number;
    error: number;
    disconnected: number;
    healthy: number;
    degraded: number;
    queuedJobs: number;
    pendingWebhooks: number;
  };
  accounts: Array<{
    id: string;
    orgId: string;
    provider: IntegrationProviderKey;
    status: IntegrationConnectionStatus;
    healthStatus: IntegrationHealthStatus;
    activeEnvironment: IntegrationEnvironment;
    lastSyncedAt: string | null;
    updatedAt: string | null;
  }>;
  jobs: SyncJobRecord[];
  logs: SyncLogRecord[];
  webhooks?: IntegrationWebhookEventRecord[];
};
