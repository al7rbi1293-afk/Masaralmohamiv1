create extension if not exists pgcrypto;
-- Step 12.1: Document generations (export log for preset-based docs)
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
create index if not exists idx_doc_generations_org_status on public.doc_generations (org_id, status);
grant select,
    insert,
    update,
    delete on public.doc_generations to authenticated;
alter table public.doc_generations enable row level security;
-- RLS: org members only
drop policy if exists doc_generations_select_member on public.doc_generations;
drop policy if exists doc_generations_insert_member on public.doc_generations;
drop policy if exists doc_generations_update_member on public.doc_generations;
drop policy if exists doc_generations_delete_owner on public.doc_generations;
create policy doc_generations_select_member on public.doc_generations for
select to authenticated using (
        exists (
            select 1
            from public.memberships m
            where m.org_id = doc_generations.org_id
                and m.user_id = auth.uid()
        )
    );
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
create policy doc_generations_update_member on public.doc_generations for
update to authenticated using (
        exists (
            select 1
            from public.memberships m
            where m.org_id = doc_generations.org_id
                and m.user_id = auth.uid()
        )
        and (
            doc_generations.created_by = auth.uid()
            or exists (
                select 1
                from public.memberships m
                where m.org_id = doc_generations.org_id
                    and m.user_id = auth.uid()
                    and m.role = 'owner'
            )
        )
    ) with check (
        exists (
            select 1
            from public.memberships m
            where m.org_id = doc_generations.org_id
                and m.user_id = auth.uid()
        )
    );
create policy doc_generations_delete_owner on public.doc_generations for delete to authenticated using (
    exists (
        select 1
        from public.memberships m
        where m.org_id = doc_generations.org_id
            and m.user_id = auth.uid()
            and m.role = 'owner'
    )
);