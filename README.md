# مسار المحامي | Masar Al-Muhami

Next.js (App Router) + Supabase.

## Current scope (Phase 1 + Phase 2 foundation)

- Marketing pages preserved:
  - `/`
  - `/security`
  - `/privacy`
  - `/terms`
  - `/contact`
- Protected app area:
  - `/app`
- Auth skeleton:
  - `/signin`
  - Sign out inside `/app`
- Trial status debug endpoint:
  - `/app/api/trial-status`
- Supabase migration:
  - `supabase/migrations/0001_init.sql`

## Run locally

```bash
npm install
npm run dev --workspace @masar/web
```

Open: [http://localhost:3000](http://localhost:3000)

## Required environment variables

Set in `apps/web/.env.local`:

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

## Notes

- `/app` redirects to `/signin` when unauthenticated.
- `getTrialStatusForCurrentUser` is implemented in:
  - `apps/web/lib/trial.ts`
