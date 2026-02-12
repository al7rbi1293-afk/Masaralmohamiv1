create extension if not exists pgcrypto;

-- Helper to maintain updated_at timestamps.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  type text not null default 'person' check (type in ('person', 'company')),
  name text not null,
  identity_no text null,
  commercial_no text null,
  email text null,
  phone text null,
  notes text null,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_clients_org on public.clients (org_id);
create index if not exists idx_clients_org_name on public.clients (org_id, name);

drop trigger if exists clients_set_updated_at on public.clients;
create trigger clients_set_updated_at
before update on public.clients
for each row
execute function public.set_updated_at();

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.clients to authenticated;

alter table public.clients enable row level security;

drop policy if exists clients_select_member on public.clients;
drop policy if exists clients_insert_member on public.clients;
drop policy if exists clients_update_member on public.clients;
drop policy if exists clients_delete_owner on public.clients;

create policy clients_select_member
on public.clients
for select
to authenticated
using (
  exists (
    select 1
    from public.memberships m
    where m.org_id = clients.org_id
      and m.user_id = auth.uid()
  )
);

create policy clients_insert_member
on public.clients
for insert
to authenticated
with check (
  exists (
    select 1
    from public.memberships m
    where m.org_id = clients.org_id
      and m.user_id = auth.uid()
  )
);

create policy clients_update_member
on public.clients
for update
to authenticated
using (
  exists (
    select 1
    from public.memberships m
    where m.org_id = clients.org_id
      and m.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.memberships m
    where m.org_id = clients.org_id
      and m.user_id = auth.uid()
  )
);

create policy clients_delete_owner
on public.clients
for delete
to authenticated
using (
  exists (
    select 1
    from public.memberships m
    where m.org_id = clients.org_id
      and m.user_id = auth.uid()
      and m.role = 'owner'
  )
);

