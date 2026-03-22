import { Platform } from 'react-native';
import {
  type ClientPortalBootstrap,
  type ClientPortalCommunicationResponse,
  type ClientPortalDownloadUrlResponse,
  type ClientPortalNotificationItem,
  type ClientPortalOverview,
  type ClientPortalRequestItem,
  type ClientPortalUploadedDocument,
} from './types';

const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim().replace(/\/+$/, '');

function buildUrl(path: string) {
  if (!apiBaseUrl) {
    throw new Error('EXPO_PUBLIC_API_BASE_URL is not configured.');
  }

  return `${apiBaseUrl}${path.startsWith('/') ? path : `/${path}`}`;
}

function buildAuthenticatedUrl(path: string, token: string) {
  if (!apiBaseUrl) {
    throw new Error('EXPO_PUBLIC_API_BASE_URL is not configured.');
  }
  const url = new URL(path.startsWith('/') ? path : `/${path}`, `${apiBaseUrl}/`);
  url.searchParams.set('access_token', token);
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

async function requestJson<T>(path: string, token: string, init?: RequestInit) {
  const response = await fetch(buildUrl(path), {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });

  return parseJson<T>(response);
}

export async function fetchClientPortalBootstrap(token: string) {
  return requestJson<ClientPortalBootstrap>('/api/mobile/client-portal/bootstrap', token);
}

export async function fetchClientPortalRequests(token: string) {
  return requestJson<{ items: ClientPortalRequestItem[] }>('/api/mobile/client-portal/requests', token);
}

export async function fetchClientPortalNotifications(token: string) {
  return requestJson<{ items: ClientPortalNotificationItem[] }>('/api/mobile/client-portal/notifications', token);
}

export async function fetchClientPortalOverview(token: string): Promise<ClientPortalOverview> {
  const [bootstrap, requestsRes, notificationsRes] = await Promise.all([
    fetchClientPortalBootstrap(token),
    fetchClientPortalRequests(token),
    fetchClientPortalNotifications(token),
  ]);

  return {
    bootstrap,
    requests: requestsRes.items,
    notifications: notificationsRes.items,
  };
}

export async function submitClientPortalRequest(
  token: string,
  payload: {
    subject: string;
    message: string;
  },
) {
  return requestJson<{ ok: true; message: string; request: ClientPortalRequestItem }>(
    '/api/mobile/client-portal/requests',
    token,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
}

export async function requestClientPortalAccountDeletion(token: string, message?: string) {
  return requestJson<{ ok: true; message: string }>(
    '/api/mobile/client-portal/account/delete-request',
    token,
    {
      method: 'POST',
      body: JSON.stringify({ message: message?.trim() || undefined }),
    },
  );
}

export async function submitClientPortalCommunication(
  token: string,
  payload: {
    matterId: string;
    message: string;
  },
) {
  return requestJson<ClientPortalCommunicationResponse>('/api/mobile/client-portal/communications', token, {
    method: 'POST',
    body: JSON.stringify({
      matter_id: payload.matterId,
      message: payload.message,
    }),
  });
}

export async function uploadClientPortalDocument(
  token: string,
  payload: {
    title: string;
    matterId?: string | null;
    file: {
      uri: string;
      name: string;
      mimeType?: string | null;
    };
  },
) {
  const formData = new FormData();
  formData.append('title', payload.title);
  if (payload.matterId) {
    formData.append('matter_id', payload.matterId);
  }
  formData.append('file', {
    uri: payload.file.uri,
    name: payload.file.name,
    type: payload.file.mimeType || 'application/octet-stream',
  } as unknown as Blob);

  return requestJson<ClientPortalUploadedDocument>('/api/mobile/client-portal/documents/upload', token, {
    method: 'POST',
    body: formData,
  });
}

export async function requestClientPortalDocumentDownloadUrl(
  token: string,
  storagePath: string,
) {
  return requestJson<ClientPortalDownloadUrlResponse>(
    '/api/mobile/client-portal/documents/download-url',
    token,
    {
      method: 'POST',
      body: JSON.stringify({ storage_path: storagePath }),
    },
  );
}

export function buildClientPortalInvoicePdfUrl(token: string, invoiceId: string) {
  return buildAuthenticatedUrl(`/api/mobile/client-portal/invoices/${invoiceId}/pdf`, token);
}

export function buildClientPortalQuotePdfUrl(token: string, quoteId: string) {
  return buildAuthenticatedUrl(`/api/mobile/client-portal/quotes/${quoteId}/pdf`, token);
}

export function isIOS() {
  return Platform.OS === 'ios';
}
