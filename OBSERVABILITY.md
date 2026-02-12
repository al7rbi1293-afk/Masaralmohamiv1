# Observability Guide (Phase 6)

## Logging Approach
- Logging is implemented with `apps/web/lib/logger.ts`.
- Logs are emitted as JSON lines to stdout/stderr.
- Each event includes:
  - `timestamp`
  - `level`
  - `event`
  - contextual fields (for example `requestId`, `ip`, `userId`, `orgId`).

## Request ID
- API routes accept `X-Request-Id` if provided.
- If missing, the server generates one.
- `POST /api/start-trial` and `POST /api/contact-request` return `x-request-id` header.
- Error JSON responses include `requestId` in the body.

## Key Business Events
- `trial_started`
- `trial_start_failed`
- `signup_success`
- `signup_failed_existing_user`
- `trial_expired_redirect`
- `contact_request_created`

## Where Events Are Emitted
- `apps/web/app/api/start-trial/route.ts`
- `apps/web/app/api/contact-request/route.ts`

## Viewing Logs on Vercel
1. Open your Vercel project.
2. Go to **Deployments** -> select latest deployment.
3. Open **Runtime Logs**.
4. Search by:
   - event name (example: `trial_started`)
   - request id (example: value from `x-request-id` response header)

## Note
- Current implementation is intentionally lightweight (console-based).
- No external observability vendor is required for pilot launch.
