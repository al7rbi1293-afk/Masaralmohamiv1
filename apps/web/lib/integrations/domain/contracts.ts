import type {
  IntegrationActor,
  IntegrationAccount,
  ProviderHealthResult,
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
} from './models';

export type ProviderExecutionContext = {
  actor: IntegrationActor;
  account: IntegrationAccount;
};

export interface IntegrationProvider {
  readonly providerKey: IntegrationAccount['provider'];

  getHealthStatus(context: ProviderExecutionContext): Promise<ProviderHealthResult>;

  verifyLawyer(input: VerifyLawyerInput, context: ProviderExecutionContext): Promise<VerifyLawyerResult>;

  syncCase(input: SyncCaseInput, context: ProviderExecutionContext): Promise<SyncCaseResult>;

  syncJudicialCosts(
    input: SyncJudicialCostsInput,
    context: ProviderExecutionContext,
  ): Promise<SyncJudicialCostsResult>;

  syncEnforcementRequests(
    input: SyncEnforcementRequestsInput,
    context: ProviderExecutionContext,
  ): Promise<SyncEnforcementRequestsResult>;

  syncDocuments(
    input: SyncDocumentsInput,
    context: ProviderExecutionContext,
  ): Promise<SyncDocumentsResult>;

  syncSessionMinutes(
    input: SyncSessionMinutesInput,
    context: ProviderExecutionContext,
  ): Promise<SyncSessionMinutesResult>;
}
