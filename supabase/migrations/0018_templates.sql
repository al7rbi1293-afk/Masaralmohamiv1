create extension if not exists pgcrypto;

-- Phase 10.1.0: Templates library (per org) + versions + runs.

create table if not exists public.templates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  category text not null default 'عام',
  template_type text not null default 'docx' check (template_type in ('docx', 'pdf')),
  description text null,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_templates_org on public.templates (org_id);
create index if not exists idx_templates_org_name on public.templates (org_id, name);
create index if not exists idx_templates_org_category on public.templates (org_id, category);
create index if not exists idx_templates_org_status on public.templates (org_id, status);

drop trigger if exists templates_set_updated_at on public.templates;
create trigger templates_set_updated_at
before update on public.templates
for each row
execute function public.set_updated_at();

create table if not exists public.template_versions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  template_id uuid not null references public.templates(id) on delete cascade,
  version_no int not null,
  storage_path text not null,
  file_name text not null,
  file_size bigint not null,
  mime_type text null,
  variables jsonb not null default '[]'::jsonb,
  uploaded_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (template_id, version_no)
);

create index if not exists idx_template_versions_org_template
on public.template_versions (org_id, template_id);

create table if not exists public.template_runs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  template_id uuid not null references public.templates(id) on delete cascade,
  matter_id uuid null references public.matters(id) on delete set null,
  client_id uuid null references public.clients(id) on delete set null,
  status text not null default 'queued' check (status in ('queued', 'completed', 'failed')),
  output_document_id uuid null references public.documents(id) on delete set null,
  error text null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_template_runs_org_created
on public.template_runs (org_id, created_at desc);

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.templates to authenticated;
grant select, insert, update, delete on public.template_versions to authenticated;
grant select, insert, update, delete on public.template_runs to authenticated;

alter table public.templates enable row level security;
alter table public.template_versions enable row level security;
alter table public.template_runs enable row level security;

-- templates policies
drop policy if exists templates_select_member on public.templates;
drop policy if exists templates_insert_member on public.templates;
drop policy if exists templates_update_owner_or_creator on public.templates;
drop policy if exists templates_delete_owner on public.templates;

create policy templates_select_member
on public.templates
for select
to authenticated
using (
  exists (
    select 1
    from public.memberships m
    where m.org_id = templates.org_id
      and m.user_id = auth.uid()
  )
);

create policy templates_insert_member
on public.templates
for insert
to authenticated
with check (
  templates.created_by = auth.uid()
  and exists (
    select 1
    from public.memberships m
    where m.org_id = templates.org_id
      and m.user_id = auth.uid()
  )
);

create policy templates_update_owner_or_creator
on public.templates
for update
to authenticated
using (
  exists (
    select 1
    from public.memberships m
    where m.org_id = templates.org_id
      and m.user_id = auth.uid()
  )
  and (
    templates.created_by = auth.uid()
    or exists (
      select 1
      from public.memberships m
      where m.org_id = templates.org_id
        and m.user_id = auth.uid()
        and m.role = 'owner'
    )
  )
)
with check (
  exists (
    select 1
    from public.memberships m
    where m.org_id = templates.org_id
      and m.user_id = auth.uid()
  )
);

create policy templates_delete_owner
on public.templates
for delete
to authenticated
using (
  exists (
    select 1
    from public.memberships m
    where m.org_id = templates.org_id
      and m.user_id = auth.uid()
      and m.role = 'owner'
  )
);

-- template_versions policies
drop policy if exists template_versions_select_member on public.template_versions;
drop policy if exists template_versions_insert_member on public.template_versions;
drop policy if exists template_versions_update_owner_or_uploader on public.template_versions;
drop policy if exists template_versions_delete_owner on public.template_versions;

create policy template_versions_select_member
on public.template_versions
for select
to authenticated
using (
  exists (
    select 1
    from public.memberships m
    where m.org_id = template_versions.org_id
      and m.user_id = auth.uid()
  )
);

create policy template_versions_insert_member
on public.template_versions
for insert
to authenticated
with check (
  template_versions.uploaded_by = auth.uid()
  and exists (
    select 1
    from public.memberships m
    where m.org_id = template_versions.org_id
      and m.user_id = auth.uid()
  )
);

create policy template_versions_update_owner_or_uploader
on public.template_versions
for update
to authenticated
using (
  exists (
    select 1
    from public.memberships m
    where m.org_id = template_versions.org_id
      and m.user_id = auth.uid()
  )
  and (
    template_versions.uploaded_by = auth.uid()
    or exists (
      select 1
      from public.memberships m
      where m.org_id = template_versions.org_id
        and m.user_id = auth.uid()
        and m.role = 'owner'
    )
  )
)
with check (
  exists (
    select 1
    from public.memberships m
    where m.org_id = template_versions.org_id
      and m.user_id = auth.uid()
  )
);

create policy template_versions_delete_owner
on public.template_versions
for delete
to authenticated
using (
  exists (
    select 1
    from public.memberships m
    where m.org_id = template_versions.org_id
      and m.user_id = auth.uid()
      and m.role = 'owner'
  )
);

-- template_runs policies
drop policy if exists template_runs_select_member on public.template_runs;
drop policy if exists template_runs_insert_member on public.template_runs;
drop policy if exists template_runs_update_owner_or_creator on public.template_runs;
drop policy if exists template_runs_delete_owner on public.template_runs;

create policy template_runs_select_member
on public.template_runs
for select
to authenticated
using (
  exists (
    select 1
    from public.memberships m
    where m.org_id = template_runs.org_id
      and m.user_id = auth.uid()
  )
);

create policy template_runs_insert_member
on public.template_runs
for insert
to authenticated
with check (
  template_runs.created_by = auth.uid()
  and exists (
    select 1
    from public.memberships m
    where m.org_id = template_runs.org_id
      and m.user_id = auth.uid()
  )
);

create policy template_runs_update_owner_or_creator
on public.template_runs
for update
to authenticated
using (
  exists (
    select 1
    from public.memberships m
    where m.org_id = template_runs.org_id
      and m.user_id = auth.uid()
  )
  and (
    template_runs.created_by = auth.uid()
    or exists (
      select 1
      from public.memberships m
      where m.org_id = template_runs.org_id
        and m.user_id = auth.uid()
        and m.role = 'owner'
    )
  )
)
with check (
  exists (
    select 1
    from public.memberships m
    where m.org_id = template_runs.org_id
      and m.user_id = auth.uid()
  )
);

create policy template_runs_delete_owner
on public.template_runs
for delete
to authenticated
using (
  exists (
    select 1
    from public.memberships m
    where m.org_id = template_runs.org_id
      and m.user_id = auth.uid()
      and m.role = 'owner'
  )
);

