import { loadSession } from '../../lib/session';

const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim().replace(/\/+$/, '');

async function resolveOfficeOrgId(token: string, orgId?: string | null) {
  if (orgId) {
    return orgId;
  }

  const session = await loadSession().catch(() => null);
  if (!session || session.kind !== 'office' || session.token !== token) {
    return null;
  }

  return session.orgId ?? null;
}

function buildUrl(path: string, query?: Record<string, string | number | boolean | undefined | null>) {
  if (!apiBaseUrl) {
    throw new Error('EXPO_PUBLIC_API_BASE_URL is not configured.');
  }

  const url = new URL(path.startsWith('/') ? path : `/${path}`, apiBaseUrl);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === '') continue;
      url.searchParams.set(key, String(value));
    }
  }

  return url.toString();
}

async function parseJson<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type') ?? '';
  const raw = await response.text().catch(() => '');
  let payload = {} as T & { error?: string };
  if (contentType.includes('application/json') && raw) {
    try {
      payload = JSON.parse(raw) as T & { error?: string };
    } catch {
      payload = {} as T & { error?: string };
    }
  }
  if (!response.ok) {
    if ((payload as { error?: string }).error) {
      throw new Error((payload as { error?: string }).error as string);
    }

    if (raw.includes('<!DOCTYPE html>') || raw.includes('<html')) {
      throw new Error('الخدمة المطلوبة غير متاحة على هذا الرابط حالياً. حدّث بيئة التطبيق ثم أعد المحاولة.');
    }

    throw new Error(`تعذر إكمال الطلب. (${response.status})`);
  }
  return payload;
}

function buildCookieHeader(session: { token: string; orgId?: string | null }, orgId?: string | null) {
  const cookies = [`masar-session=${encodeURIComponent(session.token)}`];
  const activeOrgId = orgId ?? session.orgId;
  if (activeOrgId) {
    cookies.push(`active_org_id=${encodeURIComponent(activeOrgId)}`);
  }
  return cookies.join('; ');
}

async function getJson<T>(path: string, token: string, query?: Record<string, string | number | boolean | undefined | null>) {
  const orgId = await resolveOfficeOrgId(token);
  const response = await fetch(buildUrl(path, query), {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      ...(orgId ? { 'x-org-id': orgId } : {}),
    },
  });

  return parseJson<T>(response);
}

async function requestJson<T>(
  path: string,
  session: { token: string; orgId?: string | null },
  init: RequestInit,
) {
  const orgId = await resolveOfficeOrgId(session.token, session.orgId);
  const response = await fetch(buildUrl(path), {
    ...init,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${session.token}`,
      ...(init.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      Cookie: buildCookieHeader(session, orgId),
      ...(orgId ? { 'x-org-id': orgId } : {}),
      ...(init.headers ?? {}),
    },
  });

  return parseJson<T>(response);
}

async function postWebRoute<T>(
  webPath: string,
  session: { token: string; orgId?: string | null },
  body: unknown,
) {
  return requestJson<T>(webPath, session, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

async function readLocalFileBlob(file: { uri: string }) {
  const source = await fetch(file.uri);
  if (!source.ok) {
    throw new Error('تعذر قراءة الملف من الجهاز.');
  }

  return source.blob();
}

async function putBlobToSignedUrl(url: string, blob: Blob, mimeType?: string | null) {
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': mimeType || 'application/octet-stream',
    },
    body: blob,
  });

  if (!response.ok) {
    throw new Error('تعذر رفع الملف إلى التخزين.');
  }
}

function buildAuthenticatedUrl(path: string, session: { token: string; orgId?: string | null }) {
  if (!apiBaseUrl) {
    throw new Error('EXPO_PUBLIC_API_BASE_URL is not configured.');
  }

  const url = new URL(path.startsWith('/') ? path : `/${path}`, `${apiBaseUrl}/`);
  url.searchParams.set('access_token', session.token);
  const orgId = session.orgId?.trim();
  if (orgId) {
    url.searchParams.set('org_id', orgId);
  }
  return url.toString();
}

export type OfficeOverviewResponse = {
  user: {
    id: string;
    email: string;
    full_name: string | null;
  };
  org: {
    id: string;
    name: string | null;
  } | null;
  role: {
    name: string | null;
    is_admin: boolean;
    has_partner_access: boolean;
  };
  counts: {
    clients: number;
    open_matters: number;
    open_tasks: number;
    unpaid_invoices: number;
    documents: number;
    quotes: number;
    upcoming_items: number;
    notifications: number;
  };
  highlights: {
    tasks: OfficeTask[];
    documents: OfficeDocument[];
    invoices: OfficeInvoice[];
    quotes: OfficeQuote[];
    calendar: OfficeCalendarItem[];
    notifications: OfficeNotification[];
  };
};

export type OfficeTask = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_at: string | null;
  updated_at: string | null;
  is_archived: boolean;
  matter_id: string | null;
  matter_title: string | null;
  assignee_id: string | null;
  is_overdue: boolean;
};

export type OfficeDocument = {
  id: string;
  title: string;
  description: string | null;
  folder: string;
  created_at: string | null;
  is_archived: boolean;
  matter_id: string | null;
  matter_title: string | null;
  client_id: string | null;
  client_name: string | null;
  tags: string[];
  latest_version: {
    version_no: number;
    file_name: string;
    file_size: number;
    mime_type: string | null;
    created_at: string | null;
    storage_path: string;
  } | null;
};

export type OfficeClient = {
  id: string;
  org_id: string;
  type: 'person' | 'company';
  name: string;
  identity_no: string | null;
  commercial_no: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  agency_number?: string | null;
  address: string | null;
  status: 'active' | 'archived' | string;
  created_at: string | null;
  updated_at: string | null;
};

export type OfficeInvoice = {
  id: string;
  number: string;
  status: string;
  total: number;
  currency: string;
  issued_at: string | null;
  due_at: string | null;
  is_archived?: boolean;
  matter_id: string | null;
  matter_title: string | null;
  client_id: string;
  client_name: string | null;
};

export type OfficeQuote = {
  id: string;
  number: string;
  status: string;
  total: number;
  currency: string;
  created_at: string | null;
  matter_id: string | null;
  matter_title: string | null;
  client_id: string;
  client_name: string | null;
};

export type OfficeInvoiceDetails = {
  invoice: OfficeInvoice & {
    org_id: string;
    subtotal: number;
    tax: number;
    items: OfficeBillingItem[];
    tax_enabled?: boolean;
    tax_number?: string | null;
    created_by?: string | null;
    client?: {
      id: string;
      name: string | null;
    } | null;
    matter?: {
      id: string;
      title: string | null;
    } | null;
  };
  payments: Array<{
    id: string;
    amount: number;
    method: string | null;
    paid_at: string | null;
    note: string | null;
    created_at: string | null;
  }>;
};

export type OfficeQuoteDetails = {
  quote: OfficeQuote & {
    org_id: string;
    subtotal: number;
    tax: number;
    items: OfficeBillingItem[];
    tax_enabled?: boolean;
    tax_number?: string | null;
    created_by?: string | null;
    created_at?: string | null;
    client?: {
      id: string;
      name: string | null;
    } | null;
    matter?: {
      id: string;
      title: string | null;
    } | null;
  };
};

export type OfficeCalendarItem = {
  id: string;
  kind: 'hearing' | 'meeting' | 'event' | 'task' | 'invoice';
  title: string;
  date: string | null;
  start_at: string | null;
  end_at: string | null;
  matter_id: string | null;
  matter_title: string | null;
  note: string | null;
  source_label: string;
};

export type OfficeNotification = {
  id: string;
  source: string | null;
  category: string | null;
  title: string;
  body: string | null;
  entity_type: string | null;
  entity_id: string | null;
  created_at: string | null;
};

export type OfficeTasksResponse = {
  data: OfficeTask[];
  page: number;
  limit: number;
  total: number;
};

export type OfficeDocumentsResponse = {
  data: OfficeDocument[];
  page: number;
  limit: number;
  total: number;
};

export type OfficeBillingResponse = {
  invoices: {
    data: OfficeInvoice[];
    page: number;
    limit: number;
    total: number;
  };
  quotes: {
    data: OfficeQuote[];
    page: number;
    limit: number;
    total: number;
  };
};

export type OfficeCalendarResponse = {
  items: OfficeCalendarItem[];
  from: string;
  to: string;
};

export type OfficeNotificationsResponse = {
  data: OfficeNotification[];
  page: number;
  limit: number;
  total: number;
};

export type OfficeClientsResponse = {
  data: OfficeClient[];
  page: number;
  limit: number;
  total: number;
};

export async function fetchOfficeOverview(token: string) {
  return getJson<OfficeOverviewResponse>('/api/mobile/office/overview', token);
}

export async function fetchOfficeTasks(
  token: string,
  query?: Record<string, string | number | boolean | undefined | null>,
) {
  return getJson<OfficeTasksResponse>('/api/mobile/office/tasks', token, query);
}

export async function fetchOfficeDocuments(
  token: string,
  query?: Record<string, string | number | boolean | undefined | null>,
) {
  return getJson<OfficeDocumentsResponse>('/api/mobile/office/documents', token, query);
}

export async function fetchOfficeBilling(
  token: string,
  query?: Record<string, string | number | boolean | undefined | null>,
) {
  return getJson<OfficeBillingResponse>('/api/mobile/office/billing', token, query);
}

export async function fetchOfficeInvoiceDetails(session: OfficeMutationSession, invoiceId: string) {
  return requestJson<OfficeInvoiceDetails>(`/api/mobile/office/billing/invoices/${invoiceId}`, session, {
    method: 'GET',
  });
}

export async function fetchOfficeQuoteDetails(session: OfficeMutationSession, quoteId: string) {
  return requestJson<OfficeQuoteDetails>(`/api/mobile/office/billing/quotes/${quoteId}`, session, {
    method: 'GET',
  });
}

export async function fetchOfficeCalendar(
  token: string,
  query?: Record<string, string | number | boolean | undefined | null>,
) {
  return getJson<OfficeCalendarResponse>('/api/mobile/office/calendar', token, query);
}

export async function fetchOfficeNotifications(
  token: string,
  query?: Record<string, string | number | boolean | undefined | null>,
) {
  return getJson<OfficeNotificationsResponse>('/api/mobile/office/notifications', token, query);
}

export async function fetchOfficeClients(
  token: string,
  query?: Record<string, string | number | boolean | undefined | null>,
) {
  return getJson<OfficeClientsResponse>('/api/mobile/office/clients', token, query);
}

export type OfficeMutationSession = {
  token: string;
  orgId: string | null | undefined;
};

export type OfficeTaskWritePayload = {
  id?: string;
  title: string;
  description?: string | null;
  matter_id?: string | null;
  assignee_id?: string | null;
  due_at?: string | null;
  priority?: 'low' | 'medium' | 'high';
  status?: 'todo' | 'doing' | 'done' | 'canceled';
};

export async function createOfficeTask(session: OfficeMutationSession, payload: OfficeTaskWritePayload) {
  return requestJson<{ task: OfficeTask }>('/api/mobile/office/tasks', session, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateOfficeTask(session: OfficeMutationSession, payload: OfficeTaskWritePayload & { id: string }) {
  return requestJson<{ task: OfficeTask }>(`/api/mobile/office/tasks/${payload.id}`, session, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function setOfficeTaskStatus(
  session: OfficeMutationSession,
  payload: { id: string; status: 'todo' | 'doing' | 'done' | 'canceled' },
) {
  return postWebRoute<{ task: OfficeTask }>('/api/tasks/status', session, payload);
}

export async function archiveOfficeTask(session: OfficeMutationSession, payload: { id: string; archived: boolean }) {
  return postWebRoute<{ task: OfficeTask }>('/api/tasks/archive', session, payload);
}

export async function deleteOfficeTask(session: OfficeMutationSession, payload: { id: string }) {
  return requestJson<{ success?: boolean; ok?: boolean }>(`/api/mobile/office/tasks/${payload.id}`, session, {
    method: 'DELETE',
  });
}

export type OfficeDocumentWritePayload = {
  title: string;
  matter_id?: string | null;
  client_id?: string | null;
  folder?: string | null;
  tags?: string[] | string | null;
};

export async function createOfficeDocument(session: OfficeMutationSession, payload: OfficeDocumentWritePayload) {
  return postWebRoute<{ document: OfficeDocument }>('/api/documents/create', session, payload);
}

export async function requestOfficeDocumentUploadUrl(
  session: OfficeMutationSession,
  payload: {
    document_id: string;
    file_name: string;
    file_size: number;
    mime_type?: string | null;
  },
) {
  return postWebRoute<{
    bucket: string;
    storage_path: string;
    version_no: number;
    token: string;
    signedUrl: string;
  }>('/api/documents/upload-url', session, payload);
}

export async function commitOfficeDocumentUpload(
  session: OfficeMutationSession,
  payload: {
    document_id: string;
    version_no: number;
    storage_path: string;
    file_name: string;
    file_size: number;
    mime_type?: string | null;
  },
) {
  return postWebRoute<{ version: unknown }>('/api/documents/commit-upload', session, payload);
}

export async function shareOfficeDocument(
  session: OfficeMutationSession,
  payload: { document_id: string; expires_in: '1h' | '24h' | '7d' },
) {
  return postWebRoute<{ shareUrl: string }>('/api/documents/share', session, payload);
}

export async function requestOfficeDocumentDownloadUrl(
  session: OfficeMutationSession,
  payload: { document_id: string; storage_path?: string | null; version_id?: string; version_no?: number },
) {
  return requestJson<{ signedDownloadUrl: string; storage_path: string }>(
    `/api/mobile/office/documents/${payload.document_id}/download-url`,
    session,
    {
      method: 'POST',
      body: JSON.stringify({
        storage_path: payload.storage_path ?? null,
        version_id: payload.version_id,
        version_no: payload.version_no,
      }),
    },
  );
}

export async function uploadOfficeDocumentFile(
  session: OfficeMutationSession,
  payload: {
    title: string;
    matterId?: string | null;
    clientId?: string | null;
    folder?: string | null;
    tags?: string[] | string | null;
    file?: { uri: string; name: string; mimeType?: string | null; size: number } | null;
  },
) {
  if (!payload.file) {
    const created = await requestJson<{ document: OfficeDocument }>('/api/mobile/office/documents', session, {
      method: 'POST',
      body: JSON.stringify({
        title: payload.title,
        matter_id: payload.matterId ?? null,
        client_id: payload.clientId ?? null,
        folder: payload.folder ?? null,
        tags: payload.tags ?? null,
      }),
    });

    return { document: created.document, uploaded: false as const };
  }

  const form = new FormData();
  form.append('title', payload.title);
  if (payload.matterId) form.append('matter_id', payload.matterId);
  if (payload.clientId) form.append('client_id', payload.clientId);
  if (payload.folder) form.append('folder', payload.folder);
  if (payload.tags) {
    const tags = Array.isArray(payload.tags) ? payload.tags : String(payload.tags).split(',');
    form.append('tags', JSON.stringify(tags.map((item) => String(item).trim()).filter(Boolean)));
  }
  form.append('file', {
    uri: payload.file.uri,
    name: payload.file.name,
    type: payload.file.mimeType ?? 'application/octet-stream',
  } as any);

  const result = await requestJson<{ document: OfficeDocument; version: unknown; ok: true }>(
    '/api/mobile/office/documents/upload',
    session,
    {
      method: 'POST',
      body: form,
    },
  );

  return { document: result.document, version: result.version, uploaded: true as const };
}

export async function addOfficeDocumentVersion(
  session: OfficeMutationSession,
  payload: {
    document_id: string;
    file: { uri: string; name: string; mimeType?: string | null };
  },
) {
  const form = new FormData();
  form.append('file', {
    uri: payload.file.uri,
    name: payload.file.name,
    type: payload.file.mimeType ?? 'application/octet-stream',
  } as any);

  return requestJson<{ version: unknown }>(`/api/mobile/office/documents/${payload.document_id}/versions`, session, {
    method: 'POST',
    body: form,
  });
}

export async function archiveOfficeDocument(
  session: OfficeMutationSession,
  payload: { id: string; archived: boolean },
) {
  const response = await requestJson<{ document: OfficeDocument }>(
    `/api/mobile/office/documents/${payload.id}/archive`,
    session,
    {
      method: 'POST',
      body: JSON.stringify({ archived: payload.archived }),
    },
  );
  return response.document;
}

export type OfficeClientWritePayload = {
  id?: string;
  type: 'person' | 'company';
  name: string;
  identity_no?: string | null;
  commercial_no?: string | null;
  email: string;
  phone?: string | null;
  notes?: string | null;
  agency_number?: string | null;
  address?: string | null;
  status?: 'active' | 'archived';
};

export async function createOfficeClient(session: OfficeMutationSession, payload: OfficeClientWritePayload) {
  const response = await requestJson<{ client: OfficeClient }>('/api/mobile/office/clients', session, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return response.client;
}

export async function updateOfficeClient(session: OfficeMutationSession, payload: OfficeClientWritePayload & { id: string }) {
  const response = await requestJson<{ client: OfficeClient }>(`/api/mobile/office/clients/${payload.id}`, session, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  return response.client;
}

export async function deleteOfficeClient(session: OfficeMutationSession, payload: { id: string }) {
  return requestJson<{ success?: boolean }>(`/api/mobile/office/clients/${payload.id}`, session, {
    method: 'DELETE',
  });
}

export type OfficeMatterWritePayload = {
  id?: string;
  client_id?: string | null;
  title: string;
  status?: 'new' | 'in_progress' | 'on_hold' | 'closed' | 'archived';
  summary?: string | null;
  najiz_case_number?: string | null;
  case_type?: string | null;
  claims?: string | null;
  assigned_user_id?: string | null;
  is_private?: boolean;
};

export async function createOfficeMatter(session: OfficeMutationSession, payload: OfficeMatterWritePayload) {
  const response = await requestJson<{ matter: { id: string; title: string } & Record<string, unknown> }>(
    '/api/mobile/office/matters',
    session,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
  return response.matter;
}

export async function updateOfficeMatter(session: OfficeMutationSession, payload: OfficeMatterWritePayload & { id: string }) {
  const response = await requestJson<{ matter: { id: string; title: string } & Record<string, unknown> }>(
    `/api/mobile/office/matters/${payload.id}`,
    session,
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    },
  );
  return response.matter;
}

export async function deleteOfficeMatter(session: OfficeMutationSession, payload: { id: string }) {
  return requestJson<{ success?: boolean }>(`/api/mobile/office/matters/${payload.id}`, session, {
    method: 'DELETE',
  });
}

export type OfficeBillingItem = {
  desc: string;
  qty: number;
  unit_price: number;
};

export type OfficeQuoteWritePayload = {
  client_id: string;
  matter_id?: string | null;
  items: OfficeBillingItem[];
  tax?: number;
  tax_enabled?: boolean;
  tax_number?: string | null;
  status?: 'draft' | 'sent' | 'accepted' | 'rejected';
};

export type OfficeInvoiceWritePayload = {
  client_id: string;
  matter_id?: string | null;
  items: OfficeBillingItem[];
  tax?: number;
  tax_enabled?: boolean;
  tax_number?: string | null;
  due_at?: string | null;
  status?: 'unpaid' | 'partial' | 'paid' | 'void';
};

export async function createOfficeQuote(session: OfficeMutationSession, payload: OfficeQuoteWritePayload) {
  const response = await requestJson<{ quote: OfficeQuote }>('/api/mobile/office/billing/quotes', session, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return response.quote;
}

export async function updateOfficeQuote(session: OfficeMutationSession, payload: OfficeQuoteWritePayload & { id: string }) {
  const response = await requestJson<{ quote: OfficeQuote }>(`/api/mobile/office/billing/quotes/${payload.id}`, session, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  return response.quote;
}

export async function createOfficeInvoice(session: OfficeMutationSession, payload: OfficeInvoiceWritePayload) {
  const response = await requestJson<{ invoice: OfficeInvoice }>('/api/mobile/office/billing/invoices', session, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return response.invoice;
}

export async function updateOfficeInvoice(session: OfficeMutationSession, payload: OfficeInvoiceWritePayload & { id: string }) {
  const response = await requestJson<{ invoice: OfficeInvoice }>(`/api/mobile/office/billing/invoices/${payload.id}`, session, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  return response.invoice;
}

export async function archiveOfficeInvoice(session: OfficeMutationSession, payload: { id: string; archived: boolean }) {
  const response = await requestJson<{ invoice: OfficeInvoice }>(
    `/api/mobile/office/billing/invoices/${payload.id}/archive`,
    session,
    {
      method: 'POST',
      body: JSON.stringify({ archived: payload.archived }),
    },
  );
  return response.invoice;
}

export async function addOfficeInvoicePayment(
  session: OfficeMutationSession,
  payload: {
    invoice_id: string;
    amount: number;
    method?: string | null;
    paid_at?: string | null;
    note?: string | null;
  },
) {
  return requestJson<{
    payment: {
      id: string;
      amount: number;
      method: string | null;
      paid_at: string | null;
      note: string | null;
      created_at: string | null;
    };
    invoice: OfficeInvoice;
    paidAmount: number;
  }>(`/api/mobile/office/billing/invoices/${payload.invoice_id}/payments`, session, {
    method: 'POST',
    body: JSON.stringify({
      amount: payload.amount,
      method: payload.method ?? null,
      paid_at: payload.paid_at ?? null,
    note: payload.note ?? null,
    }),
  });
}

export function buildOfficeInvoicePdfUrl(session: OfficeMutationSession, invoiceId: string) {
  return buildAuthenticatedUrl(`/api/mobile/office/billing/invoices/${invoiceId}/pdf`, session);
}

export function buildOfficeQuotePdfUrl(session: OfficeMutationSession, quoteId: string) {
  return buildAuthenticatedUrl(`/api/mobile/office/billing/quotes/${quoteId}/pdf`, session);
}
