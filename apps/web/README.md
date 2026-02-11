# Masar Al-Muhami (Web)

Next.js App Router codebase for:

- Marketing pages: `/`, `/security`, `/privacy`, `/terms`, `/contact`
- Trial platform pages under `/app` (protected)

## Phase 2 deliverables in this repo

- Supabase migration SQL:
  - `supabase/migrations/0001_init.sql`
- Strict RLS policies for:
  - `leads`
  - `organizations`
  - `profiles`
  - `memberships`
  - `trial_subscriptions`
- Auto profile creation trigger:
  - `public.handle_new_user()` on `auth.users`
- Server-side trial helper:
  - `apps/web/lib/trial.ts`
- Debug endpoint:
  - `GET /app/api/trial-status`

## Local run

From repo root:

```bash
npm install
npm run dev --workspace @masar/web
```

Then open [http://localhost:3000](http://localhost:3000).

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
