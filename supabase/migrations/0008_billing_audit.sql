create extension if not exists pgcrypto;

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
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (org_id, number)
);

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
  created_by uuid not null references auth.users(id),
  unique (org_id, number)
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  amount numeric(14,2) not null,
  method text null,
  paid_at timestamptz null,
  note text null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid null references auth.users(id),
  action text not null,
  entity_type text null,
  entity_id uuid null,
  meta jsonb not null default '{}'::jsonb,
  ip text null,
  user_agent text null,
  created_at timestamptz not null default now()
);

create index if not exists idx_quotes_org on public.quotes (org_id);
create index if not exists idx_quotes_org_client on public.quotes (org_id, client_id);
create index if not exists idx_quotes_org_created on public.quotes (org_id, created_at desc);

create index if not exists idx_invoices_org on public.invoices (org_id);
create index if not exists idx_invoices_org_status on public.invoices (org_id, status);
create index if not exists idx_invoices_org_client on public.invoices (org_id, client_id);

create index if not exists idx_payments_org_invoice on public.payments (org_id, invoice_id);

create index if not exists idx_audit_logs_org_created on public.audit_logs (org_id, created_at desc);
create index if not exists idx_audit_logs_org_action on public.audit_logs (org_id, action);

grant select, insert, update, delete on public.quotes to authenticated;
grant select, insert, update, delete on public.invoices to authenticated;
grant select, insert, update, delete on public.payments to authenticated;
grant select, insert on public.audit_logs to authenticated;

alter table public.quotes enable row level security;
alter table public.invoices enable row level security;
alter table public.payments enable row level security;
alter table public.audit_logs enable row level security;

-- quotes policies
drop policy if exists quotes_select_member on public.quotes;
drop policy if exists quotes_insert_member on public.quotes;
drop policy if exists quotes_update_owner_or_creator on public.quotes;
drop policy if exists quotes_delete_owner on public.quotes;

create policy quotes_select_member
on public.quotes
for select
to authenticated
using (
  public.is_org_member(org_id)
);

create policy quotes_insert_member
on public.quotes
for insert
to authenticated
with check (
  created_by = auth.uid()
  and public.is_org_member(org_id)
  and exists (
    select 1
    from public.clients c
    where c.id = quotes.client_id
      and c.org_id = quotes.org_id
  )
  and (
    matter_id is null
    or exists (
      select 1
      from public.matters mt
      where mt.id = quotes.matter_id
        and mt.org_id = quotes.org_id
    )
  )
);

create policy quotes_update_owner_or_creator
on public.quotes
for update
to authenticated
using (
  public.is_org_member(org_id)
  and (
    public.is_org_owner(org_id)
    or created_by = auth.uid()
  )
)
with check (
  public.is_org_member(org_id)
  and exists (
    select 1
    from public.clients c
    where c.id = quotes.client_id
      and c.org_id = quotes.org_id
  )
  and (
    matter_id is null
    or exists (
      select 1
      from public.matters mt
      where mt.id = quotes.matter_id
        and mt.org_id = quotes.org_id
    )
  )
);

create policy quotes_delete_owner
on public.quotes
for delete
to authenticated
using (
  public.is_org_owner(org_id)
);

-- invoices policies
drop policy if exists invoices_select_member on public.invoices;
drop policy if exists invoices_insert_member on public.invoices;
drop policy if exists invoices_update_owner_or_creator on public.invoices;
drop policy if exists invoices_delete_owner on public.invoices;

create policy invoices_select_member
on public.invoices
for select
to authenticated
using (
  public.is_org_member(org_id)
);

create policy invoices_insert_member
on public.invoices
for insert
to authenticated
with check (
  created_by = auth.uid()
  and public.is_org_member(org_id)
  and exists (
    select 1
    from public.clients c
    where c.id = invoices.client_id
      and c.org_id = invoices.org_id
  )
  and (
    matter_id is null
    or exists (
      select 1
      from public.matters mt
      where mt.id = invoices.matter_id
        and mt.org_id = invoices.org_id
    )
  )
);

create policy invoices_update_owner_or_creator
on public.invoices
for update
to authenticated
using (
  public.is_org_member(org_id)
  and (
    public.is_org_owner(org_id)
    or created_by = auth.uid()
  )
)
with check (
  public.is_org_member(org_id)
  and exists (
    select 1
    from public.clients c
    where c.id = invoices.client_id
      and c.org_id = invoices.org_id
  )
  and (
    matter_id is null
    or exists (
      select 1
      from public.matters mt
      where mt.id = invoices.matter_id
        and mt.org_id = invoices.org_id
    )
  )
);

create policy invoices_delete_owner
on public.invoices
for delete
to authenticated
using (
  public.is_org_owner(org_id)
);

-- payments policies
drop policy if exists payments_select_member on public.payments;
drop policy if exists payments_insert_member on public.payments;
drop policy if exists payments_update_owner_or_creator on public.payments;
drop policy if exists payments_delete_owner on public.payments;

create policy payments_select_member
on public.payments
for select
to authenticated
using (
  public.is_org_member(org_id)
);

create policy payments_insert_member
on public.payments
for insert
to authenticated
with check (
  created_by = auth.uid()
  and public.is_org_member(org_id)
  and exists (
    select 1
    from public.invoices inv
    where inv.id = payments.invoice_id
      and inv.org_id = payments.org_id
  )
);

create policy payments_update_owner_or_creator
on public.payments
for update
to authenticated
using (
  public.is_org_member(org_id)
  and (
    public.is_org_owner(org_id)
    or created_by = auth.uid()
  )
)
with check (
  and public.is_org_member(org_id)
  and exists (
    select 1
    from public.invoices inv
    where inv.id = payments.invoice_id
      and inv.org_id = payments.org_id
  )
);

create policy payments_delete_owner
on public.payments
for delete
to authenticated
using (
  public.is_org_owner(org_id)
);

-- audit logs policies
drop policy if exists audit_logs_select_owner on public.audit_logs;
drop policy if exists audit_logs_insert_member on public.audit_logs;

create policy audit_logs_select_owner
on public.audit_logs
for select
to authenticated
using (
  public.is_org_owner(org_id)
);

create policy audit_logs_insert_member
on public.audit_logs
for insert
to authenticated
with check (
  public.is_org_member(org_id)
  and (user_id is null or user_id = auth.uid())
);
