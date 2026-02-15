import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAuthUser } from '@/lib/supabase/auth-session';
import { requireOrgIdForUser } from '@/lib/org';

/**
 * GET /api/auth/microsoft
 * Initiates Microsoft OAuth 2.0 flow for email integration.
 * Redirects to Microsoft authorization endpoint.
 */
export async function GET(_request: NextRequest) {
    const user = await getCurrentAuthUser();
    if (!user) {
        return NextResponse.redirect(new URL('/signin', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'));
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

    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/auth/microsoft/callback`;
    const scope = 'openid email profile Mail.Read Mail.Send offline_access';
    const state = Buffer.from(JSON.stringify({ orgId, userId: user.id })).toString('base64url');

    const authUrl = new URL('https://login.microsoftonline.com/common/oauth2/v2.0/authorize');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('scope', scope);
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('response_mode', 'query');

    return NextResponse.redirect(authUrl.toString());
}
