create extension if not exists pgcrypto;

-- Helper predicates for org-based RLS.
create or replace function public.is_org_member(org uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.memberships m
    where m.org_id = org
      and m.user_id = auth.uid()
  );
$$;

create or replace function public.is_org_owner(org uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.memberships m
    where m.org_id = org
      and m.user_id = auth.uid()
      and m.role = 'owner'
  );
$$;

-- updated_at helper
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  type text not null default 'person' check (type in ('person', 'company')),
  name text not null,
  identity_no text null,
  commercial_no text null,
  email text null,
  phone text null,
  notes text null,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists clients_org_id_idx on public.clients (org_id);
create index if not exists clients_org_id_name_idx on public.clients (org_id, name);

create table if not exists public.matters (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null references public.clients(id),
  title text not null,
  status text not null default 'new' check (status in ('new', 'in_progress', 'on_hold', 'closed', 'archived')),
  summary text null,
  assigned_user_id uuid null references auth.users(id),
  is_private boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists matters_org_id_idx on public.matters (org_id);
create index if not exists matters_org_id_client_id_idx on public.matters (org_id, client_id);
create index if not exists matters_org_id_status_idx on public.matters (org_id, status);

create table if not exists public.matter_members (
  matter_id uuid not null references public.matters(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key (matter_id, user_id)
);

create table if not exists public.matter_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  matter_id uuid not null references public.matters(id) on delete cascade,
  type text not null default 'note' check (type in ('hearing', 'call', 'note', 'email', 'meeting', 'other')),
  note text null,
  event_date timestamptz null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists matter_events_org_id_matter_id_created_at_idx
  on public.matter_events (org_id, matter_id, created_at desc);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  matter_id uuid null references public.matters(id) on delete set null,
  client_id uuid null references public.clients(id) on delete set null,
  title text not null,
  description text null,
  folder text not null default '/',
  tags jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists documents_org_id_idx on public.documents (org_id);
create index if not exists documents_org_id_matter_id_idx on public.documents (org_id, matter_id);

create table if not exists public.document_versions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  version_no int not null,
  storage_path text not null,
  file_name text not null,
  file_size bigint not null,
  mime_type text null,
  checksum text null,
  uploaded_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (document_id, version_no)
);

create index if not exists document_versions_org_id_document_id_idx
  on public.document_versions (org_id, document_id);

create table if not exists public.document_shares (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  token text not null unique,
  expires_at timestamptz not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists document_shares_org_id_document_id_idx
  on public.document_shares (org_id, document_id);

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
  created_at timestamptz not null default now()
);

create index if not exists tasks_org_id_idx on public.tasks (org_id);
create index if not exists tasks_org_id_due_at_idx on public.tasks (org_id, due_at);

create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null references public.clients(id),
  matter_id uuid null references public.matters(id),
  number text not null,
  items jsonb not null,
  total numeric(14,2) not null,
  currency text not null default 'SAR',
  status text not null default 'draft' check (status in ('draft', 'sent', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  unique (org_id, number)
);

create index if not exists quotes_org_id_idx on public.quotes (org_id);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null references public.clients(id),
  matter_id uuid null references public.matters(id),
  number text not null,
  items jsonb not null,
  subtotal numeric(14,2) not null,
  tax numeric(14,2) not null default 0,
  total numeric(14,2) not null,
  currency text not null default 'SAR',
  status text not null default 'unpaid' check (status in ('unpaid', 'partial', 'paid', 'void')),
  issued_at timestamptz not null default now(),
  due_at timestamptz null,
  unique (org_id, number)
);

create index if not exists invoices_org_id_idx on public.invoices (org_id);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  amount numeric(14,2) not null,
  method text null,
  paid_at timestamptz null,
  note text null,
  created_at timestamptz not null default now()
);

create index if not exists payments_org_id_idx on public.payments (org_id);
create index if not exists payments_invoice_id_idx on public.payments (invoice_id);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid null references auth.users(id) on delete set null,
  action text not null,
  entity_type text null,
  entity_id uuid null,
  meta jsonb not null default '{}'::jsonb,
  ip text null,
  user_agent text null,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_org_id_created_at_idx
  on public.audit_logs (org_id, created_at desc);

-- Matter membership predicate (security definer to avoid RLS recursion).
create or replace function public.is_matter_member(matter uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.matter_members mm
    where mm.matter_id = matter
      and mm.user_id = auth.uid()
  );
$$;

-- updated_at triggers
drop trigger if exists clients_set_updated_at on public.clients;
create trigger clients_set_updated_at
before update on public.clients
for each row
execute function public.set_updated_at();

drop trigger if exists matters_set_updated_at on public.matters;
create trigger matters_set_updated_at
before update on public.matters
for each row
execute function public.set_updated_at();

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.clients to authenticated;
grant select, insert, update, delete on public.matters to authenticated;
grant select, insert, delete on public.matter_members to authenticated;
grant select, insert, update, delete on public.matter_events to authenticated;
grant select, insert, update, delete on public.documents to authenticated;
grant select, insert, update, delete on public.document_versions to authenticated;
grant select, insert, update, delete on public.document_shares to authenticated;
grant select, insert, update, delete on public.tasks to authenticated;
grant select, insert, update, delete on public.quotes to authenticated;
grant select, insert, update, delete on public.invoices to authenticated;
grant select, insert, update, delete on public.payments to authenticated;
grant select, insert, delete on public.audit_logs to authenticated;

alter table public.clients enable row level security;
alter table public.matters enable row level security;
alter table public.matter_members enable row level security;
alter table public.matter_events enable row level security;
alter table public.documents enable row level security;
alter table public.document_versions enable row level security;
alter table public.document_shares enable row level security;
alter table public.tasks enable row level security;
alter table public.quotes enable row level security;
alter table public.invoices enable row level security;
alter table public.payments enable row level security;
alter table public.audit_logs enable row level security;

-- clients
drop policy if exists clients_select_member on public.clients;
drop policy if exists clients_insert_member on public.clients;
drop policy if exists clients_update_member on public.clients;
drop policy if exists clients_delete_owner on public.clients;

create policy clients_select_member
on public.clients
for select
to authenticated
using (public.is_org_member(org_id));

create policy clients_insert_member
on public.clients
for insert
to authenticated
with check (public.is_org_member(org_id));

create policy clients_update_member
on public.clients
for update
to authenticated
using (public.is_org_member(org_id))
with check (public.is_org_member(org_id));

create policy clients_delete_owner
on public.clients
for delete
to authenticated
using (public.is_org_owner(org_id));

-- matters (privacy-aware)
drop policy if exists matters_select_member on public.matters;
drop policy if exists matters_insert_member on public.matters;
drop policy if exists matters_update_owner_or_assignee on public.matters;
drop policy if exists matters_delete_owner_or_assignee on public.matters;

create policy matters_select_member
on public.matters
for select
to authenticated
using (
  public.is_org_member(org_id)
  and (
    is_private = false
    or public.is_org_owner(org_id)
    or public.is_matter_member(id)
  )
);

create policy matters_insert_member
on public.matters
for insert
to authenticated
with check (public.is_org_member(org_id));

create policy matters_update_owner_or_assignee
on public.matters
for update
to authenticated
using (public.is_org_owner(org_id) or assigned_user_id = auth.uid())
with check (public.is_org_owner(org_id) or assigned_user_id = auth.uid());

create policy matters_delete_owner_or_assignee
on public.matters
for delete
to authenticated
using (public.is_org_owner(org_id) or assigned_user_id = auth.uid());

-- matter_members
drop policy if exists matter_members_select_member on public.matter_members;
drop policy if exists matter_members_insert_manager on public.matter_members;
drop policy if exists matter_members_delete_manager on public.matter_members;

create policy matter_members_select_member
on public.matter_members
for select
to authenticated
using (
  exists (
    select 1
    from public.matters m
    where m.id = matter_members.matter_id
      and public.is_org_member(m.org_id)
      and (
        m.is_private = false
        or public.is_org_owner(m.org_id)
        or public.is_matter_member(m.id)
      )
  )
);

create policy matter_members_insert_manager
on public.matter_members
for insert
to authenticated
with check (
  exists (
    select 1
    from public.matters m
    where m.id = matter_members.matter_id
      and public.is_org_member(m.org_id)
      and (public.is_org_owner(m.org_id) or m.assigned_user_id = auth.uid())
  )
);

create policy matter_members_delete_manager
on public.matter_members
for delete
to authenticated
using (
  exists (
    select 1
    from public.matters m
    where m.id = matter_members.matter_id
      and public.is_org_member(m.org_id)
      and (public.is_org_owner(m.org_id) or m.assigned_user_id = auth.uid())
  )
);

-- Generic org tables: allow members CRUD, delete owner-only
-- matter_events
drop policy if exists matter_events_select_member on public.matter_events;
drop policy if exists matter_events_insert_member on public.matter_events;
drop policy if exists matter_events_update_member on public.matter_events;
drop policy if exists matter_events_delete_owner on public.matter_events;

create policy matter_events_select_member
on public.matter_events
for select
to authenticated
using (public.is_org_member(org_id));

create policy matter_events_insert_member
on public.matter_events
for insert
to authenticated
with check (public.is_org_member(org_id));

create policy matter_events_update_member
on public.matter_events
for update
to authenticated
using (public.is_org_member(org_id))
with check (public.is_org_member(org_id));

create policy matter_events_delete_owner
on public.matter_events
for delete
to authenticated
using (public.is_org_owner(org_id));

-- documents
drop policy if exists documents_select_member on public.documents;
drop policy if exists documents_insert_member on public.documents;
drop policy if exists documents_update_member on public.documents;
drop policy if exists documents_delete_owner on public.documents;

create policy documents_select_member
on public.documents
for select
to authenticated
using (public.is_org_member(org_id));

create policy documents_insert_member
on public.documents
for insert
to authenticated
with check (public.is_org_member(org_id));

create policy documents_update_member
on public.documents
for update
to authenticated
using (public.is_org_member(org_id))
with check (public.is_org_member(org_id));

create policy documents_delete_owner
on public.documents
for delete
to authenticated
using (public.is_org_owner(org_id));

-- document_versions
drop policy if exists document_versions_select_member on public.document_versions;
drop policy if exists document_versions_insert_member on public.document_versions;
drop policy if exists document_versions_update_member on public.document_versions;
drop policy if exists document_versions_delete_owner on public.document_versions;

create policy document_versions_select_member
on public.document_versions
for select
to authenticated
using (public.is_org_member(org_id));

create policy document_versions_insert_member
on public.document_versions
for insert
to authenticated
with check (public.is_org_member(org_id));

create policy document_versions_update_member
on public.document_versions
for update
to authenticated
using (public.is_org_member(org_id))
with check (public.is_org_member(org_id));

create policy document_versions_delete_owner
on public.document_versions
for delete
to authenticated
using (public.is_org_owner(org_id));

-- document_shares
drop policy if exists document_shares_select_member on public.document_shares;
drop policy if exists document_shares_insert_member on public.document_shares;
drop policy if exists document_shares_update_member on public.document_shares;
drop policy if exists document_shares_delete_owner on public.document_shares;

create policy document_shares_select_member
on public.document_shares
for select
to authenticated
using (public.is_org_member(org_id));

create policy document_shares_insert_member
on public.document_shares
for insert
to authenticated
with check (public.is_org_member(org_id));

create policy document_shares_update_member
on public.document_shares
for update
to authenticated
using (public.is_org_member(org_id))
with check (public.is_org_member(org_id));

create policy document_shares_delete_owner
on public.document_shares
for delete
to authenticated
using (public.is_org_owner(org_id));

-- tasks
drop policy if exists tasks_select_member on public.tasks;
drop policy if exists tasks_insert_member on public.tasks;
drop policy if exists tasks_update_member on public.tasks;
drop policy if exists tasks_delete_owner on public.tasks;

create policy tasks_select_member
on public.tasks
for select
to authenticated
using (public.is_org_member(org_id));

create policy tasks_insert_member
on public.tasks
for insert
to authenticated
with check (public.is_org_member(org_id));

create policy tasks_update_member
on public.tasks
for update
to authenticated
using (public.is_org_member(org_id))
with check (public.is_org_member(org_id));

create policy tasks_delete_owner
on public.tasks
for delete
to authenticated
using (public.is_org_owner(org_id));

-- quotes
drop policy if exists quotes_select_member on public.quotes;
drop policy if exists quotes_insert_member on public.quotes;
drop policy if exists quotes_update_member on public.quotes;
drop policy if exists quotes_delete_owner on public.quotes;

create policy quotes_select_member
on public.quotes
for select
to authenticated
using (public.is_org_member(org_id));

create policy quotes_insert_member
on public.quotes
for insert
to authenticated
with check (public.is_org_member(org_id));

create policy quotes_update_member
on public.quotes
for update
to authenticated
using (public.is_org_member(org_id))
with check (public.is_org_member(org_id));

create policy quotes_delete_owner
on public.quotes
for delete
to authenticated
using (public.is_org_owner(org_id));

-- invoices
drop policy if exists invoices_select_member on public.invoices;
drop policy if exists invoices_insert_member on public.invoices;
drop policy if exists invoices_update_member on public.invoices;
drop policy if exists invoices_delete_owner on public.invoices;

create policy invoices_select_member
on public.invoices
for select
to authenticated
using (public.is_org_member(org_id));

create policy invoices_insert_member
on public.invoices
for insert
to authenticated
with check (public.is_org_member(org_id));

create policy invoices_update_member
on public.invoices
for update
to authenticated
using (public.is_org_member(org_id))
with check (public.is_org_member(org_id));

create policy invoices_delete_owner
on public.invoices
for delete
to authenticated
using (public.is_org_owner(org_id));

-- payments
drop policy if exists payments_select_member on public.payments;
drop policy if exists payments_insert_member on public.payments;
drop policy if exists payments_update_member on public.payments;
drop policy if exists payments_delete_owner on public.payments;

create policy payments_select_member
on public.payments
for select
to authenticated
using (public.is_org_member(org_id));

create policy payments_insert_member
on public.payments
for insert
to authenticated
with check (public.is_org_member(org_id));

create policy payments_update_member
on public.payments
for update
to authenticated
using (public.is_org_member(org_id))
with check (public.is_org_member(org_id));

create policy payments_delete_owner
on public.payments
for delete
to authenticated
using (public.is_org_owner(org_id));

-- audit_logs (owners-only visibility)
drop policy if exists audit_logs_select_owner on public.audit_logs;
drop policy if exists audit_logs_insert_member on public.audit_logs;
drop policy if exists audit_logs_delete_owner on public.audit_logs;

create policy audit_logs_select_owner
on public.audit_logs
for select
to authenticated
using (public.is_org_owner(org_id));

create policy audit_logs_insert_member
on public.audit_logs
for insert
to authenticated
with check (public.is_org_member(org_id));

create policy audit_logs_delete_owner
on public.audit_logs
for delete
to authenticated
using (public.is_org_owner(org_id));
