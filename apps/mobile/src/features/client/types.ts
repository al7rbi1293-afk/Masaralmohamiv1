export type ClientPortalMatterEvent = {
  id: string;
  type: string;
  note: string | null;
  event_date: string | null;
  created_at: string | null;
  created_by_name: string | null;
};

export type ClientPortalMatterCommunication = {
  id: string;
  sender: 'CLIENT' | 'LAWYER' | string;
  message: string;
  created_at: string | null;
};

export type ClientPortalMatter = {
  id: string;
  title: string;
  status: string;
  summary: string | null;
  case_type: string | null;
  updated_at: string;
  events: ClientPortalMatterEvent[];
  communications: ClientPortalMatterCommunication[];
};

export type ClientPortalInvoice = {
  id: string;
  number: string;
  status: string;
  total: number;
  remaining_amount: number;
  paid_amount: number;
  currency: string;
  issued_at: string | null;
  due_at: string | null;
  matter_title: string | null;
};

export type ClientPortalQuote = {
  id: string;
  number: string;
  status: string;
  total: number;
  currency: string;
  created_at: string;
  matter_title: string | null;
};

export type ClientPortalDocumentVersion = {
  version_no: number;
  storage_path: string;
  file_name: string;
  file_size: number;
  mime_type: string | null;
  created_at: string | null;
};

export type ClientPortalDocument = {
  id: string;
  title: string;
  matter_id: string | null;
  matter_title: string | null;
  created_at: string;
  latest_version: ClientPortalDocumentVersion | null;
  is_external_sync: boolean;
  source: string | null;
  source_document_type: string | null;
  source_synced_at: string | null;
  processing_status: string | null;
};

export type ClientPortalBootstrap = {
  session: {
    portal_user_id: string;
    email: string;
  };
  client: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    identity_no: string | null;
    commercial_no: string | null;
  };
  counts: {
    matters: number;
    invoices: number;
    quotes: number;
    documents: number;
    outstanding_balance: number;
  };
  matters: ClientPortalMatter[];
  invoices: ClientPortalInvoice[];
  quotes: ClientPortalQuote[];
  documents: ClientPortalDocument[];
};

export type ClientPortalRequestItem = {
  id: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  firm_name: string | null;
  message: string | null;
  source: string;
  created_at: string;
};

export type ClientPortalNotificationItem = {
  id: string;
  kind: 'matter_event' | 'invoice' | 'document' | 'request' | 'system';
  title: string;
  body: string;
  created_at: string;
  status: string | null;
  matter_title: string | null;
  invoice_number: string | null;
  document_title: string | null;
};

export type ClientPortalOverview = {
  bootstrap: ClientPortalBootstrap;
  requests: ClientPortalRequestItem[];
  notifications: ClientPortalNotificationItem[];
};

export type ClientPortalUploadedDocument = {
  ok: true;
  message: string;
  document: {
    id: string;
    title: string;
    matter_id: string | null;
    matter_title: string | null;
    created_at: string;
  };
  version: {
    id: string;
    version_no: number;
    storage_path: string;
    file_name: string;
    file_size: number;
    mime_type: string | null;
    created_at: string;
  };
};

export type ClientPortalDownloadUrlResponse = {
  signedDownloadUrl: string;
};

export type ClientPortalPdfUrlResponse = {
  signedDownloadUrl: string;
  fileName: string;
};

export type ClientPortalCommunicationResponse = {
  success: true;
  communication: ClientPortalMatterCommunication;
};
