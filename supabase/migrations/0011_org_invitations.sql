-- Phase 7.2.1.1: Team management invitations (owner only)

create extension if not exists pgcrypto;

create table if not exists public.org_invitations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role text not null default 'lawyer' check (role in ('owner', 'lawyer', 'assistant')),
  token text not null unique,
  expires_at timestamptz not null,
  invited_by uuid not null references auth.users(id),
  accepted_at timestamptz null,
  created_at timestamptz not null default now()
);

create index if not exists idx_org_invites_org_created
  on public.org_invitations(org_id, created_at desc);
create index if not exists idx_org_invites_org_email
  on public.org_invitations(org_id, email);

grant select, insert, update, delete on public.org_invitations to authenticated;

alter table public.org_invitations enable row level security;

-- Helper check (defined earlier in 0004_matters.sql):
-- public.is_org_owner(org_id) => current user is owner in org_id

drop policy if exists org_invitations_select_owner on public.org_invitations;
create policy org_invitations_select_owner
on public.org_invitations
for select
to authenticated
using (
  public.is_org_owner(org_id)
);

drop policy if exists org_invitations_insert_owner on public.org_invitations;
create policy org_invitations_insert_owner
on public.org_invitations
for insert
to authenticated
with check (
  public.is_org_owner(org_id)
);

drop policy if exists org_invitations_update_owner on public.org_invitations;
create policy org_invitations_update_owner
on public.org_invitations
for update
to authenticated
using (
  public.is_org_owner(org_id)
)
with check (
  public.is_org_owner(org_id)
);

drop policy if exists org_invitations_delete_owner on public.org_invitations;
create policy org_invitations_delete_owner
on public.org_invitations
for delete
to authenticated
using (
  public.is_org_owner(org_id)
);

-- Allow org owners to list their organization's members (needed for the owner UI).
-- This keeps non-owners restricted to their own membership row via memberships_select_own.
drop policy if exists memberships_select_owner_org on public.memberships;
create policy memberships_select_owner_org
on public.memberships
for select
to authenticated
using (
  public.is_org_owner(org_id)
);

-- Allow org owners to read basic profile fields of org members (names) for the owner UI.
drop policy if exists profiles_select_owner_org_members on public.profiles;
create policy profiles_select_owner_org_members
on public.profiles
for select
to authenticated
using (
  exists (
    select 1
    from public.memberships m
    where m.user_id = profiles.user_id
      and public.is_org_owner(m.org_id)
  )
);

