import { createCsrfProtect } from '@edge-csrf/nextjs';
import { cookies, headers } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

const CSRF_COOKIE_NAME = 'csrf_secret';

// CSRF middleware initialization
export const csrfProtect = createCsrfProtect({
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        name: CSRF_COOKIE_NAME,
    },
});

// For Server Actions: manual check
export async function verifyCsrfToken(formData: FormData): Promise<boolean> {
    const tokenFromForm = String(formData.get('csrf_token') ?? '').trim();
    if (!tokenFromForm) return false;

    const requestHeaders = headers();
    const cookieStore = cookies();
    const csrfSecret = cookieStore.get(CSRF_COOKIE_NAME)?.value?.trim();
    if (!csrfSecret) return false;

    const forwardedHost = requestHeaders.get('x-forwarded-host')?.split(',')[0]?.trim();
    const host = forwardedHost || requestHeaders.get('host')?.trim() || 'localhost:3000';
    const forwardedProto = requestHeaders.get('x-forwarded-proto')?.split(',')[0]?.trim();
    const proto = forwardedProto || (host.includes('localhost') ? 'http' : 'https');
    const verifyUrl = `${proto}://${host}/_csrf-verify`;

    const verifyRequest = new NextRequest(verifyUrl, {
        method: 'POST',
        headers: new Headers({
            cookie: `${CSRF_COOKIE_NAME}=${csrfSecret}`,
            'x-csrf-token': tokenFromForm,
        }),
    });

    try {
        await csrfProtect(verifyRequest, NextResponse.next());
        return true;
    } catch {
        return false;
    }
}
