create extension if not exists pgcrypto;
-- Step 12.2: Calendar events, attendees, notification jobs, ICS tokens
-- 1) calendar_events
create table if not exists public.calendar_events (
    id uuid primary key default gen_random_uuid(),
    org_id uuid not null references public.organizations(id) on delete cascade,
    matter_id uuid references public.matters(id) on delete
    set null,
        title text not null,
        description text,
        location text,
        start_at timestamptz not null,
        end_at timestamptz not null,
        all_day boolean default false,
        created_by uuid not null references auth.users(id),
        created_at timestamptz not null default now()
);
create index if not exists idx_calendar_events_org on public.calendar_events (org_id);
create index if not exists idx_calendar_events_org_start on public.calendar_events (org_id, start_at);
create index if not exists idx_calendar_events_org_matter on public.calendar_events (org_id, matter_id);
grant select,
    insert,
    update,
    delete on public.calendar_events to authenticated;
alter table public.calendar_events enable row level security;
drop policy if exists calendar_events_select_member on public.calendar_events;
drop policy if exists calendar_events_insert_member on public.calendar_events;
drop policy if exists calendar_events_update_member on public.calendar_events;
drop policy if exists calendar_events_delete_member on public.calendar_events;
create policy calendar_events_select_member on public.calendar_events for
select to authenticated using (
        exists (
            select 1
            from public.memberships m
            where m.org_id = calendar_events.org_id
                and m.user_id = auth.uid()
        )
    );
create policy calendar_events_insert_member on public.calendar_events for
insert to authenticated with check (
        calendar_events.created_by = auth.uid()
        and exists (
            select 1
            from public.memberships m
            where m.org_id = calendar_events.org_id
                and m.user_id = auth.uid()
        )
    );
create policy calendar_events_update_member on public.calendar_events for
update to authenticated using (
        exists (
            select 1
            from public.memberships m
            where m.org_id = calendar_events.org_id
                and m.user_id = auth.uid()
        )
    ) with check (
        exists (
            select 1
            from public.memberships m
            where m.org_id = calendar_events.org_id
                and m.user_id = auth.uid()
        )
    );
create policy calendar_events_delete_member on public.calendar_events for delete to authenticated using (
    calendar_events.created_by = auth.uid()
    or exists (
        select 1
        from public.memberships m
        where m.org_id = calendar_events.org_id
            and m.user_id = auth.uid()
            and m.role = 'owner'
    )
);
-- 2) event_attendees
create table if not exists public.event_attendees (
    id uuid primary key default gen_random_uuid(),
    org_id uuid not null references public.organizations(id) on delete cascade,
    event_id uuid not null references public.calendar_events(id) on delete cascade,
    user_id uuid not null references auth.users(id),
    role text default 'required',
    created_at timestamptz not null default now()
);
create index if not exists idx_event_attendees_event on public.event_attendees (event_id);
create index if not exists idx_event_attendees_user on public.event_attendees (user_id);
grant select,
    insert,
    update,
    delete on public.event_attendees to authenticated;
alter table public.event_attendees enable row level security;
drop policy if exists event_attendees_select_member on public.event_attendees;
drop policy if exists event_attendees_insert_member on public.event_attendees;
drop policy if exists event_attendees_delete_member on public.event_attendees;
create policy event_attendees_select_member on public.event_attendees for
select to authenticated using (
        exists (
            select 1
            from public.memberships m
            where m.org_id = event_attendees.org_id
                and m.user_id = auth.uid()
        )
    );
create policy event_attendees_insert_member on public.event_attendees for
insert to authenticated with check (
        exists (
            select 1
            from public.memberships m
            where m.org_id = event_attendees.org_id
                and m.user_id = auth.uid()
        )
    );
create policy event_attendees_delete_member on public.event_attendees for delete to authenticated using (
    exists (
        select 1
        from public.memberships m
        where m.org_id = event_attendees.org_id
            and m.user_id = auth.uid()
    )
);
-- 3) notification_jobs
create table if not exists public.notification_jobs (
    id uuid primary key default gen_random_uuid(),
    org_id uuid not null references public.organizations(id) on delete cascade,
    type text not null,
    payload jsonb not null default '{}'::jsonb,
    run_at timestamptz not null,
    status text not null default 'queued' check (status in ('queued', 'sent', 'failed')),
    created_at timestamptz not null default now()
);
create index if not exists idx_notification_jobs_status_run on public.notification_jobs (status, run_at);
grant select,
    insert,
    update on public.notification_jobs to authenticated;
alter table public.notification_jobs enable row level security;
drop policy if exists notification_jobs_select_member on public.notification_jobs;
drop policy if exists notification_jobs_insert_member on public.notification_jobs;
create policy notification_jobs_select_member on public.notification_jobs for
select to authenticated using (
        exists (
            select 1
            from public.memberships m
            where m.org_id = notification_jobs.org_id
                and m.user_id = auth.uid()
        )
    );
create policy notification_jobs_insert_member on public.notification_jobs for
insert to authenticated with check (
        exists (
            select 1
            from public.memberships m
            where m.org_id = notification_jobs.org_id
                and m.user_id = auth.uid()
        )
    );
-- 4) org_ics_tokens
create table if not exists public.org_ics_tokens (
    id uuid primary key default gen_random_uuid(),
    org_id uuid not null references public.organizations(id) on delete cascade,
    token text unique not null default encode(gen_random_bytes(32), 'hex'),
    created_at timestamptz not null default now()
);
create index if not exists idx_org_ics_tokens_token on public.org_ics_tokens (token);
-- No RLS needed on org_ics_tokens since ICS feed uses token-based auth (service role).
-- Only owners can manage tokens via API.
grant select,
    insert,
    delete on public.org_ics_tokens to authenticated;
alter table public.org_ics_tokens enable row level security;
drop policy if exists org_ics_tokens_owner_select on public.org_ics_tokens;
drop policy if exists org_ics_tokens_owner_insert on public.org_ics_tokens;
drop policy if exists org_ics_tokens_owner_delete on public.org_ics_tokens;
create policy org_ics_tokens_owner_select on public.org_ics_tokens for
select to authenticated using (
        exists (
            select 1
            from public.memberships m
            where m.org_id = org_ics_tokens.org_id
                and m.user_id = auth.uid()
        )
    );
create policy org_ics_tokens_owner_insert on public.org_ics_tokens for
insert to authenticated with check (
        exists (
            select 1
            from public.memberships m
            where m.org_id = org_ics_tokens.org_id
                and m.user_id = auth.uid()
                and m.role = 'owner'
        )
    );
create policy org_ics_tokens_owner_delete on public.org_ics_tokens for delete to authenticated using (
    exists (
        select 1
        from public.memberships m
        where m.org_id = org_ics_tokens.org_id
            and m.user_id = auth.uid()
            and m.role = 'owner'
    )
);