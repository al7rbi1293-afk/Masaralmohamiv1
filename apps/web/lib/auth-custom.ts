import 'server-only';

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

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
    // Prefer a dedicated JWT_SECRET env var, fall back to SUPABASE_SERVICE_ROLE_KEY
    const secret = process.env.JWT_SECRET?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    if (!secret) {
        throw new Error('Missing JWT_SECRET or SUPABASE_SERVICE_ROLE_KEY environment variable.');
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

export function generateSessionToken(payload: SessionPayload): string {
    const secret = getJwtSecret();
    return jwt.sign(
        {
            sub: payload.userId,
            email: payload.email,
        },
        secret,
        {
            algorithm: JWT_ALGORITHM,
            expiresIn: JWT_EXPIRES_IN,
        },
    );
}

export function verifySessionToken(token: string): SessionPayload | null {
    try {
        const secret = getJwtSecret();
        const decoded = jwt.verify(token, secret, {
            algorithms: [JWT_ALGORITHM],
        }) as jwt.JwtPayload;

        if (!decoded.sub || !decoded.email) {
            return null;
        }

        return {
            userId: decoded.sub,
            email: decoded.email as string,
        };
    } catch {
        return null;
    }
}
