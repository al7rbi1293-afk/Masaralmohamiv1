# Go-Live Checklist — Masar Al-Muhami

## Pre-Deploy

- [ ] All env vars set in Vercel:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `NEXT_PUBLIC_SITE_URL` (production domain)
  - `NEXT_PUBLIC_APP_URL` (production domain)
  - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
  - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
  - `STRIPE_PRICE_ID_SOLO`, `STRIPE_PRICE_ID_TEAM`
  - `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_DSN`
  - `NEXT_PUBLIC_GA_ID` (optional — GA4)
  - `NEXT_PUBLIC_META_PIXEL_ID` (optional — Meta Pixel)
  - `CRON_SECRET` (optional — protects cron endpoints)
- [ ] Run Supabase migration: `supabase db push` or apply `0023_leads_v2.sql`
- [ ] `npm run build` passes locally

## SEO

- [ ] Visit `/sitemap.xml` → only marketing pages (/, /security, /privacy, /terms, /contact)
- [ ] Visit `/robots.txt` → disallows /app/*, /api/*, /signin, /signup, /invite/*
- [ ] View source on `/app` → contains `<meta name="robots" content="noindex, nofollow">`
- [ ] `grep -r "example.com" apps/web` → 0 results

## Leads Pipeline

- [ ] Submit `/contact` form → row appears in `leads` table
- [ ] Honeypot field filled → rejected
- [ ] Submit 11 rapid requests → rate limited on 11th

## Auth + Trial

- [ ] Sign up new user → org + membership + trial_subscription created
- [ ] Trial shows 14-day expiry
- [ ] Expired trial → redirected to `/app/expired`

## Core Modules

- [ ] Create client → row in `clients` with correct org_id
- [ ] Create matter → row in `matters` with org_id isolation
- [ ] Create task → assigned to matter
- [ ] Upload document → stored in Supabase Storage

## Upgrade Page

- [ ] Visit `/upgrade` → page renders with CTAs
- [ ] Submit upgrade request → row in `leads` with topic='upgrade'

## Emails + Cron

- [ ] `GET /api/cron/trial-check` → returns `{ ok: true }`
- [ ] Vercel Cron configured (daily at 08:00 UTC)
- [ ] Verify SMTP credentials work (send test email)

## Analytics

- [ ] With GA4 ID set: page views fire in GA debug
- [ ] UTM params from URL stored in localStorage

## Security

- [ ] Rate limiting works on `/api/leads`
- [ ] Sentry captures errors
- [ ] Security headers present (check via browser DevTools → Network → Headers)

## Post-Deploy

- [ ] Verify production domain resolves
- [ ] Verify SSL certificate
- [ ] Test signup → login → dashboard flow end-to-end
- [ ] Monitor Sentry for first 24h
