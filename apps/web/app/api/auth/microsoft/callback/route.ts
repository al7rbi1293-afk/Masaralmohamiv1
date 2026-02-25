import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { encryptToken } from '@/lib/token-crypto';
import { logError, logInfo } from '@/lib/logger';
import { getPublicSiteUrl } from '@/lib/env';

const OAUTH_STATE_COOKIE = 'masar-ms-oauth-state';
const OAUTH_STATE_COOKIE_PATH = '/api/auth/microsoft/callback';

type VerifiedOAuthState = {
    orgId: string;
    userId: string;
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

function safeEqual(a: string, b: string) {
    const aBuf = Buffer.from(a);
    const bBuf = Buffer.from(b);
    if (aBuf.length !== bBuf.length) return false;
    return crypto.timingSafeEqual(aBuf, bBuf);
}

function verifyState(rawState: string): VerifiedOAuthState | null {
    const [encodedPayload, signature] = rawState.split('.');
    if (!encodedPayload || !signature) {
        return null;
    }

    const expected = signStatePayload(encodedPayload);
    if (!safeEqual(signature, expected)) {
        return null;
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
    } catch {
        return null;
    }

    const state = parsed as Partial<{
        orgId: string;
        userId: string;
        exp: number;
    }>;

    if (!state.orgId || !state.userId || !state.exp || !Number.isFinite(state.exp)) {
        return null;
    }

    const now = Math.floor(Date.now() / 1000);
    if (now >= state.exp) {
        return null;
    }

    return {
        orgId: state.orgId,
        userId: state.userId,
        exp: state.exp,
    };
}

function clearStateCookie(response: NextResponse) {
    response.cookies.set(OAUTH_STATE_COOKIE, '', {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: OAUTH_STATE_COOKIE_PATH,
        maxAge: 0,
    });
    return response;
}

function redirectWithStateCleanup(url: string) {
    return clearStateCookie(NextResponse.redirect(url));
}

/**
 * GET /api/auth/microsoft/callback
 * Handles OAuth callback from Microsoft.
 * Exchanges code for tokens and stores encrypted in email_accounts.
 */
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const appUrl = getPublicSiteUrl();

    if (error) {
        logError('microsoft_oauth_error', { error, description: searchParams.get('error_description') });
        return redirectWithStateCleanup(`${appUrl}/app/settings/email?error=oauth_denied`);
    }

    if (!code || !state) {
        return redirectWithStateCleanup(`${appUrl}/app/settings/email?error=missing_params`);
    }

    // Validate OAuth state integrity + CSRF binding.
    const cookieState = request.cookies.get(OAUTH_STATE_COOKIE)?.value ?? '';
    if (!cookieState || cookieState !== state) {
        return redirectWithStateCleanup(`${appUrl}/app/settings/email?error=invalid_state`);
    }

    const verifiedState = verifyState(state);
    if (!verifiedState) {
        return redirectWithStateCleanup(`${appUrl}/app/settings/email?error=invalid_state`);
    }

    const clientId = process.env.MICROSOFT_CLIENT_ID;
    const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
    const redirectUri = `${appUrl}/api/auth/microsoft/callback`;

    if (!clientId || !clientSecret) {
        return redirectWithStateCleanup(`${appUrl}/app/settings/email?error=not_configured`);
    }

    // Exchange code for tokens
    let tokenData: {
        access_token: string;
        refresh_token?: string;
        expires_in: number;
        scope: string;
    };

    try {
        const tokenRes = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: clientId,
                client_secret: clientSecret,
                code,
                redirect_uri: redirectUri,
                grant_type: 'authorization_code',
            }),
        });

        if (!tokenRes.ok) {
            const errBody = await tokenRes.text();
            logError('microsoft_token_exchange_failed', { status: tokenRes.status, body: errBody });
            return redirectWithStateCleanup(`${appUrl}/app/settings/email?error=token_exchange`);
        }

        tokenData = await tokenRes.json();
    } catch (err) {
        logError('microsoft_token_fetch_error', { error: err instanceof Error ? err.message : 'unknown' });
        return redirectWithStateCleanup(`${appUrl}/app/settings/email?error=token_fetch`);
    }

    // Fetch user email from Microsoft Graph
    let email = '';
    try {
        const profileRes = await fetch('https://graph.microsoft.com/v1.0/me', {
            headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });
        if (profileRes.ok) {
            const profile = await profileRes.json();
            email = profile.mail || profile.userPrincipalName || '';
        }
    } catch {
        // Non-fatal
    }

    // Encrypt and store tokens
    const adminClient = createSupabaseServerClient();
    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

    const { error: insertError } = await adminClient
        .from('email_accounts')
        .upsert(
            {
                org_id: verifiedState.orgId,
                user_id: verifiedState.userId,
                provider: 'microsoft',
                email,
                access_token_enc: encryptToken(tokenData.access_token),
                refresh_token_enc: tokenData.refresh_token ? encryptToken(tokenData.refresh_token) : null,
                token_expires_at: expiresAt,
                scopes: tokenData.scope,
            },
            { onConflict: 'org_id,user_id' },
        );

    if (insertError) {
        logError('microsoft_account_save_error', { error: insertError.message });
        return redirectWithStateCleanup(`${appUrl}/app/settings/email?error=save_failed`);
    }

    logInfo('microsoft_account_connected', { orgId: verifiedState.orgId, email });
    return redirectWithStateCleanup(`${appUrl}/app/settings/email?success=connected`);
}
