import 'server-only';

import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';

const DEFAULT_OTP_LENGTH = 6;
const DEFAULT_OTP_TTL_SECONDS = 5 * 60;
const DEFAULT_OTP_MAX_ATTEMPTS = 5;
const DEFAULT_OTP_RESEND_COOLDOWN_SECONDS = 60;

export function getClientPortalOtpTtlSeconds() {
  const raw = Number(process.env.CLIENT_PORTAL_OTP_TTL_SECONDS ?? DEFAULT_OTP_TTL_SECONDS);
  if (!Number.isFinite(raw)) return DEFAULT_OTP_TTL_SECONDS;
  return Math.min(15 * 60, Math.max(60, Math.floor(raw)));
}

export function getClientPortalOtpMaxAttempts() {
  const raw = Number(process.env.CLIENT_PORTAL_OTP_MAX_ATTEMPTS ?? DEFAULT_OTP_MAX_ATTEMPTS);
  if (!Number.isFinite(raw)) return DEFAULT_OTP_MAX_ATTEMPTS;
  return Math.min(10, Math.max(3, Math.floor(raw)));
}

export function getClientPortalOtpResendCooldownSeconds() {
  const raw = Number(process.env.CLIENT_PORTAL_OTP_RESEND_SECONDS ?? DEFAULT_OTP_RESEND_COOLDOWN_SECONDS);
  if (!Number.isFinite(raw)) return DEFAULT_OTP_RESEND_COOLDOWN_SECONDS;
  return Math.min(5 * 60, Math.max(15, Math.floor(raw)));
}

export function generateClientPortalOtpCode() {
  const upperBound = 10 ** DEFAULT_OTP_LENGTH;
  return String(randomInt(0, upperBound)).padStart(DEFAULT_OTP_LENGTH, '0');
}

function getClientPortalOtpSecret() {
  const secret =
    process.env.CLIENT_PORTAL_OTP_SECRET?.trim() ||
    process.env.JWT_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!secret) {
    throw new Error('Missing CLIENT_PORTAL_OTP_SECRET');
  }

  return secret;
}

export function hashClientPortalOtpCode(code: string) {
  return createHmac('sha256', getClientPortalOtpSecret())
    .update(code)
    .digest('hex');
}

export function verifyClientPortalOtpCode(storedHash: string, candidateCode: string) {
  if (!storedHash || !candidateCode) return false;

  const candidateHash = hashClientPortalOtpCode(candidateCode);
  const storedBuffer = Buffer.from(storedHash, 'hex');
  const candidateBuffer = Buffer.from(candidateHash, 'hex');

  if (storedBuffer.length !== candidateBuffer.length) {
    return false;
  }

  return timingSafeEqual(storedBuffer, candidateBuffer);
}
