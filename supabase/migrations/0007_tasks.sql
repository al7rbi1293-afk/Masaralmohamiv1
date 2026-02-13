create extension if not exists pgcrypto;

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  matter_id uuid null references public.matters(id) on delete set null,
  title text not null,
  description text null,
  assignee_id uuid null references auth.users(id),
  due_at timestamptz null,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  status text not null default 'todo' check (status in ('todo', 'doing', 'done', 'canceled')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- If the table was created manually or via an older migration, ensure required columns exist.
alter table public.tasks add column if not exists created_by uuid;
alter table public.tasks add column if not exists created_at timestamptz not null default now();
alter table public.tasks add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_tasks_org on public.tasks (org_id);
create index if not exists idx_tasks_org_due on public.tasks (org_id, due_at);
create index if not exists idx_tasks_org_status on public.tasks (org_id, status);
create index if not exists idx_tasks_org_assignee on public.tasks (org_id, assignee_id);

drop trigger if exists tasks_set_updated_at on public.tasks;
create trigger tasks_set_updated_at
before update on public.tasks
for each row
execute function public.set_updated_at();

grant select, insert, update, delete on public.tasks to authenticated;

alter table public.tasks enable row level security;

drop policy if exists tasks_select_visible on public.tasks;
drop policy if exists tasks_insert_visible on public.tasks;
drop policy if exists tasks_update_allowed on public.tasks;
drop policy if exists tasks_delete_owner on public.tasks;

create policy tasks_select_visible
on public.tasks
for select
to authenticated
using (
  (
    matter_id is null
    and public.is_org_member(org_id)
  )
  or (
    matter_id is not null
    and exists (
      select 1
      from public.matters mt
      where mt.id = tasks.matter_id
        and mt.org_id = tasks.org_id
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
);

create policy tasks_insert_visible
on public.tasks
for insert
to authenticated
with check (
  created_by = auth.uid()
  and public.is_org_member(org_id)
  and (
    matter_id is null
    or exists (
      select 1
      from public.matters mt
      where mt.id = tasks.matter_id
        and mt.org_id = tasks.org_id
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
);

create policy tasks_update_allowed
on public.tasks
for update
to authenticated
using (
  (
    public.is_org_owner(org_id)
    or assignee_id = auth.uid()
    or created_by = auth.uid()
  )
  and public.is_org_member(org_id)
  and (
    (
      matter_id is null
      and public.is_org_member(org_id)
    )
    or (
      matter_id is not null
      and exists (
        select 1
        from public.matters mt
        where mt.id = tasks.matter_id
          and mt.org_id = tasks.org_id
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
  )
)
with check (
  public.is_org_member(org_id)
  and (
    matter_id is null
    or exists (
      select 1
      from public.matters mt
      where mt.id = tasks.matter_id
        and mt.org_id = tasks.org_id
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
);

create policy tasks_delete_owner
on public.tasks
for delete
to authenticated
using (
  public.is_org_owner(org_id)
);
