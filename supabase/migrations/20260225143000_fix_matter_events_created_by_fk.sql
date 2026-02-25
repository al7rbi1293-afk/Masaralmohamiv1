-- Align matter_events creator reference with custom users table (app_users).
-- This fixes timeline event creation for users created via custom auth.

-- Remove orphan event rows that cannot be linked to app_users.
delete from public.matter_events me
where not exists (
  select 1
  from public.app_users u
  where u.id = me.created_by
);

alter table public.matter_events
drop constraint if exists matter_events_created_by_fkey;

alter table public.matter_events
add constraint matter_events_created_by_fkey
foreign key (created_by)
references public.app_users(id)
on delete cascade;
