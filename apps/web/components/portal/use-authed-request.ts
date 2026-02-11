'use client';

import { apiRequest } from '@/lib/api';
import type { AuthSession } from '@/lib/session';

export async function authedRequest<T>(
  session: AuthSession,
  path: string,
  options: RequestInit = {},
): Promise<T> {
  return apiRequest<T>(path, {
    ...options,
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      ...(options.headers ?? {}),
    },
  });
}
