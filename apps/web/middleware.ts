import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  ACCESS_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
} from './lib/supabase/constants';

function redirectToSignIn(request: NextRequest) {
  const url = new URL('/signin', request.url);
  url.searchParams.set('next', request.nextUrl.pathname);
  return NextResponse.redirect(url);
}

function missingEnvResponse() {
  return new NextResponse(
    'إعدادات البيئة غير مكتملة. Missing environment variables: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY.',
    { status: 500 },
  );
}

export async function middleware(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnon) {
    return missingEnvResponse();
  }

  const requestHeaders = new Headers(request.headers);

  const accessToken = request.cookies.get(ACCESS_COOKIE_NAME)?.value;
  const refreshToken = request.cookies.get(REFRESH_COOKIE_NAME)?.value;

  if (!accessToken && !refreshToken) {
    return redirectToSignIn(request);
  }

  const supabase = createClient(supabaseUrl, supabaseAnon, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  if (accessToken) {
    const { data, error } = await supabase.auth.getUser(accessToken);
    if (!error && data.user) {
      // Propagate the access token to the server so route handlers/server components
      // can perform RLS queries reliably (even when cookies are rotated).
      requestHeaders.set('x-masar-access-token', accessToken);
      return NextResponse.next({
        request: { headers: requestHeaders },
      });
    }
  }

  if (refreshToken) {
    const { data, error } = await supabase.auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (!error && data.session) {
      requestHeaders.set('x-masar-access-token', data.session.access_token);
      const response = NextResponse.next({
        request: { headers: requestHeaders },
      });
      response.cookies.set(ACCESS_COOKIE_NAME, data.session.access_token, {
        ...SESSION_COOKIE_OPTIONS,
        maxAge: data.session.expires_in,
      });
      response.cookies.set(REFRESH_COOKIE_NAME, data.session.refresh_token, {
        ...SESSION_COOKIE_OPTIONS,
        maxAge: 60 * 60 * 24 * 30,
      });
      return response;
    }
  }

  const response = redirectToSignIn(request);
  response.cookies.delete(ACCESS_COOKIE_NAME);
  response.cookies.delete(REFRESH_COOKIE_NAME);
  return response;
}

export const config = {
  matcher: ['/app/:path*'],
};
