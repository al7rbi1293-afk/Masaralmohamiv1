const configuredWebBaseUrl = process.env.EXPO_PUBLIC_WEB_BASE_URL?.trim().replace(/\/+$/, '') || '';
const configuredApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim().replace(/\/+$/, '') || '';

function deriveWebBaseUrl() {
  if (configuredWebBaseUrl) {
    return configuredWebBaseUrl;
  }

  if (!configuredApiBaseUrl) {
    return '';
  }

  try {
    const apiUrl = new URL(configuredApiBaseUrl);
    apiUrl.pathname = apiUrl.pathname.replace(/\/api\/?$/, '').replace(/\/+$/, '');
    apiUrl.search = '';
    apiUrl.hash = '';
    return apiUrl.toString().replace(/\/+$/, '');
  } catch {
    return configuredApiBaseUrl.replace(/\/api\/?$/, '').replace(/\/+$/, '');
  }
}

export function buildWebUrl(path: string, params?: Record<string, string | undefined | null>) {
  const baseUrl = deriveWebBaseUrl();
  if (!baseUrl) {
    throw new Error('EXPO_PUBLIC_WEB_BASE_URL or EXPO_PUBLIC_API_BASE_URL is not configured.');
  }

  const url = new URL(path.startsWith('/') ? path : `/${path}`, `${baseUrl}/`);
  for (const [key, value] of Object.entries(params ?? {})) {
    if (!value) {
      continue;
    }
    url.searchParams.set(key, value);
  }

  return url.toString();
}

export function buildSignupUrl() {
  return buildWebUrl('/#trial');
}

export function buildActivationResendUrl(email?: string) {
  return buildWebUrl('/signup', {
    status: 'pending_activation',
    email,
  });
}
