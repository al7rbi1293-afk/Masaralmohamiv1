create extension if not exists pgcrypto;

create table if not exists public.matter_communications (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  matter_id uuid not null references public.matters(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  user_id uuid null references auth.users(id) on delete set null,
  sender text not null check (sender in ('CLIENT', 'LAWYER')),
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_matter_communications_matter_created
  on public.matter_communications (matter_id, created_at asc);

grant select, insert, update, delete on public.matter_communications to authenticated;
grant select, insert, update, delete on public.matter_communications to service_role;

alter table public.matter_communications enable row level security;

create policy matter_communications_service_all
on public.matter_communications
for all
to service_role
using (true)
with check (true);

create policy matter_communications_select_visible
on public.matter_communications
for select
to authenticated
using (
  exists (
    select 1
    from public.matters mt
    where mt.id = matter_communications.matter_id
      and mt.org_id = matter_communications.org_id
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

create policy matter_communications_insert_lawyer
on public.matter_communications
for insert
to authenticated
with check (
  sender = 'LAWYER'
  and user_id = auth.uid()
  and exists (
    select 1
    from public.matters mt
    where mt.id = matter_communications.matter_id
      and mt.org_id = matter_communications.org_id
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
