import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { jwtVerify } from 'jose';
import { computeEntitlements, type SubscriptionSnapshot, type TrialSnapshot } from './lib/entitlements';
import { csrfProtect } from './lib/csrf';

// ────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────

const SESSION_COOKIE_NAME = 'masar-session';

// ────────────────────────────────────────────
// Types
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

function getJwtSecret(): string {
  return process.env.JWT_SECRET?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || '';
}

async function verifySessionTokenInMiddleware(token: string): Promise<{ userId: string; email: string } | null> {
  const secret = getJwtSecret();
  if (!secret) return null;
  try {
    const encodedSecret = new TextEncoder().encode(secret);
    const { payload } = await jwtVerify(token, encodedSecret);
    if (!payload.sub || !payload.email) return null;
    return { userId: payload.sub, email: payload.email as string };
  } catch {
    return null;
  }
}

/** Create a service-role Supabase client for middleware DB checks. */
function createServiceClient(supabaseUrl: string, serviceKey: string) {
  return createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// ────────────────────────────────────────────
// DB check functions
// ────────────────────────────────────────────

async function isAdmin(db: SupabaseClient, userId: string): Promise<boolean> {
  const { data } = await db
    .from('app_admins')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();
  return !!data;
}

async function isAccountSuspended(db: SupabaseClient, userId: string): Promise<boolean> {
  // Check app_users status
  const { data: appUser } = await db
    .from('app_users')
    .select('status')
    .eq('id', userId)
    .maybeSingle();

  if (appUser && (appUser as any).status === 'suspended') {
    return true;
  }

  // Check org suspension
  const { data: membership } = await db
    .from('memberships')
    .select('org_id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();

  if (membership) {
    const { data: org } = await db
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

async function getOrgIdForUser(db: SupabaseClient, userId: string): Promise<string | null> {
  const { data, error } = await db
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

async function getTrialSnapshot(db: SupabaseClient, orgId: string): Promise<TrialSnapshot> {
  const { data, error } = await db
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

async function getSubscriptionSnapshot(db: SupabaseClient, orgId: string): Promise<SubscriptionSnapshot> {
  const { data, error } = await db
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
  db: SupabaseClient,
  pathname: string,
  userId: string,
): Promise<boolean> {
  if (!pathname.startsWith('/app') || isBypassedPath(pathname)) return false;

  const orgId = await getOrgIdForUser(db, userId);
  if (!orgId) return false;

  const [trial, subscription] = await Promise.all([
    getTrialSnapshot(db, orgId),
    getSubscriptionSnapshot(db, orgId),
  ]);

  const entitlements = computeEntitlements({ trial, subscription });
  return entitlements.access === 'locked';
}

// ────────────────────────────────────────────
// Main middleware
// ────────────────────────────────────────────

export async function middleware(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const pathname = request.nextUrl.pathname;

  // Initialize response for CSRF
  const csrfResponse = NextResponse.next();
  try {
    await csrfProtect(request, csrfResponse);
  } catch (err: any) {
    console.error('CSRF Protect Middleware Error:', err?.name, err?.message);
    if (err?.name !== 'CsrfError') {
      console.error('Unexpected CSRF error type, continuing anyway to unblock users.', err);
    }
  }

  if (!supabaseUrl || !serviceKey) {
    return missingEnvResponse();
  }

  const requestHeaders = new Headers(request.headers);

  // Read custom JWT session cookie
  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionToken) {
    return redirectToSignIn(request);
  }

  // Verify JWT
  const session = await verifySessionTokenInMiddleware(sessionToken);
  if (!session) {
    // Invalid or expired token
    const redirectResponse = redirectToSignIn(request);
    redirectResponse.cookies.delete(SESSION_COOKIE_NAME);
    return redirectResponse;
  }

  const userId = session.userId;

  // Pass userId to downstream via header
  requestHeaders.set('x-masar-user-id', userId);

  // Use service role client for all DB checks (no RLS needed)
  const db = createServiceClient(supabaseUrl, serviceKey);

  // --- Admin route protection ---
  if (pathname.startsWith('/admin')) {
    const adminCheck = await isAdmin(db, userId).catch(() => false);

    if (!adminCheck) {
      const response = pathname.startsWith('/admin/api/')
        ? NextResponse.json({ error: 'غير مصرح.' }, { status: 403 })
        : NextResponse.redirect(new URL('/app', request.url));
      return setSecurityHeaders(response);
    }

    const response = NextResponse.next({ request: { headers: requestHeaders } });
    csrfResponse.headers.forEach((value, key) => response.headers.set(key, value));
    return setSecurityHeaders(response);
  }

  // --- Suspended account check (for /app routes) ---
  if (pathname.startsWith('/app') && !isBypassedPath(pathname)) {
    const suspended = await isAccountSuspended(db, userId).catch(() => false);

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
        redirectResponse.headers.append('Set-Cookie', csrfResponse.headers.get('Set-Cookie') || '');
        return setSecurityHeaders(redirectResponse);
      }
    }
  }

  // --- Trial/subscription lock check ---
  const locked = await shouldLockApp(db, pathname, userId);
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
    redirectResponse.headers.append('Set-Cookie', csrfResponse.headers.get('Set-Cookie') || '');
    return setSecurityHeaders(redirectResponse);
  } else {
    response = NextResponse.next({ request: { headers: requestHeaders } });
    csrfResponse.headers.forEach((value, key) => response.headers.set(key, value));
  }

  return setSecurityHeaders(response);
}

export const config = {
  matcher: ['/app/:path*', '/admin/:path*'],
};
