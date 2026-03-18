alter table if exists public.integration_sync_jobs
  add column if not exists queue_name text not null default 'default',
  add column if not exists available_at timestamptz not null default now(),
  add column if not exists scheduled_for timestamptz null,
  add column if not exists locked_at timestamptz null,
  add column if not exists locked_by text null,
  add column if not exists parent_job_id uuid null references public.integration_sync_jobs(id) on delete set null,
  add column if not exists webhook_event_id uuid null,
  add column if not exists dedupe_key text null;

create index if not exists idx_integration_sync_jobs_provider_available
  on public.integration_sync_jobs (provider, status, available_at asc, created_at asc);
create index if not exists idx_integration_sync_jobs_parent
  on public.integration_sync_jobs (parent_job_id);
create unique index if not exists uq_integration_sync_jobs_active_dedupe
  on public.integration_sync_jobs (org_id, provider, dedupe_key)
  where dedupe_key is not null and status in ('pending', 'running', 'retrying');

create table if not exists public.integration_webhook_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid null references public.organizations(id) on delete cascade,
  integration_id uuid null references public.org_integrations(id) on delete set null,
  provider text not null default 'najiz' check (provider in ('najiz')),
  source text not null default 'najiz',
  event_type text not null,
  delivery_id text null,
  external_entity_id text null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'processed', 'ignored', 'failed')),
  headers_json jsonb not null default '{}'::jsonb,
  payload_json jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now(),
  processed_at timestamptz null,
  error_message text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_integration_webhook_events_delivery
  on public.integration_webhook_events (provider, delivery_id)
  where delivery_id is not null;
create index if not exists idx_integration_webhook_events_provider_status
  on public.integration_webhook_events (provider, status, received_at desc);
create index if not exists idx_integration_webhook_events_org_received
  on public.integration_webhook_events (org_id, received_at desc);

grant select, insert, update, delete on public.integration_webhook_events to authenticated, service_role;

alter table public.integration_webhook_events enable row level security;

drop policy if exists integration_webhook_events_select_member on public.integration_webhook_events;
drop policy if exists integration_webhook_events_insert_member on public.integration_webhook_events;
drop policy if exists integration_webhook_events_update_owner on public.integration_webhook_events;
drop policy if exists integration_webhook_events_delete_owner on public.integration_webhook_events;

create policy integration_webhook_events_select_member
on public.integration_webhook_events
for select
to authenticated
using (
  org_id is null
  or public.is_org_member(org_id)
);

create policy integration_webhook_events_insert_member
on public.integration_webhook_events
for insert
to authenticated
with check (
  org_id is null
  or public.is_org_member(org_id)
);

create policy integration_webhook_events_update_owner
on public.integration_webhook_events
for update
to authenticated
using (
  org_id is null
  or public.is_org_owner(org_id)
)
with check (
  org_id is null
  or public.is_org_member(org_id)
);

create policy integration_webhook_events_delete_owner
on public.integration_webhook_events
for delete
to authenticated
using (
  org_id is null
  or public.is_org_owner(org_id)
);

drop trigger if exists integration_webhook_events_set_updated_at on public.integration_webhook_events;
create trigger integration_webhook_events_set_updated_at
before update on public.integration_webhook_events
for each row
execute function public.set_updated_at();

alter table if exists public.integration_sync_jobs
  drop constraint if exists integration_sync_jobs_webhook_event_id_fkey;

alter table if exists public.integration_sync_jobs
  add constraint integration_sync_jobs_webhook_event_id_fkey
  foreign key (webhook_event_id)
  references public.integration_webhook_events(id)
  on delete set null;

create table if not exists public.external_documents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  external_case_id uuid null references public.external_cases(id) on delete set null,
  matter_id uuid null references public.matters(id) on delete set null,
  sync_job_id uuid null references public.integration_sync_jobs(id) on delete set null,
  provider text not null default 'najiz' check (provider in ('najiz')),
  source text not null default 'najiz',
  external_id text not null,
  document_type text not null default 'other' check (document_type in ('petition', 'judgment', 'invoice', 'session_minutes', 'evidence', 'notice', 'other')),
  title text not null,
  file_name text not null,
  mime_type text null,
  download_url text null,
  file_size bigint null,
  checksum text null,
  issued_at timestamptz null,
  portal_visible boolean not null default true,
  document_id uuid null references public.documents(id) on delete set null,
  case_document_id uuid null,
  payload_json jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, provider, external_id)
);

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'case_documents'
  ) then
    begin
      alter table public.external_documents
        add constraint external_documents_case_document_id_fkey
        foreign key (case_document_id)
        references public.case_documents(id)
        on delete set null;
    exception
      when duplicate_object then
        null;
    end;
  end if;
end
$$;

drop trigger if exists external_documents_set_updated_at on public.external_documents;
create trigger external_documents_set_updated_at
before update on public.external_documents
for each row
execute function public.set_updated_at();

create index if not exists idx_external_documents_org_matter
  on public.external_documents (org_id, matter_id, synced_at desc);
create index if not exists idx_external_documents_org_case
  on public.external_documents (org_id, external_case_id, synced_at desc);

grant select, insert, update, delete on public.external_documents to authenticated, service_role;

alter table public.external_documents enable row level security;

drop policy if exists external_documents_select_member on public.external_documents;
drop policy if exists external_documents_insert_member on public.external_documents;
drop policy if exists external_documents_update_member on public.external_documents;
drop policy if exists external_documents_delete_owner on public.external_documents;

create policy external_documents_select_member
on public.external_documents
for select
to authenticated
using (
  public.is_org_member(org_id)
);

create policy external_documents_insert_member
on public.external_documents
for insert
to authenticated
with check (
  public.is_org_member(org_id)
);

create policy external_documents_update_member
on public.external_documents
for update
to authenticated
using (
  public.is_org_member(org_id)
)
with check (
  public.is_org_member(org_id)
);

create policy external_documents_delete_owner
on public.external_documents
for delete
to authenticated
using (
  public.is_org_owner(org_id)
);

create table if not exists public.session_minutes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  external_case_id uuid null references public.external_cases(id) on delete set null,
  matter_id uuid null references public.matters(id) on delete set null,
  sync_job_id uuid null references public.integration_sync_jobs(id) on delete set null,
  provider text not null default 'najiz' check (provider in ('najiz')),
  source text not null default 'najiz',
  external_id text not null,
  session_reference text null,
  title text not null,
  summary text null,
  occurred_at timestamptz null,
  minute_document_external_id text null,
  document_id uuid null references public.documents(id) on delete set null,
  payload_json jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, provider, external_id)
);

drop trigger if exists session_minutes_set_updated_at on public.session_minutes;
create trigger session_minutes_set_updated_at
before update on public.session_minutes
for each row
execute function public.set_updated_at();

create index if not exists idx_session_minutes_org_matter
  on public.session_minutes (org_id, matter_id, synced_at desc);
create index if not exists idx_session_minutes_org_case
  on public.session_minutes (org_id, external_case_id, synced_at desc);

grant select, insert, update, delete on public.session_minutes to authenticated, service_role;

alter table public.session_minutes enable row level security;

drop policy if exists session_minutes_select_member on public.session_minutes;
drop policy if exists session_minutes_insert_member on public.session_minutes;
drop policy if exists session_minutes_update_member on public.session_minutes;
drop policy if exists session_minutes_delete_owner on public.session_minutes;

create policy session_minutes_select_member
on public.session_minutes
for select
to authenticated
using (
  public.is_org_member(org_id)
);

create policy session_minutes_insert_member
on public.session_minutes
for insert
to authenticated
with check (
  public.is_org_member(org_id)
);

create policy session_minutes_update_member
on public.session_minutes
for update
to authenticated
using (
  public.is_org_member(org_id)
)
with check (
  public.is_org_member(org_id)
);

create policy session_minutes_delete_owner
on public.session_minutes
for delete
to authenticated
using (
  public.is_org_owner(org_id)
);

alter table if exists public.integration_sync_jobs
  drop constraint if exists integration_sync_jobs_job_kind_check;

alter table if exists public.integration_sync_jobs
  add constraint integration_sync_jobs_job_kind_check
  check (job_kind in (
    'matter_refresh',
    'health_check',
    'lawyer_verification',
    'case_sync',
    'judicial_cost_sync',
    'enforcement_request_sync',
    'document_sync',
    'session_minutes_sync',
    'smart_notification_dispatch'
  ));

alter table if exists public.notifications
  drop constraint if exists notifications_category_check;

alter table if exists public.notifications
  add constraint notifications_category_check
  check (category in (
    'integration_sync',
    'lawyer_verification',
    'case_sync',
    'judicial_cost',
    'enforcement_request',
    'document_sync',
    'session_minutes',
    'smart_orchestration'
  ));

create or replace function public.claim_integration_sync_jobs(
  p_provider text,
  p_batch_size int default 10,
  p_lock_owner text default 'system'
)
returns table(
  id uuid,
  legacy_run_id uuid,
  org_id uuid,
  integration_id uuid,
  provider text,
  source text,
  job_kind text,
  status text,
  environment text,
  trigger_mode text,
  requested_by uuid,
  matter_id uuid,
  subject_type text,
  subject_id text,
  attempts int,
  max_attempts int,
  retryable boolean,
  started_at timestamptz,
  completed_at timestamptz,
  error_code text,
  error_message text,
  summary jsonb,
  request_payload jsonb,
  response_payload jsonb,
  queue_name text,
  available_at timestamptz,
  scheduled_for timestamptz,
  locked_at timestamptz,
  locked_by text,
  parent_job_id uuid,
  webhook_event_id uuid,
  dedupe_key text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with next_jobs as (
    select j.id
    from public.integration_sync_jobs j
    where j.provider = p_provider
      and j.status in ('pending', 'retrying')
      and j.available_at <= now()
    order by j.available_at asc, j.created_at asc
    limit greatest(1, least(coalesce(p_batch_size, 10), 100))
    for update skip locked
  ), claimed as (
    update public.integration_sync_jobs j
    set
      status = 'running',
      locked_at = now(),
      locked_by = coalesce(nullif(trim(p_lock_owner), ''), 'system'),
      started_at = now()
    where j.id in (select nj.id from next_jobs nj)
    returning
      j.id,
      j.legacy_run_id,
      j.org_id,
      j.integration_id,
      j.provider,
      j.source,
      j.job_kind,
      j.status,
      j.environment,
      j.trigger_mode,
      j.requested_by,
      j.matter_id,
      j.subject_type,
      j.subject_id,
      j.attempts,
      j.max_attempts,
      j.retryable,
      j.started_at,
      j.completed_at,
      j.error_code,
      j.error_message,
      j.summary,
      j.request_payload,
      j.response_payload,
      j.queue_name,
      j.available_at,
      j.scheduled_for,
      j.locked_at,
      j.locked_by,
      j.parent_job_id,
      j.webhook_event_id,
      j.dedupe_key,
      j.created_at
  )
  select
    claimed.id,
    claimed.legacy_run_id,
    claimed.org_id,
    claimed.integration_id,
    claimed.provider,
    claimed.source,
    claimed.job_kind,
    claimed.status,
    claimed.environment,
    claimed.trigger_mode,
    claimed.requested_by,
    claimed.matter_id,
    claimed.subject_type,
    claimed.subject_id,
    claimed.attempts,
    claimed.max_attempts,
    claimed.retryable,
    claimed.started_at,
    claimed.completed_at,
    claimed.error_code,
    claimed.error_message,
    claimed.summary,
    claimed.request_payload,
    claimed.response_payload,
    claimed.queue_name,
    claimed.available_at,
    claimed.scheduled_for,
    claimed.locked_at,
    claimed.locked_by,
    claimed.parent_job_id,
    claimed.webhook_event_id,
    claimed.dedupe_key,
    claimed.created_at
  from claimed
  order by claimed.created_at asc;
end;
$$;

revoke all on function public.claim_integration_sync_jobs(text, int, text) from public;
grant execute on function public.claim_integration_sync_jobs(text, int, text) to service_role;
