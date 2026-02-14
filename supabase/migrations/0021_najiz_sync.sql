create extension if not exists pgcrypto;

create table if not exists public.najiz_sync_runs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null default 'najiz' check (provider in ('najiz')),
  endpoint_path text not null,
  status text not null default 'completed' check (status in ('completed', 'failed')),
  imported_count int not null default 0,
  error text null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_najiz_sync_runs_org_created on public.najiz_sync_runs (org_id, created_at desc);

create table if not exists public.external_cases (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null check (provider in ('najiz')),
  external_id text not null,
  title text not null,
  court text null,
  status text null,
  meta jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz not null default now(),
  unique (org_id, provider, external_id)
);

create index if not exists idx_external_cases_org_synced on public.external_cases (org_id, last_synced_at desc);
create index if not exists idx_external_cases_org_title on public.external_cases (org_id, title);

grant select, insert on public.najiz_sync_runs to authenticated;
grant select, insert, update, delete on public.external_cases to authenticated;

alter table public.najiz_sync_runs enable row level security;
alter table public.external_cases enable row level security;

-- najiz_sync_runs policies: owners only.
drop policy if exists najiz_sync_runs_owner_select on public.najiz_sync_runs;
drop policy if exists najiz_sync_runs_owner_insert on public.najiz_sync_runs;

create policy najiz_sync_runs_owner_select
on public.najiz_sync_runs
for select
to authenticated
using (
  public.is_org_owner(org_id)
);

create policy najiz_sync_runs_owner_insert
on public.najiz_sync_runs
for insert
to authenticated
with check (
  public.is_org_owner(org_id)
  and created_by = auth.uid()
);

-- external_cases policies: org members can read, owners can write.
drop policy if exists external_cases_member_select on public.external_cases;
drop policy if exists external_cases_owner_insert on public.external_cases;
drop policy if exists external_cases_owner_update on public.external_cases;
drop policy if exists external_cases_owner_delete on public.external_cases;

create policy external_cases_member_select
on public.external_cases
for select
to authenticated
using (
  public.is_org_member(org_id)
);

create policy external_cases_owner_insert
on public.external_cases
for insert
to authenticated
with check (
  public.is_org_owner(org_id)
);

create policy external_cases_owner_update
on public.external_cases
for update
to authenticated
using (
  public.is_org_owner(org_id)
)
with check (
  public.is_org_owner(org_id)
);

create policy external_cases_owner_delete
on public.external_cases
for delete
to authenticated
using (
  public.is_org_owner(org_id)
);

