-- Align tasks-related user references with custom users table (app_users)
-- to prevent FK violations when creating tasks from custom-auth sessions.

-- Clear orphan assignees before replacing the foreign key.
update public.tasks t
set assignee_id = null
where assignee_id is not null
  and not exists (
    select 1
    from public.app_users u
    where u.id = t.assignee_id
  );

-- Remove orphan tasks that cannot be linked to an app user creator.
delete from public.tasks t
where not exists (
  select 1
  from public.app_users u
  where u.id = t.created_by
);

alter table public.tasks
drop constraint if exists tasks_assignee_id_fkey;

alter table public.tasks
add constraint tasks_assignee_id_fkey
foreign key (assignee_id)
references public.app_users(id)
on delete set null;

alter table public.tasks
drop constraint if exists tasks_created_by_fkey;

alter table public.tasks
add constraint tasks_created_by_fkey
foreign key (created_by)
references public.app_users(id)
on delete restrict;
