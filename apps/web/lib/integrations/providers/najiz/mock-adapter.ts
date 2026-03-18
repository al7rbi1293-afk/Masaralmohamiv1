import 'server-only';

import crypto from 'crypto';
import type {
  IntegrationAccount,
  JsonObject,
  SyncCaseInput,
  SyncDocumentsInput,
  SyncEnforcementRequestsInput,
  SyncJudicialCostsInput,
  SyncSessionMinutesInput,
  VerifyLawyerInput,
} from '../../domain/models';
import type { NajizProviderAdapter } from './adapter';

function stableSeed(...parts: Array<string | null | undefined>) {
  return crypto.createHash('sha1').update(parts.filter(Boolean).join(':')).digest('hex');
}

function pickFromSeed(seed: string, values: string[]) {
  const index = parseInt(seed.slice(0, 8), 16) % values.length;
  return values[index] ?? values[0]!;
}

export class NajizMockAdapter implements NajizProviderAdapter {
  async checkHealth(account: IntegrationAccount) {
    return {
      message: 'تم التحقق من الاتصال عبر mock adapter.',
      rawPayload: {
        adapter: 'mock',
        environment: account.activeEnvironment,
        ok: true,
      },
    };
  }

  async fetchLawyerVerification(account: IntegrationAccount, input: VerifyLawyerInput): Promise<JsonObject> {
    const seed = stableSeed(account.orgId, input.licenseNumber, input.nationalId, input.lawyerUserId);
    const status = pickFromSeed(seed, ['verified', 'verified', 'mismatch', 'not_found']);
    const licenseNumber = input.licenseNumber || `LIC-${seed.slice(0, 8).toUpperCase()}`;
    return {
      data: {
        id: `lawyer-${seed.slice(0, 12)}`,
        license_number: licenseNumber,
        national_id: input.nationalId,
        lawyer_name: `محامٍ تجريبي ${seed.slice(0, 4).toUpperCase()}`,
        office_name: 'مكتب مسار التجريبي',
        status,
        verified_at: new Date().toISOString(),
      },
      mock: true,
    };
  }

  async fetchCases(account: IntegrationAccount, input: SyncCaseInput): Promise<JsonObject> {
    const caseNumber = input.caseNumber || `NC-${stableSeed(account.orgId, input.matterId).slice(0, 8).toUpperCase()}`;
    const seed = stableSeed(account.orgId, caseNumber);
    const status = pickFromSeed(seed, ['منظورة', 'قيد المرافعة', 'محجوزة للحكم']);

    return {
      cases: [
        {
          external_id: caseNumber,
          case_number: caseNumber,
          title: `قضية تجريبية ${caseNumber}`,
          court_name: pickFromSeed(seed.slice(2), ['المحكمة العامة بالرياض', 'المحكمة التجارية بجدة']),
          status,
          events: [
            {
              event_id: `${caseNumber}-session-1`,
              event_type: 'session',
              title: 'جلسة أولى',
              description: 'تمت إضافة الجلسة الأولى من mock adapter.',
              occurred_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
            },
            {
              event_id: `${caseNumber}-status`,
              event_type: 'status_change',
              title: 'تحديث حالة القضية',
              description: `الحالة الحالية: ${status}`,
              occurred_at: new Date().toISOString(),
            },
          ],
        },
      ],
      mock: true,
    };
  }

  async fetchJudicialCosts(account: IntegrationAccount, input: SyncJudicialCostsInput): Promise<JsonObject> {
    const caseNumber =
      input.caseNumber || `NC-${stableSeed(account.orgId, input.matterId, input.externalCaseId).slice(0, 8).toUpperCase()}`;
    const seed = stableSeed(account.orgId, caseNumber, 'judicial-costs');

    return {
      costs: [
        {
          external_id: `${caseNumber}-fee-1`,
          case_number: caseNumber,
          cost_type: 'judicial_cost',
          title: 'رسم قيد الدعوى',
          amount: (parseInt(seed.slice(0, 4), 16) % 5000) + 500,
          currency: 'SAR',
          status: pickFromSeed(seed, ['pending', 'paid', 'overdue']),
          invoice_reference: `INV-${seed.slice(0, 6).toUpperCase()}`,
          due_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        },
      ],
      mock: true,
    };
  }

  async fetchEnforcementRequests(account: IntegrationAccount, input: SyncEnforcementRequestsInput): Promise<JsonObject> {
    const caseNumber =
      input.caseNumber || `NC-${stableSeed(account.orgId, input.matterId, input.externalCaseId).slice(0, 8).toUpperCase()}`;
    const seed = stableSeed(account.orgId, caseNumber, 'enforcement');
    const requestNumber = `ENF-${seed.slice(0, 8).toUpperCase()}`;
    const status = pickFromSeed(seed, ['submitted', 'in_progress', 'under_review', 'resolved']);

    return {
      requests: [
        {
          external_id: requestNumber,
          request_number: requestNumber,
          case_number: caseNumber,
          request_type: pickFromSeed(seed.slice(2), ['execution_order', 'payment', 'attachment']),
          title: `طلب تنفيذ ${requestNumber}`,
          status,
          applicant_name: 'شركة تجريبية طالبة التنفيذ',
          respondent_name: 'المنفذ ضده التجريبي',
          amount: (parseInt(seed.slice(0, 5), 16) % 20000) + 1000,
          currency: 'SAR',
          submitted_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
          events: [
            {
              event_id: `${requestNumber}-submitted`,
              action_type: 'status_change',
              title: 'تقديم طلب التنفيذ',
              description: 'تم تسجيل الطلب في بيئة الاختبار.',
              occurred_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
            },
            {
              event_id: `${requestNumber}-status`,
              action_type: 'timeline',
              title: 'آخر تحديث',
              description: `حالة الطلب الحالية: ${status}`,
              occurred_at: new Date().toISOString(),
            },
          ],
        },
      ],
      mock: true,
    };
  }

  async fetchDocuments(account: IntegrationAccount, input: SyncDocumentsInput): Promise<JsonObject> {
    const caseNumber =
      input.caseNumber || `NC-${stableSeed(account.orgId, input.matterId, input.externalCaseId).slice(0, 8).toUpperCase()}`;
    const seed = stableSeed(account.orgId, caseNumber, 'documents');
    const documentId = `DOC-${seed.slice(0, 10).toUpperCase()}`;

    return {
      documents: [
        {
          external_id: documentId,
          case_number: caseNumber,
          document_type: pickFromSeed(seed, ['judgment', 'evidence', 'notice']),
          title: `مستند ناجز ${documentId}`,
          file_name: `${documentId}.pdf`,
          mime_type: 'application/pdf',
          download_url: `https://sandbox.najiz.example/documents/${documentId}.pdf`,
          file_size: (parseInt(seed.slice(0, 4), 16) % 2_000_000) + 150_000,
          sha256: stableSeed(documentId, 'checksum'),
          issued_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          portal_visible: true,
        },
      ],
      mock: true,
    };
  }

  async fetchSessionMinutes(account: IntegrationAccount, input: SyncSessionMinutesInput): Promise<JsonObject> {
    const caseNumber =
      input.caseNumber || `NC-${stableSeed(account.orgId, input.matterId, input.externalCaseId).slice(0, 8).toUpperCase()}`;
    const seed = stableSeed(account.orgId, caseNumber, 'session-minutes');
    const minuteId = `MIN-${seed.slice(0, 10).toUpperCase()}`;
    const documentId = `DOC-${seed.slice(2, 12).toUpperCase()}`;

    return {
      session_minutes: [
        {
          external_id: minuteId,
          case_number: caseNumber,
          session_reference: `SESSION-${seed.slice(0, 6).toUpperCase()}`,
          title: `محضر جلسة ${caseNumber}`,
          summary: 'تمت المرافعة وتأجيل النظر مع طلب مستندات إضافية.',
          occurred_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          minute_document_id: documentId,
        },
      ],
      mock: true,
    };
  }
}
