# Security Baseline (Phase 6)

## HTTP Security Headers
Configured in `apps/web/next.config.mjs` for all routes:

- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `X-Frame-Options: DENY`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `Content-Security-Policy` (baseline policy)

## CSP Baseline
Current CSP allows required Next.js and Supabase behavior:
- `default-src 'self'`
- `frame-ancestors 'none'`
- `form-action 'self'`
- `img-src 'self' data: https:`
- `font-src 'self' https://fonts.gstatic.com`
- `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`
- `script-src 'self' 'unsafe-inline' 'unsafe-eval'`
- `connect-src 'self' https://*.supabase.co`

This is a practical baseline for launch. Tightening CSP further is recommended after monitoring production behavior.

## Abuse Protection
- `POST /api/start-trial`: 5 requests / 10 minutes / IP.
- `POST /api/contact-request`: 10 requests / 10 minutes / IP.
- Honeypot field (`website`) is enforced on both endpoints.

## Secrets Safety
- `SUPABASE_SERVICE_ROLE_KEY` is server-only.
- Service role usage is limited to route handlers / server utilities.
- Never expose `SUPABASE_SERVICE_ROLE_KEY` via client code or `NEXT_PUBLIC_*`.

## Notes
- Rate limiting is in-memory for MVP pilot and works per runtime instance.
- For distributed hard limits later, move limiter storage to Redis/Upstash.
