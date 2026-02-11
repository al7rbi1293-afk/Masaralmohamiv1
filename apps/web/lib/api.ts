export const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
    cache: 'no-store',
  });

  const payload = await parseResponse(response);

  if (!response.ok) {
    const message =
      typeof payload?.message === 'string'
        ? payload.message
        : Array.isArray(payload?.message)
          ? payload.message.join(' - ')
          : 'حدث خطأ أثناء تنفيذ الطلب';

    throw new Error(message);
  }

  return payload as T;
}

async function parseResponse(response: Response) {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}
