-- Align matters-related user references with custom users table (app_users)
-- to prevent FK violations when creating matters from custom-auth sessions.

-- Remove orphan assigned users that do not exist in app_users.
update public.matters m
set assigned_user_id = null
where assigned_user_id is not null
  and not exists (
    select 1
    from public.app_users u
    where u.id = m.assigned_user_id
  );

-- Remove orphan matter members that do not exist in app_users.
delete from public.matter_members mm
where not exists (
  select 1
  from public.app_users u
  where u.id = mm.user_id
);

alter table public.matters
drop constraint if exists matters_assigned_user_id_fkey;

alter table public.matters
add constraint matters_assigned_user_id_fkey
foreign key (assigned_user_id)
references public.app_users(id)
on delete set null;

alter table public.matter_members
drop constraint if exists matter_members_user_id_fkey;

alter table public.matter_members
add constraint matter_members_user_id_fkey
foreign key (user_id)
references public.app_users(id)
on delete cascade;
