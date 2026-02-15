# Step 12 — QA Checklist

## 12.0 — Baseline

- [ ] Build passes
- [ ] step12-notes.md exists
- [ ] step12-checklist.md exists (this file)

## 12.1 — Templates V2 (Doc Engine + Export)

- [ ] Create doc draft from preset for a matter
- [ ] Export as PDF → stored in Supabase Storage → doc_generations.file_path set
- [ ] Export as DOCX → stored similarly
- [ ] Cannot access other org's doc_generations (RLS)

## 12.2 — Calendar (Events + Reminders + ICS)

- [ ] Create standalone calendar event
- [ ] Event shows in calendar page
- [ ] ICS feed URL valid (subscribe in client)
- [ ] Reminder job created automatically
- [ ] Reminder cron processes jobs
- [ ] Cannot access other org's events (RLS)

## 12.3 — Email Integration (OAuth)

- [ ] Connect Microsoft mailbox via OAuth
- [ ] Sync pulls messages into email_messages
- [ ] Link email to matter
- [ ] Send email from matter context
- [ ] Tokens stored encrypted
- [ ] Cannot access other org's emails (RLS)

## 12.4 — Najiz-Ready Workspace

- [ ] Create Najiz packet for matter
- [ ] Checklist items + attach documents
- [ ] Export summary PDF
- [ ] Mark as "submitted_manual"
- [ ] No automation/scraping exists

## 12.5 — Plan Limits

- [ ] Trial plan blocks exceeding max_users
- [ ] Trial plan blocks exceeding max_matters
- [ ] Upgrade CTA shown on limit hit

## 12.6 — Reporting V1

- [ ] Reports page shows: open matters, events, overdue tasks, docs generated, lead sources
- [ ] CSV export: clients, matters, tasks

## 12.7 — Hardening

- [ ] Rate limiting on /api/docs/export, /api/calendar/ics, /api/email/*, /api/najiz/*
- [ ] Security/privacy/terms dates updated
- [ ] Build passes

## 12.8 — Release

- [ ] All env vars set in Vercel
- [ ] Deploy succeeds
- [ ] All above items PASS
