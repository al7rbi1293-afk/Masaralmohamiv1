create extension if not exists pgcrypto;

alter table public.org_integrations
  add column if not exists active_environment text not null default 'sandbox',
  add column if not exists health_status text not null default 'not_configured',
  add column if not exists last_synced_at timestamptz null,
  add column if not exists last_health_checked_at timestamptz null,
  add column if not exists last_health_error text null,
  add column if not exists updated_by uuid null,
  add column if not exists config_version integer not null default 2;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'org_integrations_updated_by_fkey'
  ) then
    alter table public.org_integrations
      add constraint org_integrations_updated_by_fkey
      foreign key (updated_by)
      references public.app_users(id)
      on delete set null;
  end if;
end
$$;

create index if not exists idx_org_integrations_health_status
  on public.org_integrations (health_status, active_environment);

update public.org_integrations
set
  active_environment = coalesce(nullif(config ->> 'active_environment', ''), nullif(config ->> 'environment', ''), active_environment, 'sandbox'),
  health_status = case
    when status = 'connected' then 'healthy'
    when status = 'error' then 'degraded'
    else 'not_configured'
  end,
  updated_by = case
    when exists (
      select 1
      from public.app_users au
      where au.id = public.org_integrations.created_by
    ) then public.org_integrations.created_by
    else updated_by
  end;

create table if not exists public.integration_sync_jobs (
  id uuid primary key default gen_random_uuid(),
  legacy_run_id uuid unique null,
  org_id uuid not null references public.organizations(id) on delete cascade,
  integration_id uuid null references public.org_integrations(id) on delete set null,
  provider text not null default 'najiz' check (provider in ('najiz')),
  source text not null default 'najiz',
  job_kind text not null check (job_kind in ('health_check', 'lawyer_verification', 'case_sync', 'judicial_cost_sync')),
  status text not null default 'pending' check (status in ('pending', 'running', 'succeeded', 'failed', 'partial', 'retrying')),
  environment text not null default 'sandbox' check (environment in ('sandbox', 'production')),
  trigger_mode text not null default 'manual' check (trigger_mode in ('manual', 'scheduled', 'webhook', 'system')),
  requested_by uuid null references public.app_users(id) on delete set null,
  matter_id uuid null references public.matters(id) on delete set null,
  subject_type text null,
  subject_id text null,
  attempts integer not null default 0 check (attempts >= 0),
  max_attempts integer not null default 3 check (max_attempts >= 1),
  retryable boolean not null default false,
  started_at timestamptz not null default now(),
  completed_at timestamptz null,
  error_code text null,
  error_message text null,
  summary jsonb not null default '{}'::jsonb,
  request_payload jsonb not null default '{}'::jsonb,
  response_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_integration_sync_jobs_org_created
  on public.integration_sync_jobs (org_id, created_at desc);
create index if not exists idx_integration_sync_jobs_provider_status
  on public.integration_sync_jobs (provider, status, created_at desc);
create index if not exists idx_integration_sync_jobs_org_kind
  on public.integration_sync_jobs (org_id, job_kind, created_at desc);

grant select, insert, update, delete on public.integration_sync_jobs to authenticated, service_role;

alter table public.integration_sync_jobs enable row level security;

drop policy if exists integration_sync_jobs_select_member on public.integration_sync_jobs;
drop policy if exists integration_sync_jobs_insert_member on public.integration_sync_jobs;
drop policy if exists integration_sync_jobs_update_owner_or_requester on public.integration_sync_jobs;
drop policy if exists integration_sync_jobs_delete_owner on public.integration_sync_jobs;

create policy integration_sync_jobs_select_member
on public.integration_sync_jobs
for select
to authenticated
using (
  public.is_org_member(org_id)
);

create policy integration_sync_jobs_insert_member
on public.integration_sync_jobs
for insert
to authenticated
with check (
  public.is_org_member(org_id)
  and (requested_by is null or requested_by = auth.uid())
);

create policy integration_sync_jobs_update_owner_or_requester
on public.integration_sync_jobs
for update
to authenticated
using (
  public.is_org_owner(org_id)
  or requested_by = auth.uid()
)
with check (
  public.is_org_member(org_id)
);

create policy integration_sync_jobs_delete_owner
on public.integration_sync_jobs
for delete
to authenticated
using (
  public.is_org_owner(org_id)
);

create table if not exists public.integration_sync_logs (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.integration_sync_jobs(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null default 'najiz' check (provider in ('najiz')),
  level text not null check (level in ('info', 'warn', 'error')),
  action text not null,
  message text not null,
  context jsonb not null default '{}'::jsonb,
  created_by uuid null references public.app_users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_integration_sync_logs_job_created
  on public.integration_sync_logs (job_id, created_at desc);
create index if not exists idx_integration_sync_logs_org_created
  on public.integration_sync_logs (org_id, created_at desc);

grant select, insert, update, delete on public.integration_sync_logs to authenticated, service_role;

alter table public.integration_sync_logs enable row level security;

drop policy if exists integration_sync_logs_select_member on public.integration_sync_logs;
drop policy if exists integration_sync_logs_insert_member on public.integration_sync_logs;
drop policy if exists integration_sync_logs_delete_owner on public.integration_sync_logs;

create policy integration_sync_logs_select_member
on public.integration_sync_logs
for select
to authenticated
using (
  public.is_org_member(org_id)
);

create policy integration_sync_logs_insert_member
on public.integration_sync_logs
for insert
to authenticated
with check (
  public.is_org_member(org_id)
  and (created_by is null or created_by = auth.uid())
);

create policy integration_sync_logs_delete_owner
on public.integration_sync_logs
for delete
to authenticated
using (
  public.is_org_owner(org_id)
);

alter table public.external_cases
  add column if not exists source text not null default 'najiz',
  add column if not exists payload_json jsonb not null default '{}'::jsonb,
  add column if not exists synced_at timestamptz not null default now(),
  add column if not exists matter_id uuid null,
  add column if not exists case_number text null,
  add column if not exists case_reference text null,
  add column if not exists internal_notes text null,
  add column if not exists linked_by uuid null,
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'external_cases_matter_id_fkey'
  ) then
    alter table public.external_cases
      add constraint external_cases_matter_id_fkey
      foreign key (matter_id)
      references public.matters(id)
      on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'external_cases_linked_by_fkey'
  ) then
    alter table public.external_cases
      add constraint external_cases_linked_by_fkey
      foreign key (linked_by)
      references public.app_users(id)
      on delete set null;
  end if;
end
$$;

drop trigger if exists external_cases_set_updated_at on public.external_cases;
create trigger external_cases_set_updated_at
before update on public.external_cases
for each row
execute function public.set_updated_at();

create index if not exists idx_external_cases_org_matter
  on public.external_cases (org_id, matter_id);
create index if not exists idx_external_cases_source_external
  on public.external_cases (source, external_id);

update public.external_cases
set
  source = coalesce(nullif(source, ''), provider, 'najiz'),
  payload_json = case
    when payload_json = '{}'::jsonb then coalesce(meta, '{}'::jsonb)
    else payload_json
  end,
  synced_at = coalesce(last_synced_at, synced_at, now()),
  case_number = coalesce(case_number, external_id),
  updated_at = coalesce(updated_at, last_synced_at, now());

create table if not exists public.external_case_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  external_case_id uuid not null references public.external_cases(id) on delete cascade,
  matter_id uuid null references public.matters(id) on delete set null,
  source text not null default 'najiz',
  external_id text not null,
  event_type text not null default 'timeline' check (event_type in ('status_change', 'session', 'filing', 'document', 'timeline')),
  title text not null,
  description text null,
  occurred_at timestamptz null,
  payload_json jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (org_id, source, external_case_id, external_id)
);

create index if not exists idx_external_case_events_case_created
  on public.external_case_events (external_case_id, created_at desc);
create index if not exists idx_external_case_events_matter_created
  on public.external_case_events (matter_id, created_at desc);

grant select, insert, update, delete on public.external_case_events to authenticated, service_role;

alter table public.external_case_events enable row level security;

drop policy if exists external_case_events_select_member on public.external_case_events;
drop policy if exists external_case_events_insert_member on public.external_case_events;
drop policy if exists external_case_events_update_member on public.external_case_events;
drop policy if exists external_case_events_delete_owner on public.external_case_events;

create policy external_case_events_select_member
on public.external_case_events
for select
to authenticated
using (
  public.is_org_member(org_id)
);

create policy external_case_events_insert_member
on public.external_case_events
for insert
to authenticated
with check (
  public.is_org_member(org_id)
);

create policy external_case_events_update_member
on public.external_case_events
for update
to authenticated
using (
  public.is_org_member(org_id)
)
with check (
  public.is_org_member(org_id)
);

create policy external_case_events_delete_owner
on public.external_case_events
for delete
to authenticated
using (
  public.is_org_owner(org_id)
);

create table if not exists public.lawyer_verifications (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null default 'najiz' check (provider in ('najiz')),
  source text not null default 'najiz',
  lawyer_user_id uuid null references public.app_users(id) on delete set null,
  sync_job_id uuid null references public.integration_sync_jobs(id) on delete set null,
  requested_by uuid null references public.app_users(id) on delete set null,
  external_id text not null,
  license_number text null,
  national_id text null,
  lawyer_name text null,
  office_name text null,
  status text not null check (status in ('pending', 'verified', 'not_found', 'mismatch', 'failed')),
  verified_at timestamptz null,
  expires_at timestamptz null,
  payload_json jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, provider, external_id)
);

drop trigger if exists lawyer_verifications_set_updated_at on public.lawyer_verifications;
create trigger lawyer_verifications_set_updated_at
before update on public.lawyer_verifications
for each row
execute function public.set_updated_at();

create unique index if not exists idx_lawyer_verifications_org_user
  on public.lawyer_verifications (org_id, provider, lawyer_user_id)
  where lawyer_user_id is not null;
create unique index if not exists idx_lawyer_verifications_org_license
  on public.lawyer_verifications (org_id, provider, license_number)
  where license_number is not null;

grant select, insert, update, delete on public.lawyer_verifications to authenticated, service_role;

alter table public.lawyer_verifications enable row level security;

drop policy if exists lawyer_verifications_select_visible on public.lawyer_verifications;
drop policy if exists lawyer_verifications_insert_member on public.lawyer_verifications;
drop policy if exists lawyer_verifications_update_owner_or_requester on public.lawyer_verifications;
drop policy if exists lawyer_verifications_delete_owner on public.lawyer_verifications;

create policy lawyer_verifications_select_visible
on public.lawyer_verifications
for select
to authenticated
using (
  public.is_org_owner(org_id)
  or lawyer_user_id = auth.uid()
  or requested_by = auth.uid()
);

create policy lawyer_verifications_insert_member
on public.lawyer_verifications
for insert
to authenticated
with check (
  public.is_org_member(org_id)
  and (requested_by is null or requested_by = auth.uid())
);

create policy lawyer_verifications_update_owner_or_requester
on public.lawyer_verifications
for update
to authenticated
using (
  public.is_org_owner(org_id)
  or requested_by = auth.uid()
)
with check (
  public.is_org_member(org_id)
);

create policy lawyer_verifications_delete_owner
on public.lawyer_verifications
for delete
to authenticated
using (
  public.is_org_owner(org_id)
);

create table if not exists public.judicial_costs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  external_case_id uuid null references public.external_cases(id) on delete set null,
  matter_id uuid null references public.matters(id) on delete set null,
  sync_job_id uuid null references public.integration_sync_jobs(id) on delete set null,
  provider text not null default 'najiz' check (provider in ('najiz')),
  source text not null default 'najiz',
  external_id text not null,
  cost_type text not null default 'judicial_cost' check (cost_type in ('judicial_cost', 'invoice', 'fee', 'other')),
  title text not null,
  amount numeric(12,2) not null default 0,
  currency text not null default 'SAR',
  status text not null default 'pending' check (status in ('pending', 'paid', 'overdue', 'waived', 'cancelled', 'unknown')),
  invoice_reference text null,
  due_at timestamptz null,
  payload_json jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, provider, external_id)
);

drop trigger if exists judicial_costs_set_updated_at on public.judicial_costs;
create trigger judicial_costs_set_updated_at
before update on public.judicial_costs
for each row
execute function public.set_updated_at();

create index if not exists idx_judicial_costs_org_matter
  on public.judicial_costs (org_id, matter_id, synced_at desc);
create index if not exists idx_judicial_costs_org_case
  on public.judicial_costs (org_id, external_case_id, synced_at desc);

grant select, insert, update, delete on public.judicial_costs to authenticated, service_role;

alter table public.judicial_costs enable row level security;

drop policy if exists judicial_costs_select_member on public.judicial_costs;
drop policy if exists judicial_costs_insert_member on public.judicial_costs;
drop policy if exists judicial_costs_update_member on public.judicial_costs;
drop policy if exists judicial_costs_delete_owner on public.judicial_costs;

create policy judicial_costs_select_member
on public.judicial_costs
for select
to authenticated
using (
  public.is_org_member(org_id)
);

create policy judicial_costs_insert_member
on public.judicial_costs
for insert
to authenticated
with check (
  public.is_org_member(org_id)
);

create policy judicial_costs_update_member
on public.judicial_costs
for update
to authenticated
using (
  public.is_org_member(org_id)
)
with check (
  public.is_org_member(org_id)
);

create policy judicial_costs_delete_owner
on public.judicial_costs
for delete
to authenticated
using (
  public.is_org_owner(org_id)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  recipient_user_id uuid null references public.app_users(id) on delete set null,
  source text not null default 'najiz',
  category text not null check (category in ('integration_sync', 'lawyer_verification', 'case_sync', 'judicial_cost')),
  title text not null,
  body text not null,
  entity_type text null,
  entity_id text null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'read', 'dismissed')),
  payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  sent_at timestamptz null,
  read_at timestamptz null
);

create index if not exists idx_notifications_org_created
  on public.notifications (org_id, created_at desc);
create index if not exists idx_notifications_recipient_status
  on public.notifications (recipient_user_id, status, created_at desc);

grant select, insert, update, delete on public.notifications to authenticated, service_role;

alter table public.notifications enable row level security;

drop policy if exists notifications_select_visible on public.notifications;
drop policy if exists notifications_insert_member on public.notifications;
drop policy if exists notifications_update_visible on public.notifications;
drop policy if exists notifications_delete_owner on public.notifications;

create policy notifications_select_visible
on public.notifications
for select
to authenticated
using (
  public.is_org_owner(org_id)
  or recipient_user_id = auth.uid()
);

create policy notifications_insert_member
on public.notifications
for insert
to authenticated
with check (
  public.is_org_member(org_id)
);

create policy notifications_update_visible
on public.notifications
for update
to authenticated
using (
  public.is_org_owner(org_id)
  or recipient_user_id = auth.uid()
)
with check (
  public.is_org_member(org_id)
);

create policy notifications_delete_owner
on public.notifications
for delete
to authenticated
using (
  public.is_org_owner(org_id)
);

insert into public.integration_sync_jobs (
  legacy_run_id,
  org_id,
  integration_id,
  provider,
  source,
  job_kind,
  status,
  environment,
  trigger_mode,
  requested_by,
  subject_type,
  subject_id,
  attempts,
  max_attempts,
  retryable,
  started_at,
  completed_at,
  error_message,
  summary,
  request_payload,
  response_payload,
  created_at
)
select
  runs.id,
  runs.org_id,
  integrations.id,
  runs.provider,
  runs.provider,
  'case_sync',
  case when runs.status = 'completed' then 'succeeded' else 'failed' end,
  coalesce(integrations.active_environment, 'sandbox'),
  'manual',
  runs.created_by,
  'endpoint_path',
  runs.endpoint_path,
  1,
  1,
  false,
  runs.created_at,
  runs.created_at,
  runs.error,
  jsonb_build_object(
    'endpoint_path', runs.endpoint_path,
    'imported_count', runs.imported_count
  ),
  jsonb_build_object(
    'endpoint_path', runs.endpoint_path
  ),
  jsonb_build_object(
    'imported_count', runs.imported_count,
    'error', runs.error
  ),
  runs.created_at
from public.najiz_sync_runs runs
left join public.org_integrations integrations
  on integrations.org_id = runs.org_id
 and integrations.provider = runs.provider
where not exists (
  select 1
  from public.integration_sync_jobs jobs
  where jobs.legacy_run_id = runs.id
);

update public.org_integrations oi
set last_synced_at = latest.created_at
from (
  select org_id, max(created_at) as created_at
  from public.integration_sync_jobs
  group by org_id
) latest
where latest.org_id = oi.org_id
  and oi.last_synced_at is null;
