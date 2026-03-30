import {
  buildOfficeInvoicePdfUrl,
  buildOfficeQuotePdfUrl,
  requestOfficeDocumentDownloadUrl,
  sendOfficeInvoiceEmail,
  type OfficeDocument,
} from '../features/office/api';
import {
  exportRemoteFileToDevice,
  openRemoteFileInApp,
  shareRemoteFileFromDevice,
} from '../lib/file-actions';

type OfficeSessionRef = {
  token: string;
  orgId?: string | null;
};

function buildBillingRemote(session: OfficeSessionRef, kind: 'invoice' | 'quote', id: string, number: string) {
  return {
    url:
      kind === 'invoice'
        ? buildOfficeInvoicePdfUrl({ token: session.token, orgId: session.orgId }, id)
        : buildOfficeQuotePdfUrl({ token: session.token, orgId: session.orgId }, id),
    fileName: `${kind}-${number}.pdf`,
    mimeType: 'application/pdf',
  };
}

async function resolveOfficeDocumentRemote(session: OfficeSessionRef, document: OfficeDocument) {
  if (!document.latest_version?.storage_path) {
    throw new Error('لا توجد نسخة قابلة للوصول لهذا المستند.');
  }

  const result = await requestOfficeDocumentDownloadUrl(
    { token: session.token, orgId: session.orgId },
    { document_id: document.id, storage_path: document.latest_version.storage_path },
  );

  return {
    url: result.signedDownloadUrl,
    fileName: document.latest_version.file_name || `${document.title}.pdf`,
    mimeType: document.latest_version.mime_type,
  };
}

export async function openOfficeDocumentInApp(session: OfficeSessionRef, document: OfficeDocument) {
  const remote = await resolveOfficeDocumentRemote(session, document);
  await openRemoteFileInApp(remote);
}

export async function downloadOfficeDocumentToDevice(session: OfficeSessionRef, document: OfficeDocument) {
  const remote = await resolveOfficeDocumentRemote(session, document);
  await exportRemoteFileToDevice(remote);
}

export async function shareOfficeDocumentFromDevice(session: OfficeSessionRef, document: OfficeDocument) {
  const remote = await resolveOfficeDocumentRemote(session, document);
  await shareRemoteFileFromDevice(remote);
}

export async function openOfficeBillingPdfInApp(
  session: OfficeSessionRef,
  kind: 'invoice' | 'quote',
  id: string,
  number: string,
) {
  const remote = buildBillingRemote(session, kind, id, number);
  await openRemoteFileInApp(remote);
}

export async function downloadOfficeBillingPdfToDevice(
  session: OfficeSessionRef,
  kind: 'invoice' | 'quote',
  id: string,
  number: string,
) {
  const remote = buildBillingRemote(session, kind, id, number);
  await exportRemoteFileToDevice(remote);
}

export async function shareOfficeBillingPdfFromDevice(
  session: OfficeSessionRef,
  kind: 'invoice' | 'quote',
  id: string,
  number: string,
) {
  const remote = buildBillingRemote(session, kind, id, number);
  await shareRemoteFileFromDevice(remote);
}

export async function sendOfficeBillingInvoiceEmail(
  session: OfficeSessionRef,
  payload: {
    invoice_id: string;
    to_email?: string;
    message_optional?: string;
  },
) {
  return sendOfficeInvoiceEmail({ token: session.token, orgId: session.orgId }, payload);
}
