# مسار المحامي | Masar Al-Muhami

Next.js (App Router) + Supabase.

## Current scope (Phase 1 + 2 + 3 + 4 + 5)

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
- Protected trial platform:
  - `/app` (Dashboard)
  - `/app/settings`
  - `/app/billing`
  - `/app/expired`
- Trial status debug endpoint:
  - `/app/api/trial-status`
- Trial provisioning endpoint:
  - `POST /api/start-trial`
- Supabase migration:
  - `supabase/migrations/0001_init.sql`

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

## Notes

- `/app` redirects to `/signin` when unauthenticated.
- Expired trials are redirected from `/app/*` to `/app/expired` (except `/app/expired` itself).
- Trial is provisioned per organization and defaults to 14 days.
- `getTrialStatusForCurrentUser` is implemented in:
  - `apps/web/lib/trial.ts`
- Deployment guide:
  - `DEPLOYMENT.md`
