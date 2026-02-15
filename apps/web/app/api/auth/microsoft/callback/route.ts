import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { encryptToken } from '@/lib/token-crypto';
import { logError, logInfo } from '@/lib/logger';

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
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    if (error) {
        logError('microsoft_oauth_error', { error, description: searchParams.get('error_description') });
        return NextResponse.redirect(`${appUrl}/app/settings/email?error=oauth_denied`);
    }

    if (!code || !state) {
        return NextResponse.redirect(`${appUrl}/app/settings/email?error=missing_params`);
    }

    // Decode state
    let stateData: { orgId: string; userId: string };
    try {
        stateData = JSON.parse(Buffer.from(state, 'base64url').toString('utf8'));
    } catch {
        return NextResponse.redirect(`${appUrl}/app/settings/email?error=invalid_state`);
    }

    const clientId = process.env.MICROSOFT_CLIENT_ID;
    const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
    const redirectUri = `${appUrl}/api/auth/microsoft/callback`;

    if (!clientId || !clientSecret) {
        return NextResponse.redirect(`${appUrl}/app/settings/email?error=not_configured`);
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
            return NextResponse.redirect(`${appUrl}/app/settings/email?error=token_exchange`);
        }

        tokenData = await tokenRes.json();
    } catch (err) {
        logError('microsoft_token_fetch_error', { error: err instanceof Error ? err.message : 'unknown' });
        return NextResponse.redirect(`${appUrl}/app/settings/email?error=token_fetch`);
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
                org_id: stateData.orgId,
                user_id: stateData.userId,
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
        return NextResponse.redirect(`${appUrl}/app/settings/email?error=save_failed`);
    }

    logInfo('microsoft_account_connected', { orgId: stateData.orgId, email });
    return NextResponse.redirect(`${appUrl}/app/settings/email?success=connected`);
}
