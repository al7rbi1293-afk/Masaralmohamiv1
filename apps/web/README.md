# Masar Al-Muhami (Web)

Next.js App Router codebase for:

- Marketing pages: `/`, `/security`, `/privacy`, `/terms`, `/contact`
- Trial platform pages under `/app` (protected)

## Trial platform routes (Phase 3 + 4 + 5 readiness)

- `/signin`
- `/signup`
- `/app` (Dashboard)
- `/app/settings`
- `/app/billing`
- `/app/expired`
- `GET /app/api/trial-status` (debug)
- `POST /api/start-trial` (landing trial provisioning)

## Trial gating behavior

- If trial is expired, `/app`, `/app/settings`, `/app/billing` redirect to `/app/expired`.
- If no org/trial exists, dashboard stays accessible and shows activation CTA.
- Trial is provisioned per organization and starts at 14 days.

## Local run

From repo root:

```bash
npm install
npm run dev --workspace @masar/web
```

Then open [http://localhost:3000](http://localhost:3000).

## Build

From repo root:

```bash
npm run build --workspace @masar/web
```

## Required environment variables

Create `apps/web/.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

## Apply migrations

### Option 1: Supabase SQL Editor

Copy/paste `supabase/migrations/0001_init.sql` into SQL Editor and run it.

### Option 2: Supabase CLI

```bash
supabase db push
```

## Test trial-status endpoint

1. Sign in at `/signin`
2. Open `/app/api/trial-status`
3. If no organization/trial exists yet, response should include:
   - `status: "none"`

## Start-trial flow

1. Open landing section `/#trial`.
2. Submit form (name, email, password, optional phone/firm name).
3. Server route `/api/start-trial`:
   - Inserts `leads` row.
   - Signs in or creates auth user then signs in.
   - Provisions organization + owner membership if needed.
   - Creates 14-day trial if none exists.
4. Redirects to `/app` (or `/app/expired` when trial is expired).

## Deployment

Deployment runbook:

- `/DEPLOYMENT.md`
