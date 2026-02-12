create extension if not exists pgcrypto;

create table if not exists public.full_version_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  org_id uuid null references public.organizations(id) on delete set null,
  user_id uuid null references auth.users(id) on delete set null,
  full_name text null,
  email text not null,
  phone text null,
  firm_name text null,
  message text null,
  source text not null default 'app' check (source in ('app', 'landing', 'contact'))
);

create index if not exists full_version_requests_created_at_idx
  on public.full_version_requests (created_at desc);

create index if not exists full_version_requests_org_id_idx
  on public.full_version_requests (org_id);

create index if not exists full_version_requests_user_id_idx
  on public.full_version_requests (user_id);

create index if not exists full_version_requests_source_idx
  on public.full_version_requests (source);

grant usage on schema public to anon, authenticated;
grant insert on public.full_version_requests to anon, authenticated;

alter table public.full_version_requests enable row level security;

drop policy if exists full_version_requests_insert_public on public.full_version_requests;

create policy full_version_requests_insert_public
on public.full_version_requests
for insert
to anon, authenticated
with check (true);
