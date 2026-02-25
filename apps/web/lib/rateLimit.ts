import { NextRequest } from 'next/server';

export const RATE_LIMIT_MESSAGE_AR = 'تم تجاوز الحد المسموح. حاول مرة أخرى بعد قليل.';

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

import { Redis } from '@upstash/redis';

// Create the Redis instance. Requires UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in env.
const redis = (() => {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    return null;
  }

  try {
    return new Redis({ url, token });
  } catch (err) {
    console.warn('Upstash Redis env variables not found. Rate limiting will bypass.');
    return null;
  }
})();

export async function checkRateLimit(config: RateLimitConfig): Promise<RateLimitResult> {
  const { key, limit, windowMs } = config;
  const now = Date.now();
  const resetAt = now + windowMs;

  if (!redis) {
    return { allowed: true, limit, remaining: limit - 1, resetAt };
  }

  try {
    const pipeline = redis.pipeline();
    pipeline.incr(key);
    pipeline.pexpire(key, windowMs);
    
    const [count] = await pipeline.exec();
    const currentCount = count as number;
    const remaining = Math.max(0, limit - currentCount);

    return {
      allowed: currentCount <= limit,
      limit,
      remaining,
      resetAt,
    };
  } catch (error) {
    console.error('Rate limit error:', error);
    return { allowed: true, limit, remaining: limit - 1, resetAt };
  }
}

export function getRequestIp(request: NextRequest): string {
  // Prefer Vercel's trusted IP (not spoofable by the client)
  const vercelIp = (request as any).ip;
  if (vercelIp && typeof vercelIp === 'string') {
    return vercelIp.trim();
  }

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
