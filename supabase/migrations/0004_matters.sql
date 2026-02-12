create extension if not exists pgcrypto;

create table if not exists public.matters (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null references public.clients(id),
  title text not null,
  status text not null default 'new' check (status in ('new', 'in_progress', 'on_hold', 'closed', 'archived')),
  summary text null,
  assigned_user_id uuid null references auth.users(id),
  is_private boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.matter_members (
  matter_id uuid not null references public.matters(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key (matter_id, user_id)
);

create index if not exists idx_matters_org on public.matters (org_id);
create index if not exists idx_matters_org_client on public.matters (org_id, client_id);
create index if not exists idx_matters_org_status on public.matters (org_id, status);

drop trigger if exists matters_set_updated_at on public.matters;
create trigger matters_set_updated_at
before update on public.matters
for each row
execute function public.set_updated_at();

create or replace function public.is_org_member(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.memberships m
    where m.org_id = target_org
      and m.user_id = auth.uid()
  );
$$;

create or replace function public.is_org_owner(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.memberships m
    where m.org_id = target_org
      and m.user_id = auth.uid()
      and m.role = 'owner'
  );
$$;

create or replace function public.is_matter_member(target_matter uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.matter_members mm
    where mm.matter_id = target_matter
      and mm.user_id = auth.uid()
  );
$$;

grant select, insert, update, delete on public.matters to authenticated;
grant select, insert, delete on public.matter_members to authenticated;

alter table public.matters enable row level security;
alter table public.matter_members enable row level security;

drop policy if exists matters_select_non_private_member on public.matters;
drop policy if exists matters_select_private_owner_or_member on public.matters;
drop policy if exists matters_insert_member on public.matters;
drop policy if exists matters_update_owner_or_assignee on public.matters;
drop policy if exists matters_delete_owner on public.matters;

create policy matters_select_non_private_member
on public.matters
for select
to authenticated
using (
  is_private = false
  and public.is_org_member(org_id)
);

create policy matters_select_private_owner_or_member
on public.matters
for select
to authenticated
using (
  is_private = true
  and (
    public.is_org_owner(org_id)
    or public.is_matter_member(id)
  )
);

create policy matters_insert_member
on public.matters
for insert
to authenticated
with check (
  public.is_org_member(org_id)
  and exists (
    select 1
    from public.clients c
    where c.id = client_id
      and c.org_id = org_id
  )
);

create policy matters_update_owner_or_assignee
on public.matters
for update
to authenticated
using (
  public.is_org_owner(org_id)
  or assigned_user_id = auth.uid()
)
with check (
  public.is_org_member(org_id)
  and exists (
    select 1
    from public.clients c
    where c.id = client_id
      and c.org_id = org_id
  )
);

create policy matters_delete_owner
on public.matters
for delete
to authenticated
using (
  public.is_org_owner(org_id)
);

drop policy if exists matter_members_select_visible on public.matter_members;
drop policy if exists matter_members_insert_owner_or_assignee on public.matter_members;
drop policy if exists matter_members_delete_owner_or_assignee on public.matter_members;

create policy matter_members_select_visible
on public.matter_members
for select
to authenticated
using (
  exists (
    select 1
    from public.matters mt
    where mt.id = matter_members.matter_id
      and (
        (mt.is_private = false and public.is_org_member(mt.org_id))
        or (
          mt.is_private = true
          and (
            public.is_org_owner(mt.org_id)
            or public.is_matter_member(mt.id)
          )
        )
      )
  )
);

create policy matter_members_insert_owner_or_assignee
on public.matter_members
for insert
to authenticated
with check (
  exists (
    select 1
    from public.matters mt
    where mt.id = matter_members.matter_id
      and public.is_org_member(mt.org_id)
      and exists (
        select 1
        from public.memberships target_member
        where target_member.org_id = mt.org_id
          and target_member.user_id = matter_members.user_id
      )
      and (
        public.is_org_owner(mt.org_id)
        or mt.assigned_user_id = auth.uid()
      )
  )
);

create policy matter_members_delete_owner_or_assignee
on public.matter_members
for delete
to authenticated
using (
  exists (
    select 1
    from public.matters mt
    where mt.id = matter_members.matter_id
      and public.is_org_member(mt.org_id)
      and (
        public.is_org_owner(mt.org_id)
        or mt.assigned_user_id = auth.uid()
      )
  )
);
