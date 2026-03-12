-- Restore manual bank-transfer requests table for current auth model (app_users).

do $$
begin
  create type public.payment_method_type as enum ('bank_transfer', 'credit_card', 'apple_pay', 'mada');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.payment_status_type as enum ('pending', 'approved', 'rejected');
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.payment_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid null references public.app_users(id) on delete set null,
  amount numeric(14,2) not null check (amount > 0),
  currency text not null default 'SAR',
  plan_code text not null,
  billing_period text not null check (billing_period in ('monthly', 'yearly')),
  method public.payment_method_type not null default 'bank_transfer',
  status public.payment_status_type not null default 'pending',
  proof_url text null,
  bank_reference text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reviewed_at timestamptz null,
  reviewed_by uuid null references public.app_users(id) on delete set null,
  review_note text null
);

create index if not exists idx_payment_requests_status_created
  on public.payment_requests (status, created_at desc);
create index if not exists idx_payment_requests_org_created
  on public.payment_requests (org_id, created_at desc);

drop trigger if exists payment_requests_set_updated_at on public.payment_requests;
create trigger payment_requests_set_updated_at
before update on public.payment_requests
for each row execute function public.set_updated_at();

grant select, insert, update on public.payment_requests to authenticated;

alter table public.payment_requests enable row level security;

drop policy if exists payment_requests_select_admin on public.payment_requests;
create policy payment_requests_select_admin
on public.payment_requests
for select
to authenticated
using (public.is_app_admin());

drop policy if exists payment_requests_insert_admin on public.payment_requests;
create policy payment_requests_insert_admin
on public.payment_requests
for insert
to authenticated
with check (public.is_app_admin());

drop policy if exists payment_requests_update_admin on public.payment_requests;
create policy payment_requests_update_admin
on public.payment_requests
for update
to authenticated
using (public.is_app_admin())
with check (public.is_app_admin());
