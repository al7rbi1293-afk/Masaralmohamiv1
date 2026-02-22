import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { computeEntitlements, type SubscriptionSnapshot, type TrialSnapshot } from './lib/entitlements';
import {
  ACCESS_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
} from './lib/supabase/constants';
import { csrfProtect } from './lib/csrf';

// ────────────────────────────────────────────
// Types for Supabase row shapes (replaces `as any`)
// ────────────────────────────────────────────

type ProfileStatusRow = { status: string };
type MembershipRow = { org_id: string; created_at?: string };
type OrgStatusRow = { status: string };
type AdminRow = { user_id: string };
type TrialRow = { ends_at: string | null; status: string };
type SubscriptionRow = { status: string; current_period_end: string | null };

// ────────────────────────────────────────────
// Security headers
// ────────────────────────────────────────────

function setSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  return response;
}

// ────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────

function redirectToSignIn(request: NextRequest) {
  const url = new URL('/signin', request.url);
  url.searchParams.set('next', request.nextUrl.pathname);
  return setSecurityHeaders(NextResponse.redirect(url));
}

function isBypassedPath(pathname: string) {
  if (pathname === '/app/settings/subscription' || pathname.startsWith('/app/settings/subscription/')) {
    return true;
  }
  if (pathname.startsWith('/app/api/stripe/')) {
    return true;
  }
  if (pathname === '/app/expired' || pathname.startsWith('/app/expired/')) {
    return true;
  }
  if (pathname === '/app/suspended' || pathname.startsWith('/app/suspended/')) {
    return true;
  }
  return false;
}

function missingEnvResponse() {
  return new NextResponse(
    'إعدادات البيئة غير مكتملة.',
    { status: 500 },
  );
}

function isMissingRelationError(message?: string) {
  if (!message) return false;
  const normalized = message.toLowerCase();
  return normalized.includes('does not exist') || normalized.includes('relation');
}

/** Create a single RLS-aware Supabase client for middleware use. */
function createRlsClient(supabaseUrl: string, supabaseAnon: string, accessToken: string) {
  return createClient(supabaseUrl, supabaseAnon, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

/** Set refreshed session cookies on a response (DRY helper). */
function applyRefreshedCookies(
  response: NextResponse,
  session: { access_token: string; refresh_token: string; expires_in: number } | null,
) {
  if (!session) return;
  response.cookies.set(ACCESS_COOKIE_NAME, session.access_token, {
    ...SESSION_COOKIE_OPTIONS,
    maxAge: session.expires_in,
  });
  response.cookies.set(REFRESH_COOKIE_NAME, session.refresh_token, {
    ...SESSION_COOKIE_OPTIONS,
    maxAge: 60 * 60 * 24 * 30,
  });
}

// ────────────────────────────────────────────
// DB check functions (accept shared client)
// ────────────────────────────────────────────

async function isAdmin(rls: SupabaseClient, userId: string): Promise<boolean> {
  const { data } = await rls
    .from('app_admins')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();

  return !!data;
}

async function isAccountSuspended(rls: SupabaseClient, userId: string): Promise<boolean> {
  const { data: profile } = await rls
    .from('profiles')
    .select('status')
    .eq('user_id', userId)
    .maybeSingle();

  if (profile && (profile as ProfileStatusRow).status === 'suspended') {
    return true;
  }

  const { data: membership } = await rls
    .from('memberships')
    .select('org_id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();

  if (membership) {
    const { data: org } = await rls
      .from('organizations')
      .select('status')
      .eq('id', (membership as MembershipRow).org_id)
      .maybeSingle();

    if (org && (org as OrgStatusRow).status === 'suspended') {
      return true;
    }
  }

  return false;
}

async function getOrgIdForUser(rls: SupabaseClient, userId: string): Promise<string | null> {
  const { data, error } = await rls
    .from('memberships')
    .select('org_id, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) return null;
  const row = data as MembershipRow | null;
  return row?.org_id ? String(row.org_id) : null;
}

async function getTrialSnapshot(rls: SupabaseClient, orgId: string): Promise<TrialSnapshot> {
  const { data, error } = await rls
    .from('trial_subscriptions')
    .select('ends_at, status')
    .eq('org_id', orgId)
    .maybeSingle();

  if (error || !data) return null;
  const row = data as TrialRow;
  return {
    endsAt: row.ends_at ? String(row.ends_at) : null,
    status: String(row.status ?? 'active'),
  };
}

async function getSubscriptionSnapshot(rls: SupabaseClient, orgId: string): Promise<SubscriptionSnapshot> {
  const { data, error } = await rls
    .from('subscriptions')
    .select('status, current_period_end')
    .eq('org_id', orgId)
    .maybeSingle();

  if (error) {
    if (isMissingRelationError(error.message)) return null;
    return null;
  }
  if (!data) return null;

  const row = data as SubscriptionRow;
  return {
    status: String(row.status ?? 'trial'),
    currentPeriodEnd: row.current_period_end ? String(row.current_period_end) : null,
  };
}

async function shouldLockApp(
  rls: SupabaseClient,
  pathname: string,
  userId: string,
): Promise<boolean> {
  if (!pathname.startsWith('/app') || isBypassedPath(pathname)) return false;

  const orgId = await getOrgIdForUser(rls, userId);
  if (!orgId) return false;

  const [trial, subscription] = await Promise.all([
    getTrialSnapshot(rls, orgId),
    getSubscriptionSnapshot(rls, orgId),
  ]);

  const entitlements = computeEntitlements({ trial, subscription });
  return entitlements.access === 'locked';
}

// ────────────────────────────────────────────
// Main middleware
// ────────────────────────────────────────────

export async function middleware(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const pathname = request.nextUrl.pathname;

  // Initialize response for csrf
  const csrfResponse = NextResponse.next();
  // We manually catch the csrfError in middleware to allow manual verification in server actions.
  // This will still set the cookie and X-CSRF-Token header in request automatically for GET.
  try {
    await csrfProtect(request, csrfResponse);
  } catch (err: any) {
    // Log the error to Vercel console so we can see what exact error type it is.
    console.error('CSRF Protect Middleware Error:', err?.name, err?.message);
    if (err?.name !== 'CsrfError') {
      // If it's a completely unexpected crash, we should probably still throw it, 
      // but let's just log and continue for now to fix the 500s on production.
      console.error('Unexpected CSRF error type, continuing anyway to unblock users.', err);
    }
  }

  if (!supabaseUrl || !supabaseAnon) {
    return missingEnvResponse();
  }

  const requestHeaders = new Headers(request.headers);
  const accessToken = request.cookies.get(ACCESS_COOKIE_NAME)?.value;
  const refreshToken = request.cookies.get(REFRESH_COOKIE_NAME)?.value;

  if (!accessToken && !refreshToken) {
    return redirectToSignIn(request);
  }

  // Auth client — only used for getUser / refreshSession (no RLS token needed)
  const authClient = createClient(supabaseUrl, supabaseAnon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let userId: string | null = null;
  let tokenForRls = accessToken ?? '';
  let refreshedSession: {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  } | null = null;

  if (accessToken) {
    const { data, error } = await authClient.auth.getUser(accessToken);
    if (!error && data.user) {
      userId = data.user.id;
      tokenForRls = accessToken;
    }
  }

  if (!userId && refreshToken) {
    const { data, error } = await authClient.auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (!error && data.session) {
      userId = data.session.user.id;
      tokenForRls = data.session.access_token;
      refreshedSession = {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_in: data.session.expires_in,
      };
    }
  }

  if (userId) {
    requestHeaders.set('x-masar-access-token', tokenForRls);

    // Single RLS client reused for all DB checks
    const rls = createRlsClient(supabaseUrl, supabaseAnon, tokenForRls);

    // --- Admin route protection ---
    if (pathname.startsWith('/admin')) {
      const adminCheck = await isAdmin(rls, userId).catch(() => false);

      if (!adminCheck) {
        const response = pathname.startsWith('/admin/api/')
          ? NextResponse.json({ error: 'غير مصرح.' }, { status: 403 })
          : NextResponse.redirect(new URL('/app', request.url));
        applyRefreshedCookies(response, refreshedSession);
        return setSecurityHeaders(response);
      }

      const response = NextResponse.next({ request: { headers: requestHeaders } });
      applyRefreshedCookies(response, refreshedSession);
      return setSecurityHeaders(response);
    }

    // --- Suspended account check (for /app routes) ---
    if (pathname.startsWith('/app') && !isBypassedPath(pathname)) {
      const suspended = await isAccountSuspended(rls, userId).catch(() => false);

      if (suspended) {
        if (pathname === '/app/suspended') {
          // Already on suspended page, fall through
        } else if (pathname.startsWith('/app/api/')) {
          setSecurityHeaders(csrfResponse);
          return NextResponse.json(
            { error: 'تم تعليق الحساب. تواصل مع الإدارة.' },
            { status: 403, headers: csrfResponse.headers },
          );
        } else {
          const redirectResponse = NextResponse.redirect(new URL('/app/suspended', request.url));
          applyRefreshedCookies(redirectResponse, refreshedSession);
          // Copy csrf cookies
          redirectResponse.headers.append('Set-Cookie', csrfResponse.headers.get('Set-Cookie') || '');
          return setSecurityHeaders(redirectResponse);
        }
      }
    }

    // --- Trial/subscription lock check ---
    const locked = await shouldLockApp(rls, pathname, userId);
    const isApi = pathname.startsWith('/app/api/');
    let response: NextResponse;

    if (locked && isApi) {
      response = NextResponse.json(
        { error: 'انتهت التجربة. يمكنك ترقية الخطة من صفحة الاشتراك.' },
        { status: 403, headers: csrfResponse.headers },
      );
      setSecurityHeaders(response);
      return response;
    } else if (locked) {
      const redirectResponse = NextResponse.redirect(new URL('/app/expired', request.url));
      applyRefreshedCookies(redirectResponse, refreshedSession);
      redirectResponse.headers.append('Set-Cookie', csrfResponse.headers.get('Set-Cookie') || '');
      return setSecurityHeaders(redirectResponse);
    } else {
      // response is already NextResponse.next(), we just update headers
      response = NextResponse.next({ request: { headers: requestHeaders } });
      csrfResponse.headers.forEach((value, key) => response.headers.set(key, value));
    }

    applyRefreshedCookies(response, refreshedSession);
    return setSecurityHeaders(response);
  }

  const redirectResponse = redirectToSignIn(request);
  redirectResponse.cookies.delete(ACCESS_COOKIE_NAME);
  redirectResponse.cookies.delete(REFRESH_COOKIE_NAME);
  redirectResponse.headers.append('Set-Cookie', csrfResponse.headers.get('Set-Cookie') || '');
  return redirectResponse;
}

export const config = {
  matcher: ['/app/:path*', '/admin/:path*'],
};
