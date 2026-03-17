import { NextRequest, NextResponse } from 'next/server';
import { CLIENT_PORTAL_SESSION_COOKIE_NAME } from '@/lib/client-portal/session';

export const runtime = 'nodejs';

/** Shared logic: clear the client-portal session cookie and redirect to sign-in. */
function clearSessionAndRedirect(request: NextRequest) {
  const redirectUrl = new URL('/client-portal/signin', request.url);
  const response = NextResponse.redirect(redirectUrl, 303);
  response.cookies.delete(CLIENT_PORTAL_SESSION_COOKIE_NAME);
  return response;
}

/** POST: used by the sign-out button / form. */
export async function POST(request: NextRequest) {
  return clearSessionAndRedirect(request);
}

/** GET: used when server components detect a stale session and redirect here. */
export async function GET(request: NextRequest) {
  return clearSessionAndRedirect(request);
}
