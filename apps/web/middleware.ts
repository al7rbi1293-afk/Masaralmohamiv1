import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { computeEntitlements, type SubscriptionSnapshot, type TrialSnapshot } from './lib/entitlements';
import {
  ACCESS_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
} from './lib/supabase/constants';

function setSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  return response;
}

function redirectToSignIn(request: NextRequest) {
  const url = new URL('/signin', request.url);
  url.searchParams.set('next', request.nextUrl.pathname);
  return setSecurityHeaders(NextResponse.redirect(url));
}

function isBypassedPath(pathname: string) {
  // Locked users must be able to reach the upgrade page.
  if (pathname === '/app/settings/subscription' || pathname.startsWith('/app/settings/subscription/')) {
    return true;
  }
  // Allow creating Stripe checkout sessions even when the org is locked (trial ended).
  if (pathname.startsWith('/app/api/stripe/')) {
    return true;
  }
  // Expired page is always accessible when authenticated.
  if (pathname === '/app/expired' || pathname.startsWith('/app/expired/')) {
    return true;
  }
  // Suspended page is always accessible.
  if (pathname === '/app/suspended' || pathname.startsWith('/app/suspended/')) {
    return true;
  }
  return false;
}

async function isAdmin(params: {
  supabaseUrl: string;
  supabaseAnon: string;
  accessToken: string;
  userId: string;
}): Promise<boolean> {
  const { supabaseUrl, supabaseAnon, accessToken, userId } = params;
  const supabase = createClient(supabaseUrl, supabaseAnon, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });

  const { data } = await supabase
    .from('app_admins')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();

  return !!data;
}

async function isAccountSuspended(params: {
  supabaseUrl: string;
  supabaseAnon: string;
  accessToken: string;
  userId: string;
}): Promise<boolean> {
  const { supabaseUrl, supabaseAnon, accessToken, userId } = params;
  const supabase = createClient(supabaseUrl, supabaseAnon, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });

  // Check profile status
  const { data: profile } = await supabase
    .from('profiles')
    .select('status')
    .eq('user_id', userId)
    .maybeSingle();

  if (profile && (profile as any).status === 'suspended') {
    return true;
  }

  // Check org status
  const { data: membership } = await supabase
    .from('memberships')
    .select('org_id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();

  if (membership) {
    const { data: org } = await supabase
      .from('organizations')
      .select('status')
      .eq('id', (membership as any).org_id)
      .maybeSingle();

    if (org && (org as any).status === 'suspended') {
      return true;
    }
  }

  return false;
}

function missingEnvResponse() {
  return new NextResponse(
    'إعدادات البيئة غير مكتملة. Missing environment variables: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY.',
    { status: 500 },
  );
}

function isMissingRelationError(message?: string) {
  if (!message) return false;
  const normalized = message.toLowerCase();
  return normalized.includes('does not exist') || normalized.includes('relation');
}

async function getOrgIdForUser(params: {
  supabaseUrl: string;
  supabaseAnon: string;
  accessToken: string;
  userId: string;
}) {
  const { supabaseUrl, supabaseAnon, accessToken, userId } = params;
  const supabase = createClient(supabaseUrl, supabaseAnon, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });

  const { data, error } = await supabase
    .from('memberships')
    .select('org_id, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    return null;
  }

  return (data as any)?.org_id ? String((data as any).org_id) : null;
}

async function getTrialSnapshot(params: {
  supabaseUrl: string;
  supabaseAnon: string;
  accessToken: string;
  orgId: string;
}): Promise<TrialSnapshot> {
  const { supabaseUrl, supabaseAnon, accessToken, orgId } = params;
  const supabase = createClient(supabaseUrl, supabaseAnon, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });

  const { data, error } = await supabase
    .from('trial_subscriptions')
    .select('ends_at, status')
    .eq('org_id', orgId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return {
    endsAt: (data as any).ends_at ? String((data as any).ends_at) : null,
    status: String((data as any).status ?? 'active'),
  };
}

async function getSubscriptionSnapshot(params: {
  supabaseUrl: string;
  supabaseAnon: string;
  accessToken: string;
  orgId: string;
}): Promise<SubscriptionSnapshot> {
  const { supabaseUrl, supabaseAnon, accessToken, orgId } = params;
  const supabase = createClient(supabaseUrl, supabaseAnon, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });

  const { data, error } = await supabase
    .from('subscriptions')
    .select('status, current_period_end')
    .eq('org_id', orgId)
    .maybeSingle();

  if (error) {
    // If migrations haven't been applied yet, don't break the app.
    if (isMissingRelationError(error.message)) {
      return null;
    }
    return null;
  }

  if (!data) return null;

  return {
    status: String((data as any).status ?? 'trial'),
    currentPeriodEnd: (data as any).current_period_end ? String((data as any).current_period_end) : null,
  };
}

async function shouldLockApp(params: {
  request: NextRequest;
  supabaseUrl: string;
  supabaseAnon: string;
  accessToken: string;
  userId: string;
}) {
  const { request, supabaseUrl, supabaseAnon, accessToken, userId } = params;
  const pathname = request.nextUrl.pathname;

  if (!pathname.startsWith('/app') || isBypassedPath(pathname)) {
    return false;
  }

  const orgId = await getOrgIdForUser({ supabaseUrl, supabaseAnon, accessToken, userId });
  if (!orgId) {
    return false;
  }

  const [trial, subscription] = await Promise.all([
    getTrialSnapshot({ supabaseUrl, supabaseAnon, accessToken, orgId }),
    getSubscriptionSnapshot({ supabaseUrl, supabaseAnon, accessToken, orgId }),
  ]);

  const entitlements = computeEntitlements({ trial, subscription });
  return entitlements.access === 'locked';
}

export async function middleware(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const pathname = request.nextUrl.pathname;

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

  let userId: string | null = null;
  let tokenForRls = accessToken ?? '';
  let refreshedSession:
    | { access_token: string; refresh_token: string; expires_in: number; user_id: string }
    | null = null;

  if (accessToken) {
    const { data, error } = await supabase.auth.getUser(accessToken);
    if (!error && data.user) {
      userId = data.user.id;
      tokenForRls = accessToken;
    }
  }

  if (!userId && refreshToken) {
    const { data, error } = await supabase.auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (!error && data.session) {
      userId = data.session.user.id;
      tokenForRls = data.session.access_token;
      refreshedSession = {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_in: data.session.expires_in,
        user_id: data.session.user.id,
      };
    }
  }

  if (userId) {
    // Propagate the access token so server components/handlers can perform RLS queries.
    requestHeaders.set('x-masar-access-token', tokenForRls);

    // --- Admin route protection ---
    if (pathname.startsWith('/admin')) {
      const adminCheck = await isAdmin({
        supabaseUrl,
        supabaseAnon,
        accessToken: tokenForRls,
        userId,
      }).catch(() => false);

      if (!adminCheck) {
        let response: NextResponse;
        if (pathname.startsWith('/admin/api/')) {
          response = NextResponse.json({ error: 'غير مصرح.' }, { status: 403 });
        } else {
          response = NextResponse.redirect(new URL('/app', request.url));
        }
        if (refreshedSession) {
          response.cookies.set(ACCESS_COOKIE_NAME, refreshedSession.access_token, {
            ...SESSION_COOKIE_OPTIONS,
            maxAge: refreshedSession.expires_in,
          });
          response.cookies.set(REFRESH_COOKIE_NAME, refreshedSession.refresh_token, {
            ...SESSION_COOKIE_OPTIONS,
            maxAge: 60 * 60 * 24 * 30,
          });
        }
        return response;
      }

      // Admin is verified — proceed
      let response = NextResponse.next({ request: { headers: requestHeaders } });
      if (refreshedSession) {
        response.cookies.set(ACCESS_COOKIE_NAME, refreshedSession.access_token, {
          ...SESSION_COOKIE_OPTIONS,
          maxAge: refreshedSession.expires_in,
        });
        response.cookies.set(REFRESH_COOKIE_NAME, refreshedSession.refresh_token, {
          ...SESSION_COOKIE_OPTIONS,
          maxAge: 60 * 60 * 24 * 30,
        });
      }
      return response;
    }

    // --- Suspended account check (for /app routes) ---
    if (pathname.startsWith('/app') && !isBypassedPath(pathname)) {
      const suspended = await isAccountSuspended({
        supabaseUrl,
        supabaseAnon,
        accessToken: tokenForRls,
        userId,
      }).catch(() => false);

      if (suspended) {
        if (pathname === '/app/suspended') {
          // Already on suspended page, allow through
        } else if (pathname.startsWith('/app/api/')) {
          return NextResponse.json(
            { error: 'تم تعليق الحساب. تواصل مع الإدارة.' },
            { status: 403 },
          );
        } else {
          const response = NextResponse.redirect(new URL('/app/suspended', request.url));
          if (refreshedSession) {
            response.cookies.set(ACCESS_COOKIE_NAME, refreshedSession.access_token, {
              ...SESSION_COOKIE_OPTIONS,
              maxAge: refreshedSession.expires_in,
            });
            response.cookies.set(REFRESH_COOKIE_NAME, refreshedSession.refresh_token, {
              ...SESSION_COOKIE_OPTIONS,
              maxAge: 60 * 60 * 24 * 30,
            });
          }
          return response;
        }
      }
    }

    const locked = await shouldLockApp({
      request,
      supabaseUrl,
      supabaseAnon,
      accessToken: tokenForRls,
      userId,
    });

    const isApi = pathname.startsWith('/app/api/');
    let response: NextResponse;

    if (locked && isApi) {
      response = NextResponse.json(
        { error: 'انتهت التجربة. يمكنك ترقية الخطة من صفحة الاشتراك.' },
        { status: 403 },
      );
    } else if (locked) {
      response = NextResponse.redirect(new URL('/app/expired', request.url));
    } else {
      response = NextResponse.next({
        request: { headers: requestHeaders },
      });
    }

    if (refreshedSession) {
      response.cookies.set(ACCESS_COOKIE_NAME, refreshedSession.access_token, {
        ...SESSION_COOKIE_OPTIONS,
        maxAge: refreshedSession.expires_in,
      });
      response.cookies.set(REFRESH_COOKIE_NAME, refreshedSession.refresh_token, {
        ...SESSION_COOKIE_OPTIONS,
        maxAge: 60 * 60 * 24 * 30,
      });
    }

    return setSecurityHeaders(response);
  }

  const response = redirectToSignIn(request);
  response.cookies.delete(ACCESS_COOKIE_NAME);
  response.cookies.delete(REFRESH_COOKIE_NAME);
  return response;
}

export const config = {
  matcher: ['/app/:path*', '/admin/:path*'],
};
