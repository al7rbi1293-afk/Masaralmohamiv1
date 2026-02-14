create extension if not exists pgcrypto;

create table if not exists public.org_integrations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null check (provider in ('najiz')),
  status text not null default 'disconnected' check (status in ('disconnected', 'connected', 'error')),
  config jsonb not null default '{}'::jsonb,
  secret_enc text null,
  created_by uuid not null references auth.users(id),
  updated_at timestamptz not null default now(),
  unique (org_id, provider)
);

create index if not exists idx_org_integrations_org on public.org_integrations (org_id);
create index if not exists idx_org_integrations_org_provider on public.org_integrations (org_id, provider);

drop trigger if exists org_integrations_set_updated_at on public.org_integrations;
create trigger org_integrations_set_updated_at
before update on public.org_integrations
for each row
execute function public.set_updated_at();

grant select, insert, update, delete on public.org_integrations to authenticated;

alter table public.org_integrations enable row level security;

drop policy if exists org_integrations_owner_select on public.org_integrations;
drop policy if exists org_integrations_owner_insert on public.org_integrations;
drop policy if exists org_integrations_owner_update on public.org_integrations;
drop policy if exists org_integrations_owner_delete on public.org_integrations;

create policy org_integrations_owner_select
on public.org_integrations
for select
to authenticated
using (
  public.is_org_owner(org_id)
);

create policy org_integrations_owner_insert
on public.org_integrations
for insert
to authenticated
with check (
  public.is_org_owner(org_id)
  and created_by = auth.uid()
);

create policy org_integrations_owner_update
on public.org_integrations
for update
to authenticated
using (
  public.is_org_owner(org_id)
)
with check (
  public.is_org_owner(org_id)
);

create policy org_integrations_owner_delete
on public.org_integrations
for delete
to authenticated
using (
  public.is_org_owner(org_id)
);

