import 'server-only';

import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';

// ────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────

const BCRYPT_ROUNDS = 12;
const JWT_EXPIRES_IN = '7d'; // 7 days
const JWT_ALGORITHM = 'HS256' as const;

export const SESSION_COOKIE_NAME = 'masar-session';
export const SESSION_COOKIE_OPTIONS = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
};

// ────────────────────────────────────────────
// JWT Secret
// ────────────────────────────────────────────

function getJwtSecret(): string {
    const secret =
        process.env.JWT_SECRET?.trim() ||
        process.env.JWT_ACCESS_SECRET?.trim() ||
        process.env.JWT_REFRESH_SECRET?.trim();
    if (!secret) {
        throw new Error('Missing JWT secret environment variable.');
    }
    return secret;
}

// ────────────────────────────────────────────
// Password Hashing
// ────────────────────────────────────────────

export async function hashPassword(plainPassword: string): Promise<string> {
    return bcrypt.hash(plainPassword, BCRYPT_ROUNDS);
}

export async function verifyPassword(plainPassword: string, hash: string): Promise<boolean> {
    if (!hash) return false;
    return bcrypt.compare(plainPassword, hash);
}

// ────────────────────────────────────────────
// JWT Token Management
// ────────────────────────────────────────────

export type SessionPayload = {
    userId: string;
    email: string;
};

export async function generateSessionToken(payload: SessionPayload): Promise<string> {
    const secret = getJwtSecret();
    const encodedSecret = new TextEncoder().encode(secret);
    return new SignJWT({
        sub: payload.userId,
        email: payload.email,
    })
        .setProtectedHeader({ alg: JWT_ALGORITHM })
        .setIssuedAt()
        .setExpirationTime(JWT_EXPIRES_IN)
        .sign(encodedSecret);
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
    try {
        const secret = getJwtSecret();
        const encodedSecret = new TextEncoder().encode(secret);
        const { payload } = await jwtVerify(token, encodedSecret, {
            algorithms: [JWT_ALGORITHM],
        });

        if (!payload.sub || !payload.email) {
            return null;
        }

        return {
            userId: payload.sub as string,
            email: payload.email as string,
        };
    } catch {
        return null;
    }
}
