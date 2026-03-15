import 'server-only';

import { cookies } from 'next/headers';
import { jwtVerify, SignJWT } from 'jose';

const CLIENT_PORTAL_JWT_ALGORITHM = 'HS256' as const;
const CLIENT_PORTAL_JWT_EXPIRES_IN = '7d';

export const CLIENT_PORTAL_SESSION_COOKIE_NAME = 'masar-client-portal-session';
export const CLIENT_PORTAL_SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: 7 * 24 * 60 * 60,
};

export type ClientPortalSessionPayload = {
  portalUserId: string;
  clientId: string;
  orgId: string;
  email: string;
};

function getClientPortalSessionSecret() {
  const secret =
    process.env.CLIENT_PORTAL_SESSION_SECRET?.trim() ||
    process.env.JWT_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!secret) {
    throw new Error('Missing CLIENT_PORTAL_SESSION_SECRET');
  }

  return secret;
}

export async function generateClientPortalSessionToken(payload: ClientPortalSessionPayload) {
  const secret = new TextEncoder().encode(getClientPortalSessionSecret());

  return new SignJWT({
    portal_user_id: payload.portalUserId,
    client_id: payload.clientId,
    org_id: payload.orgId,
    email: payload.email,
  })
    .setProtectedHeader({ alg: CLIENT_PORTAL_JWT_ALGORITHM })
    .setIssuedAt()
    .setExpirationTime(CLIENT_PORTAL_JWT_EXPIRES_IN)
    .sign(secret);
}

export async function verifyClientPortalSessionToken(token: string): Promise<ClientPortalSessionPayload | null> {
  try {
    const secret = new TextEncoder().encode(getClientPortalSessionSecret());
    const { payload } = await jwtVerify(token, secret, {
      algorithms: [CLIENT_PORTAL_JWT_ALGORITHM],
    });

    const portalUserId = String(payload.portal_user_id ?? '');
    const clientId = String(payload.client_id ?? '');
    const orgId = String(payload.org_id ?? '');
    const email = String(payload.email ?? '');

    if (!portalUserId || !clientId || !orgId || !email) {
      return null;
    }

    return {
      portalUserId,
      clientId,
      orgId,
      email,
    };
  } catch {
    return null;
  }
}

export async function getCurrentClientPortalSession(): Promise<ClientPortalSessionPayload | null> {
  const cookieStore = cookies();
  const token = cookieStore.get(CLIENT_PORTAL_SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return null;
  }

  return verifyClientPortalSessionToken(token);
}
