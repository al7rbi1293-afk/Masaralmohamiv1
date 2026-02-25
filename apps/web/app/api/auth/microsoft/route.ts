import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getCurrentAuthUser } from '@/lib/supabase/auth-session';
import { requireOrgIdForUser } from '@/lib/org';
import { getPublicSiteUrl } from '@/lib/env';

const OAUTH_STATE_COOKIE = 'masar-ms-oauth-state';
const OAUTH_STATE_MAX_AGE_SECONDS = 10 * 60;

type OAuthStatePayload = {
  orgId: string;
  userId: string;
  nonce: string;
  iat: number;
  exp: number;
};

function getOAuthStateSecret() {
  const secret = process.env.MICROSOFT_OAUTH_STATE_SECRET?.trim();

  if (!secret) {
    throw new Error('oauth_state_secret_missing');
  }

  return secret;
}

function signStatePayload(payload: string) {
  return crypto.createHmac('sha256', getOAuthStateSecret()).update(payload).digest('base64url');
}

function encodeState(payload: OAuthStatePayload) {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = signStatePayload(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

/**
 * GET /api/auth/microsoft
 * Initiates Microsoft OAuth 2.0 flow for email integration.
 * Redirects to Microsoft authorization endpoint.
 */
export async function GET(_request: NextRequest) {
    const appUrl = getPublicSiteUrl();
    const user = await getCurrentAuthUser();
    if (!user) {
        return NextResponse.redirect(new URL('/signin', appUrl));
    }

    let orgId: string;
    try {
        orgId = await requireOrgIdForUser();
    } catch {
        return NextResponse.json({ message: 'لا يوجد مكتب مفعّل.' }, { status: 403 });
    }

    const clientId = process.env.MICROSOFT_CLIENT_ID;
    if (!clientId) {
        return NextResponse.json({ message: 'تكامل البريد غير مُعدّ.' }, { status: 503 });
    }

    const redirectUri = `${appUrl}/api/auth/microsoft/callback`;
    const scope = 'openid email profile Mail.Read Mail.Send offline_access';
    const now = Math.floor(Date.now() / 1000);
    const state = encodeState({
        orgId,
        userId: user.id,
        nonce: crypto.randomBytes(24).toString('base64url'),
        iat: now,
        exp: now + OAUTH_STATE_MAX_AGE_SECONDS,
    });

    const authUrl = new URL('https://login.microsoftonline.com/common/oauth2/v2.0/authorize');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('scope', scope);
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('response_mode', 'query');

    const response = NextResponse.redirect(authUrl.toString());
    response.cookies.set(OAUTH_STATE_COOKIE, state, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/api/auth/microsoft/callback',
        maxAge: OAUTH_STATE_MAX_AGE_SECONDS,
    });
    return response;
}
