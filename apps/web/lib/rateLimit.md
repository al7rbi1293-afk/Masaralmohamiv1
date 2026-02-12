# Rate Limiting (In-Memory)

This MVP uses an in-memory rate limiter (`apps/web/lib/rateLimit.ts`).

Notes:
- Works per runtime instance.
- On Vercel, multiple instances may allow a higher effective overall rate.
- For strict global limits later, move storage to Redis/Upstash.

