-- Align calendar events user references with custom users table (app_users).
-- This fixes calendar event creation for users created via custom auth.

alter table public.calendar_events
drop constraint if exists calendar_events_created_by_fkey;

alter table public.calendar_events
add constraint calendar_events_created_by_fkey
foreign key (created_by)
references public.app_users(id)
on delete cascade
not valid;

alter table public.event_attendees
drop constraint if exists event_attendees_user_id_fkey;

alter table public.event_attendees
add constraint event_attendees_user_id_fkey
foreign key (user_id)
references public.app_users(id)
on delete cascade
not valid;
