import { NextRequest, NextResponse } from 'next/server';
import { CLIENT_PORTAL_SESSION_COOKIE_NAME } from '@/lib/client-portal/session';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const redirectUrl = new URL('/client-portal/signin', request.url);
  const response = NextResponse.redirect(redirectUrl, 303);
  response.cookies.delete(CLIENT_PORTAL_SESSION_COOKIE_NAME);
  return response;
}

