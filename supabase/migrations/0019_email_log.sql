create extension if not exists pgcrypto;

create table if not exists public.email_logs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  sent_by uuid not null references auth.users(id),
  to_email text not null,
  subject text not null,
  template text not null check (template in ('doc_share', 'invoice', 'task_reminder')),
  meta jsonb not null default '{}'::jsonb,
  status text not null default 'sent' check (status in ('sent', 'failed')),
  error text null,
  created_at timestamptz not null default now()
);

create index if not exists idx_email_logs_org_created on public.email_logs (org_id, created_at desc);
create index if not exists idx_email_logs_org_template on public.email_logs (org_id, template);

grant select, insert on public.email_logs to authenticated;

alter table public.email_logs enable row level security;

drop policy if exists email_logs_select_owner on public.email_logs;
drop policy if exists email_logs_insert_member on public.email_logs;

create policy email_logs_select_owner
on public.email_logs
for select
to authenticated
using (
  public.is_org_owner(org_id)
);

create policy email_logs_insert_member
on public.email_logs
for insert
to authenticated
with check (
  sent_by = auth.uid()
  and public.is_org_member(org_id)
);

