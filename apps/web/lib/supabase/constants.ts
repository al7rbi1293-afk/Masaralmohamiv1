export const ACCESS_COOKIE_NAME = 'masar-sb-access-token';
export const REFRESH_COOKIE_NAME = 'masar-sb-refresh-token';

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
};
