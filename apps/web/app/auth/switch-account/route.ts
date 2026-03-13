import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME } from '@/lib/auth-custom';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const email = (url.searchParams.get('email') || '').trim().toLowerCase();
  const next = safeNextPath(url.searchParams.get('next') || undefined) || '/app';

  const redirectUrl = new URL('/signin', request.url);
  if (email) {
    redirectUrl.searchParams.set('email', email);
  }
  redirectUrl.searchParams.set('next', next);
  redirectUrl.searchParams.set('switched', '1');

  const response = NextResponse.redirect(redirectUrl, 303);
  response.cookies.delete(SESSION_COOKIE_NAME);
  response.cookies.delete('masar-sb-access-token');
  response.cookies.delete('masar-sb-refresh-token');
  return response;
}

function safeNextPath(raw?: string) {
  if (!raw) return null;
  const value = raw.trim();
  if (!value.startsWith('/') || value.startsWith('//')) return null;
  if (value.includes('\n') || value.includes('\r')) return null;
  if (value.startsWith('/app')) {
    if (value.startsWith('/app/api')) return null;
    return value;
  }
  if (value.startsWith('/admin')) {
    if (value.startsWith('/admin/api')) return null;
    return value;
  }
  return null;
}
