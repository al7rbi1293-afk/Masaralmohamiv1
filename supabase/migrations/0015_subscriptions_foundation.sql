-- Phase 8.0: Subscription foundations (plans + subscriptions + subscription_events)

create extension if not exists pgcrypto;

-- Plans are read-only for clients; managed by service role/admin only.
create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name_ar text not null,
  price_monthly numeric(14,2) null,
  currency text not null default 'SAR',
  features jsonb not null default '{}'::jsonb,
  seat_limit int null,
  created_at timestamptz not null default now()
);

-- Seed minimal plans for MVP (can be adjusted later).
insert into public.plans (code, name_ar, price_monthly, currency, features, seat_limit)
values
  ('SOLO', 'فردي', 199, 'SAR', '{}'::jsonb, 1),
  ('TEAM', 'فريق', 499, 'SAR', '{}'::jsonb, 5),
  ('PRO', 'احترافي', null, 'SAR', '{}'::jsonb, null)
on conflict (code) do nothing;

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  plan_code text not null references public.plans(code),
  status text not null default 'trial' check (status in ('trial', 'active', 'past_due', 'canceled', 'expired')),
  seats int not null default 1,
  current_period_start timestamptz null,
  current_period_end timestamptz null,
  cancel_at_period_end boolean not null default false,
  provider text null,
  provider_customer_id text null,
  provider_subscription_id text null,
  created_at timestamptz not null default now(),
  unique (org_id)
);

create table if not exists public.subscription_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  type text not null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_subscription_events_org_created
on public.subscription_events (org_id, created_at desc);

grant select on public.plans to authenticated;
grant select, insert, update, delete on public.subscriptions to authenticated;
grant select, insert on public.subscription_events to authenticated;

alter table public.plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.subscription_events enable row level security;

-- plans policies: read-only for authenticated users
drop policy if exists plans_select_authenticated on public.plans;
create policy plans_select_authenticated
on public.plans
for select
to authenticated
using (true);

-- subscriptions policies
drop policy if exists subscriptions_select_member on public.subscriptions;
drop policy if exists subscriptions_insert_owner on public.subscriptions;
drop policy if exists subscriptions_update_owner on public.subscriptions;
drop policy if exists subscriptions_delete_owner on public.subscriptions;

create policy subscriptions_select_member
on public.subscriptions
for select
to authenticated
using (
  public.is_org_member(org_id)
);

create policy subscriptions_insert_owner
on public.subscriptions
for insert
to authenticated
with check (
  public.is_org_owner(org_id)
);

create policy subscriptions_update_owner
on public.subscriptions
for update
to authenticated
using (
  public.is_org_owner(org_id)
)
with check (
  public.is_org_owner(org_id)
);

create policy subscriptions_delete_owner
on public.subscriptions
for delete
to authenticated
using (
  public.is_org_owner(org_id)
);

-- subscription_events policies
drop policy if exists subscription_events_select_owner on public.subscription_events;
drop policy if exists subscription_events_insert_owner on public.subscription_events;

create policy subscription_events_select_owner
on public.subscription_events
for select
to authenticated
using (
  public.is_org_owner(org_id)
);

create policy subscription_events_insert_owner
on public.subscription_events
for insert
to authenticated
with check (
  public.is_org_owner(org_id)
);

