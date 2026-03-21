import { PartnerOverview } from './types';

const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim().replace(/\/+$/, '');

function buildUrl(path: string) {
  if (!apiBaseUrl) {
    throw new Error('EXPO_PUBLIC_API_BASE_URL is not configured.');
  }

  return `${apiBaseUrl}${path.startsWith('/') ? path : `/${path}`}`;
}

async function requestJson<T>(path: string, token: string): Promise<T> {
  const response = await fetch(buildUrl(path), {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  const payload = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error || 'تعذر تحميل بيانات الشريك.');
  }

  return payload;
}

export async function fetchPartnerOverview(token: string) {
  return requestJson<PartnerOverview>('/api/mobile/partner/overview', token);
}
