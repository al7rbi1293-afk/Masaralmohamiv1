import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS } from '@/lib/auth-custom';
import { authenticateMobileAppUser } from '@/lib/mobile/auth';

export const runtime = 'nodejs';

const ALLOWED_PREFIXES = ['/admin', '/app', '/partner'];

function getSafeNextPath(request: NextRequest, fallbackPath: string) {
  const requested = request.nextUrl.searchParams.get('next')?.trim() || fallbackPath;
  if (!requested.startsWith('/')) {
    return fallbackPath;
  }

  if (!ALLOWED_PREFIXES.some((prefix) => requested === prefix || requested.startsWith(`${prefix}/`))) {
    return fallbackPath;
  }

  return requested;
}

export async function GET(request: NextRequest) {
  const auth = await authenticateMobileAppUser(request);
  if (!auth.ok) {
    const signInUrl = new URL('/signin', request.url);
    signInUrl.searchParams.set('error', auth.error);
    return NextResponse.redirect(signInUrl, 302);
  }

  const fallbackPath = auth.context.isAdmin
    ? '/admin'
    : auth.context.hasOfficeAccess
      ? '/app'
      : auth.context.hasPartnerAccess
        ? '/partner'
        : '/signin';
  let nextPath = getSafeNextPath(request, fallbackPath);

  if (nextPath.startsWith('/admin') && !auth.context.isAdmin) {
    nextPath = fallbackPath;
  }

  if (nextPath.startsWith('/partner') && !auth.context.hasPartnerAccess) {
    nextPath = fallbackPath;
  }

  if (nextPath.startsWith('/app') && !auth.context.hasOfficeAccess) {
    nextPath = fallbackPath;
  }

  const destination = new URL(nextPath, request.url);
  const response = NextResponse.redirect(destination, 302);
  response.cookies.set(SESSION_COOKIE_NAME, auth.context.token, SESSION_COOKIE_OPTIONS);
  response.cookies.delete('masar-sb-access-token');
  response.cookies.delete('masar-sb-refresh-token');
  return response;
}
