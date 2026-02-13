type LogLevel = 'info' | 'warn' | 'error';

type LogData = Record<string, unknown>;

import 'server-only';

const REDACTED = '[REDACTED]';

function looksLikeJwt(value: string) {
  return /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value);
}

function maskEmail(value: string) {
  const normalized = value.trim();
  const atIndex = normalized.indexOf('@');
  if (atIndex <= 0) return '***';
  const local = normalized.slice(0, atIndex);
  const domain = normalized.slice(atIndex + 1);
  const first = local.slice(0, 1);
  return `${first}***@${domain}`;
}

function maskPhone(value: string) {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '***';
  const tail = digits.slice(-4);
  return `***${tail}`;
}

function sanitizeValue(value: unknown, depth = 0, key = ''): unknown {
  if (depth > 4) return '[TRUNCATED]';
  if (value === null || value === undefined) return value;

  const normalizedKey = String(key || '').toLowerCase();

  if (
    normalizedKey.includes('token') ||
    normalizedKey.includes('secret') ||
    normalizedKey.includes('password') ||
    normalizedKey.includes('authorization') ||
    normalizedKey.includes('service') && normalizedKey.includes('key')
  ) {
    return REDACTED;
  }

  if (typeof value === 'string') {
    if (looksLikeJwt(value)) return REDACTED;
    if (normalizedKey.includes('email')) return maskEmail(value);
    if (normalizedKey.includes('phone')) return maskPhone(value);
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeValue(entry, depth + 1, key));
  }

  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const output: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      output[k] = sanitizeValue(v, depth + 1, k);
    }
    return output;
  }

  return value;
}

function sanitizeData(data: LogData) {
  return sanitizeValue(data, 0) as LogData;
}

function shouldCaptureInSentry() {
  const dsn = process.env.SENTRY_DSN?.trim() || process.env.NEXT_PUBLIC_SENTRY_DSN?.trim();
  return Boolean(dsn);
}

function emit(level: LogLevel, event: string, data: LogData = {}) {
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...sanitizeData(data),
  };

  const line = JSON.stringify(payload);

  if (level === 'error') {
    console.error(line);

    // Best-effort error tracking (no request bodies, no PII; logger sanitizes already).
    if (shouldCaptureInSentry()) {
      void import('@sentry/nextjs')
        .then((Sentry) => {
          Sentry.captureMessage(event, {
            level: 'error',
            extra: payload,
          });
        })
        .catch(() => {
          // ignore
        });
    }
    return;
  }

  if (level === 'warn') {
    console.warn(line);
    return;
  }

  console.log(line);
}

export function logInfo(event: string, data?: LogData) {
  emit('info', event, data);
}

export function logWarn(event: string, data?: LogData) {
  emit('warn', event, data);
}

export function logError(event: string, data?: LogData) {
  emit('error', event, data);
}
