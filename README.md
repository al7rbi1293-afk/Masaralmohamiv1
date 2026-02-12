# مسار المحامي | Masar Al-Muhami

Next.js (App Router) + Supabase.

## Current scope (Phase 1 + 2 + 3 + 4 + 5 + 6 + 7.1.1)

- Marketing pages:
  - `/`
  - `/security`
  - `/privacy`
  - `/terms`
  - `/contact`
  - Landing trial form section: `/#trial`
- Auth routes:
  - `/signin`
  - `/signup`
- Protected platform (`/app`) with trial gating:
  - `/app` (Dashboard)
  - `/app/clients` (CRUD + Archive/Restore)
  - `/app/clients/new`
  - `/app/clients/[id]`
  - `/app/matters` (Placeholder)
  - `/app/documents` (Placeholder)
  - `/app/tasks` (Placeholder)
  - `/app/billing` (Placeholder)
  - `/app/reports` (Placeholder)
  - `/app/audit` (Placeholder)
  - `/app/settings`
  - `/app/expired`
- Trial status debug endpoint:
  - `/app/api/trial-status`
- Trial provisioning endpoint:
  - `POST /api/start-trial`
- Contact/activation request endpoint:
  - `POST /api/contact-request`
- Supabase migration:
  - `supabase/migrations/0001_init.sql`
  - `supabase/migrations/0002_full_version_requests.sql`
  - `supabase/migrations/0003_clients.sql`

## Run locally

```bash
npm install
npm run dev --workspace @masar/web
```

Open: [http://localhost:3000](http://localhost:3000)

## Build

```bash
npm run build --workspace @masar/web
```

## E2E Smoke Tests (Playwright)

```bash
npm run test:e2e:install --workspace @masar/web
npm run test:e2e --workspace @masar/web
```

## Required environment variables

Set in `apps/web/.env.local` (see `.env.example`):

```bash
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

## Apply Supabase migration

### Option 1: SQL Editor (manual)

1. Open Supabase Dashboard -> SQL Editor.
2. Copy contents of:
   - `supabase/migrations/0001_init.sql`
   - `supabase/migrations/0002_full_version_requests.sql`
   - `supabase/migrations/0003_clients.sql`
3. Run the query.

### Option 2: Supabase CLI

If Supabase CLI is installed and project is linked:

```bash
supabase db push
```

## Test trial status endpoint locally

1. Sign in at:
   - `http://localhost:3000/signin`
2. Open:
   - `http://localhost:3000/app/api/trial-status`
3. Expected:
   - Logged-in user with no org/trial yet -> `status: "none"`

## Start trial flow

1. Open `http://localhost:3000/#trial`.
2. Fill the 14-day trial form.
3. Backend endpoint `POST /api/start-trial` will:
   - Insert a lead in `public.leads`.
   - Sign in existing user or create user then sign in.
   - Provision `organizations` + `memberships` (owner) if missing.
   - Create `trial_subscriptions` for 14 days if not present.
4. User is redirected to `/app` (or `/app/expired` if existing trial is expired).

## Contact request flow (pilot activation)

1. Forms on `/contact` and `/app/expired` submit to `POST /api/contact-request`.
2. Request is saved to `public.full_version_requests`.
3. Endpoint allows anon/authenticated inserts with RLS policy.

## Clients module (Phase 7.1.1)

بعد تطبيق migration `0003_clients.sql`:
- افتح `/app/clients`
- أضف عميل جديد من `/app/clients/new`
- حدّث بيانات العميل من `/app/clients/[id]`
- أرشف العميل أو استعده من القائمة أو صفحة التفاصيل

## Notes

- `/app` redirects to `/signin` when unauthenticated.
- Expired trials are redirected from `/app/*` to `/app/expired` (except `/app/expired` itself).
- Trial is provisioned per organization and defaults to 14 days.
- Rate limiting:
  - `POST /api/start-trial`: `5` requests / `10` minutes / IP.
  - `POST /api/contact-request`: `10` requests / `10` minutes / IP.
- `getTrialStatusForCurrentUser` is implemented in:
  - `apps/web/lib/trial.ts`
- Deployment guide: `DEPLOYMENT.md`
- QA checklist: `QA_CHECKLIST.md`
- Observability: `OBSERVABILITY.md`
- Security baseline: `SECURITY.md`
- Pilot runbook: `PILOT_PLAYBOOK.md`
- Rate limiting note: `apps/web/lib/rateLimit.md`
