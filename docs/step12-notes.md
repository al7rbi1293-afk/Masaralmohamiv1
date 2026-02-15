# Step 12 — Baseline Notes

## Confirmed Step 11 Routes

| Route | Type | Status |
| ----- | ---- | ------ |
| `/` (marketing) | Static | ✅ |
| `/contact` | Dynamic | ✅ |
| `/privacy`, `/terms`, `/security` | Static | ✅ |
| `/signin`, `/signup` | Dynamic | ✅ |
| `/app/dashboard` | Protected | ✅ |
| `/app/clients`, `/app/matters`, `/app/tasks` | Protected | ✅ |
| `/app/documents` | Protected | ✅ |
| `/app/templates` (+ `/new`, `/[id]`) | Protected | ✅ |
| `/app/calendar` | Protected | ✅ |
| `/app/reports` | Protected | ✅ |
| `/app/settings` (+ sub-routes) | Protected | ✅ |
| `/upgrade` | Static | ✅ |
| `/api/leads` | API | ✅ |
| `/api/cron/trial-check` | Cron | ✅ |

## Current Tables (from migrations 0001–0023)

| Table | Migration |
| ----- | --------- |
| organizations, memberships, profiles | 0001 |
| full_version_requests | 0002 |
| clients | 0003 |
| matters | 0004 |
| matter_events | 0005 |
| documents | 0006 |
| tasks | 0007 |
| invoices, quotes, audit_log | 0008 |
| org_invitations | 0011 |
| (search + perf indexes) | 0013, 0014 |
| trial_subscriptions, org_subscriptions | 0015 |
| templates, template_versions, template_runs | 0018 |
| email_logs | 0019 |
| org_integrations | 0020 |
| najiz_sync_runs, external_cases | 0021 |
| template_presets (4 presets seeded) | 0022 |
| leads (v2 columns: topic, message, utm, referrer) | 0023 |

## Template Presets Endpoint

- `lib/templatePresets.ts` — code-level preset definitions
- `GET /api/templates/presets` — serves presets from DB
- DB presets: WAKALA, PETITION, MEMO, NOTICE

## Existing Calendar

- Full month-view + 14-day upcoming
- Sources: `matter_events`, `tasks`, `invoices`
- Filters: type (hearings, meetings, tasks, invoices) + "my items"
- ICS export link exists in UI (not yet a real ICS endpoint)

## Existing Reports

- Reports page at `/app/reports` (exists, ~5KB)

## Key Dependencies (package.json)

- next 14.2.35, react, supabase, zod, nodemailer, lucide-react
- **Missing**: `docx`, `pdf-lib` (needed for Step 12.1)
