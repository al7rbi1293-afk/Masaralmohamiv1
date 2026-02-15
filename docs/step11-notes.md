# Step 11 — Baseline Notes

**Date**: 2026-02-15
**Router**: Next.js App Router (`/app` directory)
**Next.js Version**: 14.2.35

## Current Public Routes

| Route | Type | Description |
|-------|------|-------------|
| `/` | Static | Landing page |
| `/contact` | Static | Contact form → `/api/contact-request` |
| `/privacy` | Static | Privacy policy |
| `/terms` | Static | Terms of service |
| `/security` | Static | Security page |
| `/signin` | Dynamic | Sign in |
| `/signup` | Dynamic | Sign up |
| `/invite/[token]` | Dynamic | Accept team invite |

## Platform Routes (under `/app`)

| Route | Description |
|-------|-------------|
| `/app` | Dashboard |
| `/app/clients` | Client management |
| `/app/matters` | Case/matter management |
| `/app/tasks` | Task management |
| `/app/documents` | Document management |
| `/app/templates` | Legal templates |
| `/app/billing/invoices` | Billing/invoices |
| `/app/reports` | Reports |
| `/app/audit` | Audit log |
| `/app/settings` | Settings (team, subscription, email, etc.) |
| `/app/expired` | Trial expired page |

## Contact Form Behavior

- Component: `components/sections/contact-form.tsx`
- Submits to: `POST /api/contact-request`
- Inserts into: `full_version_requests` table
- Anti-spam: honeypot field (`website`) + rate limiting (10 req/10 min)
- States: idle → submitting → success (auto-resets after 4s)

## Auth Flow

- Signup: `/signup` → server action `signUpAction` → Supabase auth
- Trial start: `/api/start-trial` → creates org + membership + trial_subscription (14 days)
- Middleware: `/app/*` routes protected; checks trial/subscription status → redirects to `/app/expired` if locked

## Existing Database Tables

leads, organizations, profiles, memberships, trial_subscriptions, full_version_requests,
clients, matters, matter_events, documents, tasks, audit_log, invoices, invoice_items,
org_invitations, plans, subscriptions, subscription_events, templates, template_drafts,
email_logs, integrations, najiz_sync_logs

## Blockers

None identified. Build passes. All dependencies installed.
