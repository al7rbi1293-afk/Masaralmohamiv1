create extension if not exists pgcrypto;

create table if not exists public.matter_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  matter_id uuid not null references public.matters(id) on delete cascade,
  type text not null default 'note' check (type in ('hearing', 'call', 'note', 'email', 'meeting', 'other')),
  note text null,
  event_date timestamptz null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_matter_events_org_matter_created
  on public.matter_events (org_id, matter_id, created_at desc);

grant select, insert, update, delete on public.matter_events to authenticated;

alter table public.matter_events enable row level security;

drop policy if exists matter_events_select_visible on public.matter_events;
drop policy if exists matter_events_insert_visible on public.matter_events;
drop policy if exists matter_events_update_owner_or_creator on public.matter_events;
drop policy if exists matter_events_delete_owner_or_creator on public.matter_events;

create policy matter_events_select_visible
on public.matter_events
for select
to authenticated
using (
  exists (
    select 1
    from public.matters mt
    where mt.id = matter_events.matter_id
      and mt.org_id = matter_events.org_id
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

create policy matter_events_insert_visible
on public.matter_events
for insert
to authenticated
with check (
  created_by = auth.uid()
  and exists (
    select 1
    from public.matters mt
    where mt.id = matter_events.matter_id
      and mt.org_id = matter_events.org_id
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

create policy matter_events_update_owner_or_creator
on public.matter_events
for update
to authenticated
using (
  (
    public.is_org_owner(org_id)
    or created_by = auth.uid()
  )
  and exists (
    select 1
    from public.matters mt
    where mt.id = matter_events.matter_id
      and mt.org_id = matter_events.org_id
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
)
with check (
  (
    public.is_org_owner(org_id)
    or created_by = auth.uid()
  )
  and exists (
    select 1
    from public.matters mt
    where mt.id = matter_events.matter_id
      and mt.org_id = matter_events.org_id
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

create policy matter_events_delete_owner_or_creator
on public.matter_events
for delete
to authenticated
using (
  (
    public.is_org_owner(org_id)
    or created_by = auth.uid()
  )
  and exists (
    select 1
    from public.matters mt
    where mt.id = matter_events.matter_id
      and mt.org_id = matter_events.org_id
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
