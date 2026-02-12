import { NextRequest } from 'next/server';

type RateLimitConfig = {
  key: string;
  limit: number;
  windowMs: number;
};

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
};

type RateBucket = {
  count: number;
  resetAt: number;
};

const rateLimitStoreKey = '__masar_rate_limit_store__';

function getStore() {
  const globalStore = globalThis as typeof globalThis & {
    [rateLimitStoreKey]?: Map<string, RateBucket>;
  };

  if (!globalStore[rateLimitStoreKey]) {
    globalStore[rateLimitStoreKey] = new Map<string, RateBucket>();
  }

  return globalStore[rateLimitStoreKey];
}

export function checkRateLimit(config: RateLimitConfig): RateLimitResult {
  const { key, limit, windowMs } = config;
  const now = Date.now();
  const store = getStore();
  const current = store.get(key);

  if (!current || current.resetAt <= now) {
    const resetAt = now + windowMs;
    store.set(key, { count: 1, resetAt });

    return {
      allowed: true,
      limit,
      remaining: Math.max(0, limit - 1),
      resetAt,
    };
  }

  current.count += 1;
  store.set(key, current);

  const remaining = Math.max(0, limit - current.count);

  return {
    allowed: current.count <= limit,
    limit,
    remaining,
    resetAt: current.resetAt,
  };
}

export function getRequestIp(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const [first] = forwardedFor.split(',');
    if (first) {
      return first.trim();
    }
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }

  return 'unknown';
}
