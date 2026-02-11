create extension if not exists pgcrypto;

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  phone text null,
  firm_name text null,
  created_at timestamptz not null default now()
);

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  phone text null,
  created_at timestamptz not null default now()
);

create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'lawyer', 'assistant')),
  created_at timestamptz not null default now(),
  unique (org_id, user_id)
);

create table if not exists public.trial_subscriptions (
  org_id uuid primary key references public.organizations(id) on delete cascade,
  started_at timestamptz not null default now(),
  ends_at timestamptz not null,
  status text not null default 'active' check (status in ('active', 'expired')),
  updated_at timestamptz not null default now()
);

create index if not exists leads_email_idx on public.leads (lower(email));
create index if not exists leads_created_at_idx on public.leads (created_at);
create index if not exists organizations_created_at_idx on public.organizations (created_at);
create index if not exists profiles_created_at_idx on public.profiles (created_at);
create index if not exists memberships_org_id_idx on public.memberships (org_id);
create index if not exists memberships_user_id_idx on public.memberships (user_id);
create index if not exists memberships_created_at_idx on public.memberships (created_at);
create index if not exists trial_subscriptions_ends_at_idx on public.trial_subscriptions (ends_at);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', '')
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

grant usage on schema public to anon, authenticated;

grant insert on public.leads to anon, authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.memberships to authenticated;
grant select, insert, update on public.organizations to authenticated;
grant select, insert, update on public.trial_subscriptions to authenticated;

alter table public.leads enable row level security;
alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.memberships enable row level security;
alter table public.trial_subscriptions enable row level security;

create policy leads_insert_public
on public.leads
for insert
to anon, authenticated
with check (true);

create policy profiles_select_own
on public.profiles
for select
to authenticated
using (user_id = auth.uid());

create policy profiles_update_own
on public.profiles
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy memberships_select_own
on public.memberships
for select
to authenticated
using (user_id = auth.uid());

create policy memberships_insert_owner
on public.memberships
for insert
to authenticated
with check (
  exists (
    select 1
    from public.memberships m
    where m.org_id = memberships.org_id
      and m.user_id = auth.uid()
      and m.role = 'owner'
  )
);

create policy memberships_update_owner
on public.memberships
for update
to authenticated
using (
  exists (
    select 1
    from public.memberships m
    where m.org_id = memberships.org_id
      and m.user_id = auth.uid()
      and m.role = 'owner'
  )
)
with check (
  exists (
    select 1
    from public.memberships m
    where m.org_id = memberships.org_id
      and m.user_id = auth.uid()
      and m.role = 'owner'
  )
);

create policy memberships_delete_owner
on public.memberships
for delete
to authenticated
using (
  exists (
    select 1
    from public.memberships m
    where m.org_id = memberships.org_id
      and m.user_id = auth.uid()
      and m.role = 'owner'
  )
);

create policy organizations_select_member
on public.organizations
for select
to authenticated
using (
  exists (
    select 1
    from public.memberships m
    where m.org_id = organizations.id
      and m.user_id = auth.uid()
  )
);

create policy organizations_insert_authenticated
on public.organizations
for insert
to authenticated
with check (auth.uid() is not null);

create policy organizations_update_owner
on public.organizations
for update
to authenticated
using (
  exists (
    select 1
    from public.memberships m
    where m.org_id = organizations.id
      and m.user_id = auth.uid()
      and m.role = 'owner'
  )
)
with check (
  exists (
    select 1
    from public.memberships m
    where m.org_id = organizations.id
      and m.user_id = auth.uid()
      and m.role = 'owner'
  )
);

create policy trial_subscriptions_select_member
on public.trial_subscriptions
for select
to authenticated
using (
  exists (
    select 1
    from public.memberships m
    where m.org_id = trial_subscriptions.org_id
      and m.user_id = auth.uid()
  )
);

create policy trial_subscriptions_insert_owner
on public.trial_subscriptions
for insert
to authenticated
with check (
  exists (
    select 1
    from public.memberships m
    where m.org_id = trial_subscriptions.org_id
      and m.user_id = auth.uid()
      and m.role = 'owner'
  )
);

create policy trial_subscriptions_update_owner
on public.trial_subscriptions
for update
to authenticated
using (
  exists (
    select 1
    from public.memberships m
    where m.org_id = trial_subscriptions.org_id
      and m.user_id = auth.uid()
      and m.role = 'owner'
  )
)
with check (
  exists (
    select 1
    from public.memberships m
    where m.org_id = trial_subscriptions.org_id
      and m.user_id = auth.uid()
      and m.role = 'owner'
  )
);
