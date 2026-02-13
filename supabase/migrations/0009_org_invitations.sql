-- Phase 7.2: Team invitations (org scoped)

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

create index if not exists idx_org_invitations_org_created on public.org_invitations(org_id, created_at desc);
create index if not exists idx_org_invitations_org_email on public.org_invitations(org_id, email);

alter table public.org_invitations enable row level security;

grant select, insert, update, delete on public.org_invitations to authenticated;

-- Owners only
drop policy if exists org_invitations_select_owner on public.org_invitations;
create policy org_invitations_select_owner
on public.org_invitations
for select
using (
  exists (
    select 1
    from public.memberships m
    where m.org_id = org_invitations.org_id
      and m.user_id = auth.uid()
      and m.role = 'owner'
  )
);

drop policy if exists org_invitations_insert_owner on public.org_invitations;
create policy org_invitations_insert_owner
on public.org_invitations
for insert
with check (
  exists (
    select 1
    from public.memberships m
    where m.org_id = org_invitations.org_id
      and m.user_id = auth.uid()
      and m.role = 'owner'
  )
);

drop policy if exists org_invitations_update_owner on public.org_invitations;
create policy org_invitations_update_owner
on public.org_invitations
for update
using (
  exists (
    select 1
    from public.memberships m
    where m.org_id = org_invitations.org_id
      and m.user_id = auth.uid()
      and m.role = 'owner'
  )
)
with check (
  exists (
    select 1
    from public.memberships m
    where m.org_id = org_invitations.org_id
      and m.user_id = auth.uid()
      and m.role = 'owner'
  )
);

drop policy if exists org_invitations_delete_owner on public.org_invitations;
create policy org_invitations_delete_owner
on public.org_invitations
for delete
using (
  exists (
    select 1
    from public.memberships m
    where m.org_id = org_invitations.org_id
      and m.user_id = auth.uid()
      and m.role = 'owner'
  )
);
