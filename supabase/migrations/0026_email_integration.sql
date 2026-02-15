create extension if not exists pgcrypto;
-- Step 12.3: Email integration tables
-- 1) email_accounts (OAuth connected mailboxes)
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
create index if not exists idx_email_accounts_user on public.email_accounts (user_id);
drop trigger if exists email_accounts_set_updated_at on public.email_accounts;
create trigger email_accounts_set_updated_at before
update on public.email_accounts for each row execute function public.set_updated_at();
grant select,
    insert,
    update,
    delete on public.email_accounts to authenticated;
alter table public.email_accounts enable row level security;
create policy email_accounts_select_member on public.email_accounts for
select to authenticated using (
        exists (
            select 1
            from public.memberships m
            where m.org_id = email_accounts.org_id
                and m.user_id = auth.uid()
        )
    );
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
create policy email_accounts_update_own on public.email_accounts for
update to authenticated using (email_accounts.user_id = auth.uid()) with check (email_accounts.user_id = auth.uid());
create policy email_accounts_delete_own on public.email_accounts for delete to authenticated using (email_accounts.user_id = auth.uid());
-- 2) email_threads
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
create policy email_threads_select_member on public.email_threads for
select to authenticated using (
        exists (
            select 1
            from public.memberships m
            where m.org_id = email_threads.org_id
                and m.user_id = auth.uid()
        )
    );
create policy email_threads_insert_member on public.email_threads for
insert to authenticated with check (
        exists (
            select 1
            from public.memberships m
            where m.org_id = email_threads.org_id
                and m.user_id = auth.uid()
        )
    );
-- 3) email_messages
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
create index if not exists idx_email_messages_org_sent on public.email_messages (org_id, sent_at desc);
grant select,
    insert on public.email_messages to authenticated;
alter table public.email_messages enable row level security;
create policy email_messages_select_member on public.email_messages for
select to authenticated using (
        exists (
            select 1
            from public.memberships m
            where m.org_id = email_messages.org_id
                and m.user_id = auth.uid()
        )
    );
create policy email_messages_insert_member on public.email_messages for
insert to authenticated with check (
        exists (
            select 1
            from public.memberships m
            where m.org_id = email_messages.org_id
                and m.user_id = auth.uid()
        )
    );
-- 4) matter_email_links
create table if not exists public.matter_email_links (
    id uuid primary key default gen_random_uuid(),
    org_id uuid not null references public.organizations(id) on delete cascade,
    matter_id uuid not null references public.matters(id) on delete cascade,
    message_id uuid not null references public.email_messages(id) on delete cascade,
    created_at timestamptz not null default now(),
    unique (org_id, matter_id, message_id)
);
create index if not exists idx_matter_email_links_matter on public.matter_email_links (matter_id);
create index if not exists idx_matter_email_links_message on public.matter_email_links (message_id);
grant select,
    insert,
    delete on public.matter_email_links to authenticated;
alter table public.matter_email_links enable row level security;
create policy matter_email_links_select_member on public.matter_email_links for
select to authenticated using (
        exists (
            select 1
            from public.memberships m
            where m.org_id = matter_email_links.org_id
                and m.user_id = auth.uid()
        )
    );
create policy matter_email_links_insert_member on public.matter_email_links for
insert to authenticated with check (
        exists (
            select 1
            from public.memberships m
            where m.org_id = matter_email_links.org_id
                and m.user_id = auth.uid()
        )
    );
create policy matter_email_links_delete_member on public.matter_email_links for delete to authenticated using (
    exists (
        select 1
        from public.memberships m
        where m.org_id = matter_email_links.org_id
            and m.user_id = auth.uid()
    )
);