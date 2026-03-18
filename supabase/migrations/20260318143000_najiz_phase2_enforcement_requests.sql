create table if not exists public.enforcement_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  external_case_id uuid null references public.external_cases(id) on delete set null,
  matter_id uuid null references public.matters(id) on delete set null,
  sync_job_id uuid null references public.integration_sync_jobs(id) on delete set null,
  provider text not null default 'najiz' check (provider in ('najiz')),
  source text not null default 'najiz',
  external_id text not null,
  request_number text null,
  request_type text not null default 'other' check (request_type in ('execution_order', 'attachment', 'travel_ban', 'payment', 'notice', 'other')),
  title text not null,
  status text not null default 'unknown' check (status in ('draft', 'submitted', 'under_review', 'in_progress', 'resolved', 'rejected', 'closed', 'unknown')),
  applicant_name text null,
  respondent_name text null,
  amount numeric(12,2) null,
  currency text not null default 'SAR',
  submitted_at timestamptz null,
  closed_at timestamptz null,
  payload_json jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, provider, external_id)
);

drop trigger if exists enforcement_requests_set_updated_at on public.enforcement_requests;
create trigger enforcement_requests_set_updated_at
before update on public.enforcement_requests
for each row
execute function public.set_updated_at();

create index if not exists idx_enforcement_requests_org_matter
  on public.enforcement_requests (org_id, matter_id, synced_at desc);
create index if not exists idx_enforcement_requests_org_case
  on public.enforcement_requests (org_id, external_case_id, synced_at desc);

grant select, insert, update, delete on public.enforcement_requests to authenticated, service_role;

alter table public.enforcement_requests enable row level security;

drop policy if exists enforcement_requests_select_member on public.enforcement_requests;
drop policy if exists enforcement_requests_insert_member on public.enforcement_requests;
drop policy if exists enforcement_requests_update_member on public.enforcement_requests;
drop policy if exists enforcement_requests_delete_owner on public.enforcement_requests;

create policy enforcement_requests_select_member
on public.enforcement_requests
for select
to authenticated
using (
  public.is_org_member(org_id)
);

create policy enforcement_requests_insert_member
on public.enforcement_requests
for insert
to authenticated
with check (
  public.is_org_member(org_id)
);

create policy enforcement_requests_update_member
on public.enforcement_requests
for update
to authenticated
using (
  public.is_org_member(org_id)
)
with check (
  public.is_org_member(org_id)
);

create policy enforcement_requests_delete_owner
on public.enforcement_requests
for delete
to authenticated
using (
  public.is_org_owner(org_id)
);

create table if not exists public.enforcement_request_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  enforcement_request_id uuid not null references public.enforcement_requests(id) on delete cascade,
  matter_id uuid null references public.matters(id) on delete set null,
  source text not null default 'najiz',
  external_id text not null,
  action_type text not null default 'timeline' check (action_type in ('status_change', 'payment', 'notice', 'session', 'timeline')),
  title text not null,
  description text null,
  occurred_at timestamptz null,
  payload_json jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (org_id, source, enforcement_request_id, external_id)
);

create index if not exists idx_enforcement_request_events_request_created
  on public.enforcement_request_events (enforcement_request_id, created_at desc);
create index if not exists idx_enforcement_request_events_matter_created
  on public.enforcement_request_events (matter_id, created_at desc);

grant select, insert, update, delete on public.enforcement_request_events to authenticated, service_role;

alter table public.enforcement_request_events enable row level security;

drop policy if exists enforcement_request_events_select_member on public.enforcement_request_events;
drop policy if exists enforcement_request_events_insert_member on public.enforcement_request_events;
drop policy if exists enforcement_request_events_update_member on public.enforcement_request_events;
drop policy if exists enforcement_request_events_delete_owner on public.enforcement_request_events;

create policy enforcement_request_events_select_member
on public.enforcement_request_events
for select
to authenticated
using (
  public.is_org_member(org_id)
);

create policy enforcement_request_events_insert_member
on public.enforcement_request_events
for insert
to authenticated
with check (
  public.is_org_member(org_id)
);

create policy enforcement_request_events_update_member
on public.enforcement_request_events
for update
to authenticated
using (
  public.is_org_member(org_id)
)
with check (
  public.is_org_member(org_id)
);

create policy enforcement_request_events_delete_owner
on public.enforcement_request_events
for delete
to authenticated
using (
  public.is_org_owner(org_id)
);

alter table if exists public.integration_sync_jobs
  drop constraint if exists integration_sync_jobs_job_kind_check;

alter table if exists public.integration_sync_jobs
  add constraint integration_sync_jobs_job_kind_check
  check (job_kind in ('health_check', 'lawyer_verification', 'case_sync', 'judicial_cost_sync', 'enforcement_request_sync'));

alter table if exists public.notifications
  drop constraint if exists notifications_category_check;

alter table if exists public.notifications
  add constraint notifications_category_check
  check (category in ('integration_sync', 'lawyer_verification', 'case_sync', 'judicial_cost', 'enforcement_request'));
