-- ============================================================
-- COMBINED MIGRATION: All missing tables for Steps 10-12
-- Run this in Supabase Dashboard → SQL Editor → New Query → Run
-- ============================================================
-- =========================
-- 0018: Templates
-- =========================
create extension if not exists pgcrypto;
create table if not exists public.templates (
    id uuid primary key default gen_random_uuid(),
    org_id uuid not null references public.organizations(id) on delete cascade,
    name text not null,
    category text not null default 'عام',
    template_type text not null default 'docx' check (template_type in ('docx')),
    description text,
    status text not null default 'active' check (status in ('active', 'archived')),
    created_by uuid not null references auth.users(id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create index if not exists idx_templates_org on public.templates (org_id);
drop trigger if exists templates_set_updated_at on public.templates;
create trigger templates_set_updated_at before
update on public.templates for each row execute function public.set_updated_at();
grant select,
    insert,
    update,
    delete on public.templates to authenticated;
alter table public.templates enable row level security;
drop policy if exists templates_select_member on public.templates;
create policy templates_select_member on public.templates for
select to authenticated using (
        exists (
            select 1
            from public.memberships m
            where m.org_id = templates.org_id
                and m.user_id = auth.uid()
        )
    );
drop policy if exists templates_insert_member on public.templates;
create policy templates_insert_member on public.templates for
insert to authenticated with check (
        templates.created_by = auth.uid()
        and exists (
            select 1
            from public.memberships m
            where m.org_id = templates.org_id
                and m.user_id = auth.uid()
        )
    );
drop policy if exists templates_update_member on public.templates;
create policy templates_update_member on public.templates for
update to authenticated using (
        exists (
            select 1
            from public.memberships m
            where m.org_id = templates.org_id
                and m.user_id = auth.uid()
        )
    ) with check (
        exists (
            select 1
            from public.memberships m
            where m.org_id = templates.org_id
                and m.user_id = auth.uid()
        )
    );
drop policy if exists templates_delete_owner on public.templates;
create policy templates_delete_owner on public.templates for delete to authenticated using (
    exists (
        select 1
        from public.memberships m
        where m.org_id = templates.org_id
            and m.user_id = auth.uid()
            and m.role = 'owner'
    )
);
-- template_versions
create table if not exists public.template_versions (
    id uuid primary key default gen_random_uuid(),
    org_id uuid not null references public.organizations(id) on delete cascade,
    template_id uuid not null references public.templates(id) on delete cascade,
    version_no integer not null default 1,
    storage_path text not null,
    file_name text not null,
    file_size integer not null default 0,
    mime_type text,
    variables jsonb not null default '[]'::jsonb,
    uploaded_by uuid not null references auth.users(id),
    created_at timestamptz not null default now()
);
create index if not exists idx_template_versions_template on public.template_versions (template_id);
grant select,
    insert,
    delete on public.template_versions to authenticated;
alter table public.template_versions enable row level security;
drop policy if exists template_versions_select_member on public.template_versions;
create policy template_versions_select_member on public.template_versions for
select to authenticated using (
        exists (
            select 1
            from public.memberships m
            where m.org_id = template_versions.org_id
                and m.user_id = auth.uid()
        )
    );
drop policy if exists template_versions_insert_member on public.template_versions;
create policy template_versions_insert_member on public.template_versions for
insert to authenticated with check (
        template_versions.uploaded_by = auth.uid()
        and exists (
            select 1
            from public.memberships m
            where m.org_id = template_versions.org_id
                and m.user_id = auth.uid()
        )
    );
drop policy if exists template_versions_delete_owner on public.template_versions;
create policy template_versions_delete_owner on public.template_versions for delete to authenticated using (
    exists (
        select 1
        from public.memberships m
        where m.org_id = template_versions.org_id
            and m.user_id = auth.uid()
            and m.role = 'owner'
    )
);
-- template_runs
create table if not exists public.template_runs (
    id uuid primary key default gen_random_uuid(),
    org_id uuid not null references public.organizations(id) on delete cascade,
    template_id uuid not null references public.templates(id) on delete cascade,
    version_id uuid references public.template_versions(id) on delete
    set null,
        matter_id uuid references public.matters(id) on delete
    set null,
        variables jsonb not null default '{}'::jsonb,
        output_path text,
        status text not null default 'pending' check (status in ('pending', 'success', 'failed')),
        run_by uuid not null references auth.users(id),
        created_at timestamptz not null default now()
);
create index if not exists idx_template_runs_org on public.template_runs (org_id);
grant select,
    insert on public.template_runs to authenticated;
alter table public.template_runs enable row level security;
drop policy if exists template_runs_select_member on public.template_runs;
create policy template_runs_select_member on public.template_runs for
select to authenticated using (
        exists (
            select 1
            from public.memberships m
            where m.org_id = template_runs.org_id
                and m.user_id = auth.uid()
        )
    );
drop policy if exists template_runs_insert_member on public.template_runs;
create policy template_runs_insert_member on public.template_runs for
insert to authenticated with check (
        template_runs.run_by = auth.uid()
        and exists (
            select 1
            from public.memberships m
            where m.org_id = template_runs.org_id
                and m.user_id = auth.uid()
        )
    );
-- =========================
-- 0019: Email Logs
-- =========================
create table if not exists public.email_logs (
    id uuid primary key default gen_random_uuid(),
    org_id uuid references public.organizations(id) on delete
    set null,
        to_email text not null,
        email_type text not null,
        status text not null default 'sent',
        metadata jsonb,
        created_at timestamptz not null default now()
);
create index if not exists idx_email_logs_org on public.email_logs (org_id);
grant select,
    insert on public.email_logs to authenticated;
alter table public.email_logs enable row level security;
drop policy if exists email_logs_select_member on public.email_logs;
create policy email_logs_select_member on public.email_logs for
select to authenticated using (
        org_id is null
        or exists (
            select 1
            from public.memberships m
            where m.org_id = email_logs.org_id
                and m.user_id = auth.uid()
        )
    );
-- =========================
-- 0022: Template Presets
-- =========================
create table if not exists public.template_presets (
    id uuid primary key default gen_random_uuid(),
    code text unique not null,
    name_ar text not null,
    category text not null default 'عام',
    variables jsonb not null default '[]'::jsonb,
    created_at timestamptz not null default now()
);
grant select on public.template_presets to authenticated;
alter table public.template_presets enable row level security;
drop policy if exists template_presets_select_all on public.template_presets;
create policy template_presets_select_all on public.template_presets for
select to authenticated using (true);
-- Seed presets (only if they don't exist)
insert into public.template_presets (code, name_ar, category, variables)
values (
        'WAKALA',
        'وكالة',
        'توكيلات',
        '[
    {"key":"client_name","label_ar":"اسم الموكل","required":true,"source":"client","path":"name","format":"text","transform":"none","help_ar":"اسم الموكل كما هو مسجل"},
    {"key":"client_id_no","label_ar":"رقم الهوية","required":true,"source":"client","path":"identity_no","format":"id","transform":"none","help_ar":"رقم هوية الموكل"},
    {"key":"lawyer_name","label_ar":"اسم المحامي","required":true,"source":"user","path":"name","format":"text","transform":"none","help_ar":"اسم المحامي الوكيل"},
    {"key":"license_no","label_ar":"رقم الترخيص","required":true,"source":"org","path":"license_no","format":"id","transform":"none","help_ar":"رقم ترخيص المكتب"},
    {"key":"scope","label_ar":"نطاق الوكالة","required":true,"source":"manual","format":"text","transform":"none","help_ar":"وصف نطاق الوكالة"},
    {"key":"issue_date","label_ar":"تاريخ الإصدار","required":true,"source":"computed","format":"date","transform":"none","help_ar":"تاريخ إصدار الوكالة"}
  ]'::jsonb
    ),
    (
        'PETITION',
        'لائحة دعوى',
        'دعاوى',
        '[
    {"key":"court_name","label_ar":"اسم المحكمة","required":true,"source":"manual","format":"text","transform":"none","help_ar":"المحكمة المختصة"},
    {"key":"plaintiff","label_ar":"المدعي","required":true,"source":"client","path":"name","format":"text","transform":"none","help_ar":"اسم المدعي"},
    {"key":"defendant","label_ar":"المدعى عليه","required":true,"source":"manual","format":"text","transform":"none","help_ar":"اسم المدعى عليه"},
    {"key":"subject","label_ar":"موضوع الدعوى","required":true,"source":"matter","path":"title","format":"text","transform":"none","help_ar":"موضوع الدعوى"},
    {"key":"facts","label_ar":"الوقائع","required":true,"source":"manual","format":"text","transform":"none","help_ar":"وقائع الدعوى"},
    {"key":"requests","label_ar":"الطلبات","required":true,"source":"manual","format":"text","transform":"none","help_ar":"طلبات المدعي"}
  ]'::jsonb
    ),
    (
        'MEMO',
        'مذكرة',
        'مذكرات',
        '[
    {"key":"court_name","label_ar":"اسم المحكمة","required":true,"source":"manual","format":"text","transform":"none","help_ar":"المحكمة المختصة"},
    {"key":"case_no","label_ar":"رقم القضية","required":true,"source":"matter","path":"case_no","format":"id","transform":"none","help_ar":"رقم القضية"},
    {"key":"party_name","label_ar":"اسم الطرف","required":true,"source":"client","path":"name","format":"text","transform":"none","help_ar":"اسم الطرف الممثل"},
    {"key":"subject","label_ar":"موضوع المذكرة","required":true,"source":"manual","format":"text","transform":"none","help_ar":"موضوع المذكرة"},
    {"key":"body","label_ar":"نص المذكرة","required":true,"source":"manual","format":"text","transform":"none","help_ar":"المحتوى الكامل للمذكرة"}
  ]'::jsonb
    ),
    (
        'NOTICE',
        'إنذار عدلي',
        'إنذارات',
        '[
    {"key":"sender_name","label_ar":"اسم المرسل","required":true,"source":"client","path":"name","format":"text","transform":"none","help_ar":"اسم المنذر"},
    {"key":"recipient_name","label_ar":"اسم المرسل إليه","required":true,"source":"manual","format":"text","transform":"none","help_ar":"اسم المنذر إليه"},
    {"key":"subject","label_ar":"موضوع الإنذار","required":true,"source":"manual","format":"text","transform":"none","help_ar":"موضوع الإنذار"},
    {"key":"notice_body","label_ar":"نص الإنذار","required":true,"source":"manual","format":"text","transform":"none","help_ar":"المحتوى الكامل للإنذار"},
    {"key":"deadline","label_ar":"المهلة","required":true,"source":"manual","format":"text","transform":"none","help_ar":"المهلة الممنوحة"}
  ]'::jsonb
    ) on conflict (code) do nothing;
-- =========================
-- 0023: Leads V2 columns
-- =========================
alter table public.leads
add column if not exists topic text;
alter table public.leads
add column if not exists message text;
alter table public.leads
add column if not exists utm jsonb;
alter table public.leads
add column if not exists referrer text;
-- =========================
-- 0024: Doc Generations
-- =========================
create table if not exists public.doc_generations (
    id uuid primary key default gen_random_uuid(),
    org_id uuid not null references public.organizations(id) on delete cascade,
    matter_id uuid references public.matters(id) on delete
    set null,
        client_id uuid references public.clients(id) on delete
    set null,
        preset_code text not null,
        title text not null,
        variables jsonb not null default '{}'::jsonb,
        format text not null check (format in ('pdf', 'docx')),
        file_path text,
        status text not null default 'draft' check (status in ('draft', 'exported', 'failed')),
        created_by uuid not null references auth.users(id),
        created_at timestamptz not null default now()
);
create index if not exists idx_doc_generations_org on public.doc_generations (org_id);
create index if not exists idx_doc_generations_org_matter on public.doc_generations (org_id, matter_id);
grant select,
    insert,
    update,
    delete on public.doc_generations to authenticated;
alter table public.doc_generations enable row level security;
drop policy if exists doc_generations_select_member on public.doc_generations;
create policy doc_generations_select_member on public.doc_generations for
select to authenticated using (
        exists (
            select 1
            from public.memberships m
            where m.org_id = doc_generations.org_id
                and m.user_id = auth.uid()
        )
    );
drop policy if exists doc_generations_insert_member on public.doc_generations;
create policy doc_generations_insert_member on public.doc_generations for
insert to authenticated with check (
        doc_generations.created_by = auth.uid()
        and exists (
            select 1
            from public.memberships m
            where m.org_id = doc_generations.org_id
                and m.user_id = auth.uid()
        )
    );
drop policy if exists doc_generations_update_member on public.doc_generations;
create policy doc_generations_update_member on public.doc_generations for
update to authenticated using (
        exists (
            select 1
            from public.memberships m
            where m.org_id = doc_generations.org_id
                and m.user_id = auth.uid()
        )
    ) with check (
        exists (
            select 1
            from public.memberships m
            where m.org_id = doc_generations.org_id
                and m.user_id = auth.uid()
        )
    );
drop policy if exists doc_generations_delete_owner on public.doc_generations;
create policy doc_generations_delete_owner on public.doc_generations for delete to authenticated using (
    exists (
        select 1
        from public.memberships m
        where m.org_id = doc_generations.org_id
            and m.user_id = auth.uid()
            and m.role = 'owner'
    )
);
-- =========================
-- 0025: Calendar Events
-- =========================
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
grant select,
    insert,
    update,
    delete on public.calendar_events to authenticated;
alter table public.calendar_events enable row level security;
drop policy if exists calendar_events_select_member on public.calendar_events;
create policy calendar_events_select_member on public.calendar_events for
select to authenticated using (
        exists (
            select 1
            from public.memberships m
            where m.org_id = calendar_events.org_id
                and m.user_id = auth.uid()
        )
    );
drop policy if exists calendar_events_insert_member on public.calendar_events;
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
drop policy if exists calendar_events_update_member on public.calendar_events;
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
drop policy if exists calendar_events_delete_member on public.calendar_events;
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
-- event_attendees
create table if not exists public.event_attendees (
    id uuid primary key default gen_random_uuid(),
    org_id uuid not null references public.organizations(id) on delete cascade,
    event_id uuid not null references public.calendar_events(id) on delete cascade,
    user_id uuid not null references auth.users(id),
    role text default 'required',
    created_at timestamptz not null default now()
);
create index if not exists idx_event_attendees_event on public.event_attendees (event_id);
grant select,
    insert,
    update,
    delete on public.event_attendees to authenticated;
alter table public.event_attendees enable row level security;
drop policy if exists event_attendees_select_member on public.event_attendees;
create policy event_attendees_select_member on public.event_attendees for
select to authenticated using (
        exists (
            select 1
            from public.memberships m
            where m.org_id = event_attendees.org_id
                and m.user_id = auth.uid()
        )
    );
drop policy if exists event_attendees_insert_member on public.event_attendees;
create policy event_attendees_insert_member on public.event_attendees for
insert to authenticated with check (
        exists (
            select 1
            from public.memberships m
            where m.org_id = event_attendees.org_id
                and m.user_id = auth.uid()
        )
    );
drop policy if exists event_attendees_delete_member on public.event_attendees;
create policy event_attendees_delete_member on public.event_attendees for delete to authenticated using (
    exists (
        select 1
        from public.memberships m
        where m.org_id = event_attendees.org_id
            and m.user_id = auth.uid()
    )
);
-- notification_jobs
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
create policy notification_jobs_select_member on public.notification_jobs for
select to authenticated using (
        exists (
            select 1
            from public.memberships m
            where m.org_id = notification_jobs.org_id
                and m.user_id = auth.uid()
        )
    );
drop policy if exists notification_jobs_insert_member on public.notification_jobs;
create policy notification_jobs_insert_member on public.notification_jobs for
insert to authenticated with check (
        exists (
            select 1
            from public.memberships m
            where m.org_id = notification_jobs.org_id
                and m.user_id = auth.uid()
        )
    );
-- org_ics_tokens
create table if not exists public.org_ics_tokens (
    id uuid primary key default gen_random_uuid(),
    org_id uuid not null references public.organizations(id) on delete cascade,
    token text unique not null default encode(gen_random_bytes(32), 'hex'),
    created_at timestamptz not null default now()
);
create index if not exists idx_org_ics_tokens_token on public.org_ics_tokens (token);
grant select,
    insert,
    delete on public.org_ics_tokens to authenticated;
alter table public.org_ics_tokens enable row level security;
drop policy if exists org_ics_tokens_owner_select on public.org_ics_tokens;
create policy org_ics_tokens_owner_select on public.org_ics_tokens for
select to authenticated using (
        exists (
            select 1
            from public.memberships m
            where m.org_id = org_ics_tokens.org_id
                and m.user_id = auth.uid()
        )
    );
drop policy if exists org_ics_tokens_owner_insert on public.org_ics_tokens;
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
drop policy if exists org_ics_tokens_owner_delete on public.org_ics_tokens;
create policy org_ics_tokens_owner_delete on public.org_ics_tokens for delete to authenticated using (
    exists (
        select 1
        from public.memberships m
        where m.org_id = org_ics_tokens.org_id
            and m.user_id = auth.uid()
            and m.role = 'owner'
    )
);
-- =========================
-- 0026: Email Integration
-- =========================
create table if not exists public.email_accounts (
    id uuid primary key default gen_random_uuid(),
    org_id uuid not null references public.organizations(id) on delete cascade,
    user_id uuid not null references auth.users(id),
    provider text not null check (provider in ('google', 'microsoft')),
    email text not null,
    access_token_enc text not null,
    refresh_token_enc text,
    token_expires_at timestamptz,
    scopes text,
    sync_cursor text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create index if not exists idx_email_accounts_org on public.email_accounts (org_id);
drop trigger if exists email_accounts_set_updated_at on public.email_accounts;
create trigger email_accounts_set_updated_at before
update on public.email_accounts for each row execute function public.set_updated_at();
grant select,
    insert,
    update,
    delete on public.email_accounts to authenticated;
alter table public.email_accounts enable row level security;
drop policy if exists email_accounts_select_member on public.email_accounts;
create policy email_accounts_select_member on public.email_accounts for
select to authenticated using (
        exists (
            select 1
            from public.memberships m
            where m.org_id = email_accounts.org_id
                and m.user_id = auth.uid()
        )
    );
drop policy if exists email_accounts_insert_own on public.email_accounts;
create policy email_accounts_insert_own on public.email_accounts for
insert to authenticated with check (
        email_accounts.user_id = auth.uid()
        and exists (
            select 1
            from public.memberships m
            where m.org_id = email_accounts.org_id
                and m.user_id = auth.uid()
        )
    );
drop policy if exists email_accounts_update_own on public.email_accounts;
create policy email_accounts_update_own on public.email_accounts for
update to authenticated using (email_accounts.user_id = auth.uid()) with check (email_accounts.user_id = auth.uid());
drop policy if exists email_accounts_delete_own on public.email_accounts;
create policy email_accounts_delete_own on public.email_accounts for delete to authenticated using (email_accounts.user_id = auth.uid());
-- email_threads
create table if not exists public.email_threads (
    id uuid primary key default gen_random_uuid(),
    org_id uuid not null references public.organizations(id) on delete cascade,
    provider_thread_id text not null,
    subject text,
    created_at timestamptz not null default now(),
    unique (org_id, provider_thread_id)
);
create index if not exists idx_email_threads_org on public.email_threads (org_id);
grant select,
    insert,
    update on public.email_threads to authenticated;
alter table public.email_threads enable row level security;
drop policy if exists email_threads_select_member on public.email_threads;
create policy email_threads_select_member on public.email_threads for
select to authenticated using (
        exists (
            select 1
            from public.memberships m
            where m.org_id = email_threads.org_id
                and m.user_id = auth.uid()
        )
    );
drop policy if exists email_threads_insert_member on public.email_threads;
create policy email_threads_insert_member on public.email_threads for
insert to authenticated with check (
        exists (
            select 1
            from public.memberships m
            where m.org_id = email_threads.org_id
                and m.user_id = auth.uid()
        )
    );
-- email_messages
create table if not exists public.email_messages (
    id uuid primary key default gen_random_uuid(),
    org_id uuid not null references public.organizations(id) on delete cascade,
    thread_id uuid references public.email_threads(id) on delete
    set null,
        provider_message_id text not null,
        direction text not null check (direction in ('in', 'out')),
        from_email text,
        to_emails text,
        cc_emails text,
        bcc_emails text,
        sent_at timestamptz,
        snippet text,
        body_preview text,
        raw_meta jsonb,
        created_at timestamptz not null default now(),
        unique (org_id, provider_message_id)
);
create index if not exists idx_email_messages_org on public.email_messages (org_id);
create index if not exists idx_email_messages_thread on public.email_messages (thread_id);
grant select,
    insert on public.email_messages to authenticated;
alter table public.email_messages enable row level security;
drop policy if exists email_messages_select_member on public.email_messages;
create policy email_messages_select_member on public.email_messages for
select to authenticated using (
        exists (
            select 1
            from public.memberships m
            where m.org_id = email_messages.org_id
                and m.user_id = auth.uid()
        )
    );
drop policy if exists email_messages_insert_member on public.email_messages;
create policy email_messages_insert_member on public.email_messages for
insert to authenticated with check (
        exists (
            select 1
            from public.memberships m
            where m.org_id = email_messages.org_id
                and m.user_id = auth.uid()
        )
    );
-- matter_email_links
create table if not exists public.matter_email_links (
    id uuid primary key default gen_random_uuid(),
    org_id uuid not null references public.organizations(id) on delete cascade,
    matter_id uuid not null references public.matters(id) on delete cascade,
    message_id uuid not null references public.email_messages(id) on delete cascade,
    created_at timestamptz not null default now(),
    unique (org_id, matter_id, message_id)
);
create index if not exists idx_matter_email_links_matter on public.matter_email_links (matter_id);
grant select,
    insert,
    delete on public.matter_email_links to authenticated;
alter table public.matter_email_links enable row level security;
drop policy if exists matter_email_links_select_member on public.matter_email_links;
create policy matter_email_links_select_member on public.matter_email_links for
select to authenticated using (
        exists (
            select 1
            from public.memberships m
            where m.org_id = matter_email_links.org_id
                and m.user_id = auth.uid()
        )
    );
drop policy if exists matter_email_links_insert_member on public.matter_email_links;
create policy matter_email_links_insert_member on public.matter_email_links for
insert to authenticated with check (
        exists (
            select 1
            from public.memberships m
            where m.org_id = matter_email_links.org_id
                and m.user_id = auth.uid()
        )
    );
drop policy if exists matter_email_links_delete_member on public.matter_email_links;
create policy matter_email_links_delete_member on public.matter_email_links for delete to authenticated using (
    exists (
        select 1
        from public.memberships m
        where m.org_id = matter_email_links.org_id
            and m.user_id = auth.uid()
    )
);
-- =========================
-- 0027: Najiz Packets
-- =========================
create table if not exists public.najiz_packets (
    id uuid primary key default gen_random_uuid(),
    org_id uuid not null references public.organizations(id) on delete cascade,
    matter_id uuid references public.matters(id) on delete
    set null,
        title text not null,
        status text not null default 'preparing' check (
            status in (
                'preparing',
                'review',
                'ready',
                'submitted_manual'
            )
        ),
        requirements jsonb not null default '[]'::jsonb,
        notes text,
        submitted_at timestamptz,
        created_by uuid not null references auth.users(id),
        created_at timestamptz not null default now()
);
create index if not exists idx_najiz_packets_org on public.najiz_packets (org_id);
grant select,
    insert,
    update,
    delete on public.najiz_packets to authenticated;
alter table public.najiz_packets enable row level security;
drop policy if exists najiz_packets_select_member on public.najiz_packets;
create policy najiz_packets_select_member on public.najiz_packets for
select to authenticated using (
        exists (
            select 1
            from public.memberships m
            where m.org_id = najiz_packets.org_id
                and m.user_id = auth.uid()
        )
    );
drop policy if exists najiz_packets_insert_member on public.najiz_packets;
create policy najiz_packets_insert_member on public.najiz_packets for
insert to authenticated with check (
        najiz_packets.created_by = auth.uid()
        and exists (
            select 1
            from public.memberships m
            where m.org_id = najiz_packets.org_id
                and m.user_id = auth.uid()
        )
    );
drop policy if exists najiz_packets_update_member on public.najiz_packets;
create policy najiz_packets_update_member on public.najiz_packets for
update to authenticated using (
        exists (
            select 1
            from public.memberships m
            where m.org_id = najiz_packets.org_id
                and m.user_id = auth.uid()
        )
    ) with check (
        exists (
            select 1
            from public.memberships m
            where m.org_id = najiz_packets.org_id
                and m.user_id = auth.uid()
        )
    );
drop policy if exists najiz_packets_delete_owner on public.najiz_packets;
create policy najiz_packets_delete_owner on public.najiz_packets for delete to authenticated using (
    najiz_packets.created_by = auth.uid()
    or exists (
        select 1
        from public.memberships m
        where m.org_id = najiz_packets.org_id
            and m.user_id = auth.uid()
            and m.role = 'owner'
    )
);
-- najiz_packet_items
create table if not exists public.najiz_packet_items (
    id uuid primary key default gen_random_uuid(),
    org_id uuid not null references public.organizations(id) on delete cascade,
    packet_id uuid not null references public.najiz_packets(id) on delete cascade,
    item_type text not null check (item_type in ('document', 'field', 'note')),
    label text not null,
    value text,
    document_id uuid references public.documents(id) on delete
    set null,
        done boolean default false,
        created_at timestamptz not null default now()
);
create index if not exists idx_najiz_packet_items_packet on public.najiz_packet_items (packet_id);
grant select,
    insert,
    update,
    delete on public.najiz_packet_items to authenticated;
alter table public.najiz_packet_items enable row level security;
drop policy if exists najiz_packet_items_select_member on public.najiz_packet_items;
create policy najiz_packet_items_select_member on public.najiz_packet_items for
select to authenticated using (
        exists (
            select 1
            from public.memberships m
            where m.org_id = najiz_packet_items.org_id
                and m.user_id = auth.uid()
        )
    );
drop policy if exists najiz_packet_items_insert_member on public.najiz_packet_items;
create policy najiz_packet_items_insert_member on public.najiz_packet_items for
insert to authenticated with check (
        exists (
            select 1
            from public.memberships m
            where m.org_id = najiz_packet_items.org_id
                and m.user_id = auth.uid()
        )
    );
drop policy if exists najiz_packet_items_update_member on public.najiz_packet_items;
create policy najiz_packet_items_update_member on public.najiz_packet_items for
update to authenticated using (
        exists (
            select 1
            from public.memberships m
            where m.org_id = najiz_packet_items.org_id
                and m.user_id = auth.uid()
        )
    ) with check (
        exists (
            select 1
            from public.memberships m
            where m.org_id = najiz_packet_items.org_id
                and m.user_id = auth.uid()
        )
    );
drop policy if exists najiz_packet_items_delete_member on public.najiz_packet_items;
create policy najiz_packet_items_delete_member on public.najiz_packet_items for delete to authenticated using (
    exists (
        select 1
        from public.memberships m
        where m.org_id = najiz_packet_items.org_id
            and m.user_id = auth.uid()
    )
);
-- =========================
-- DONE! All tables created.
-- =========================