-- ==========================================================
-- Success Partners + Tap Payments Foundation
-- Date: 2026-03-12
-- ==========================================================

create extension if not exists pgcrypto;

-- Ensure updated_at helper exists.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ----------------------------------------------------------
-- Plans compatibility for existing pricing cards
-- ----------------------------------------------------------
insert into public.plans (code, name_ar, price_monthly, currency, features, seat_limit)
values
  ('SMALL_OFFICE', 'مكتب صغير (1-5)', 500, 'SAR', '{}'::jsonb, 5),
  ('MEDIUM_OFFICE', 'مكتب متوسط (6-25)', 750, 'SAR', '{}'::jsonb, 25),
  ('ENTERPRISE', 'مكتب كبير أو شركة محاماة', null, 'SAR', '{}'::jsonb, null)
on conflict (code) do update
set
  name_ar = excluded.name_ar,
  price_monthly = excluded.price_monthly,
  seat_limit = excluded.seat_limit;

-- ----------------------------------------------------------
-- A) partner_applications
-- ----------------------------------------------------------
create table if not exists public.partner_applications (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  whatsapp_number text not null,
  email text not null,
  city text not null,
  marketing_experience text not null,
  audience_notes text null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'needs_review')),
  admin_notes text null,
  reviewed_by uuid null references public.app_users(id) on delete set null,
  reviewed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_partner_applications_status_created
  on public.partner_applications (status, created_at desc);
create index if not exists idx_partner_applications_email
  on public.partner_applications (lower(email));

-- ----------------------------------------------------------
-- B) partners
-- ----------------------------------------------------------
create table if not exists public.partners (
  id uuid primary key default gen_random_uuid(),
  application_id uuid null unique references public.partner_applications(id) on delete set null,
  user_id uuid null references public.app_users(id) on delete set null,
  full_name text not null,
  whatsapp_number text not null,
  email text not null,
  partner_code text not null,
  partner_slug text not null,
  referral_link text not null,
  commission_rate_partner numeric(5,2) not null default 5 check (commission_rate_partner >= 0 and commission_rate_partner <= 100),
  commission_rate_marketing numeric(5,2) not null default 5 check (commission_rate_marketing >= 0 and commission_rate_marketing <= 100),
  is_active boolean not null default true,
  approved_by uuid null references public.app_users(id) on delete set null,
  approved_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (partner_code),
  unique (partner_slug),
  unique (referral_link)
);

create index if not exists idx_partners_active on public.partners (is_active);
create index if not exists idx_partners_email on public.partners (lower(email));

-- ----------------------------------------------------------
-- C) partner_clicks
-- ----------------------------------------------------------
create table if not exists public.partner_clicks (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid null references public.partners(id) on delete set null,
  partner_code text not null,
  ref_code text not null,
  session_id text not null,
  landing_page text not null,
  utm_source text null,
  utm_medium text null,
  utm_campaign text null,
  ip_hash text null,
  user_agent text null,
  created_at timestamptz not null default now()
);

create index if not exists idx_partner_clicks_partner_created
  on public.partner_clicks (partner_id, created_at desc);
create index if not exists idx_partner_clicks_ref
  on public.partner_clicks (ref_code, created_at desc);

-- ----------------------------------------------------------
-- D) partner_leads
-- ----------------------------------------------------------
create table if not exists public.partner_leads (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete restrict,
  click_id uuid null references public.partner_clicks(id) on delete set null,
  lead_email text null,
  lead_phone text null,
  user_id uuid null references public.app_users(id) on delete set null,
  signup_source text null,
  status text not null default 'visited' check (status in ('visited', 'signed_up', 'trial_started', 'subscribed', 'cancelled')),
  attributed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_partner_leads_user
  on public.partner_leads (user_id)
  where user_id is not null;

create unique index if not exists uq_partner_leads_click
  on public.partner_leads (click_id)
  where click_id is not null;

create unique index if not exists uq_partner_leads_email
  on public.partner_leads (lower(lead_email))
  where lead_email is not null;

create index if not exists idx_partner_leads_partner_created
  on public.partner_leads (partner_id, created_at desc);
create index if not exists idx_partner_leads_status
  on public.partner_leads (status, created_at desc);

-- ----------------------------------------------------------
-- E) partner_commissions
-- ----------------------------------------------------------
create table if not exists public.partner_commissions (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete restrict,
  customer_user_id uuid null references public.app_users(id) on delete set null,
  lead_id uuid null references public.partner_leads(id) on delete set null,
  subscription_id uuid null references public.subscriptions(id) on delete set null,
  payment_id text not null,
  base_amount numeric(14,2) not null check (base_amount >= 0),
  partner_rate numeric(5,2) not null check (partner_rate >= 0 and partner_rate <= 100),
  partner_amount numeric(14,2) not null check (partner_amount >= 0),
  marketing_rate numeric(5,2) not null check (marketing_rate >= 0 and marketing_rate <= 100),
  marketing_amount numeric(14,2) not null check (marketing_amount >= 0),
  currency text not null default 'SAR',
  status text not null default 'pending' check (status in ('pending', 'approved', 'payable', 'paid', 'reversed')),
  notes text null,
  eligible_at timestamptz null,
  paid_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (payment_id, partner_id)
);

create index if not exists idx_partner_commissions_partner_status
  on public.partner_commissions (partner_id, status, created_at desc);
create index if not exists idx_partner_commissions_payment
  on public.partner_commissions (payment_id);

-- ----------------------------------------------------------
-- F) partner_payouts
-- ----------------------------------------------------------
create table if not exists public.partner_payouts (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete restrict,
  period_start date not null,
  period_end date not null,
  total_amount numeric(14,2) not null check (total_amount >= 0),
  payout_method text null,
  reference_number text null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'paid', 'failed', 'cancelled')),
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (partner_id, period_start, period_end)
);

create index if not exists idx_partner_payouts_partner_status
  on public.partner_payouts (partner_id, status, created_at desc);

-- ----------------------------------------------------------
-- G) partner_audit_logs
-- ----------------------------------------------------------
create table if not exists public.partner_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid null references public.app_users(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id uuid null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_partner_audit_logs_created
  on public.partner_audit_logs (created_at desc);
create index if not exists idx_partner_audit_logs_target
  on public.partner_audit_logs (target_type, target_id, created_at desc);

-- ----------------------------------------------------------
-- Tap payment records + webhooks
-- ----------------------------------------------------------
create table if not exists public.tap_payments (
  id uuid primary key default gen_random_uuid(),
  tap_charge_id text not null unique,
  tap_reference text null,
  user_id uuid not null references public.app_users(id) on delete cascade,
  org_id uuid null references public.organizations(id) on delete set null,
  subscription_id uuid null references public.subscriptions(id) on delete set null,
  plan_id text not null,
  amount numeric(14,2) not null check (amount >= 0),
  currency text not null default 'SAR',
  status text not null check (status in ('initiated', 'pending', 'captured', 'failed', 'cancelled', 'refunded', 'authorized')),
  gateway_response jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  is_recurring boolean not null default false,
  tap_customer_id text null,
  tap_card_id text null,
  tap_agreement_id text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  captured_at timestamptz null,
  refunded_at timestamptz null
);

create index if not exists idx_tap_payments_user_created
  on public.tap_payments (user_id, created_at desc);
create index if not exists idx_tap_payments_org_status
  on public.tap_payments (org_id, status, created_at desc);
create index if not exists idx_tap_payments_subscription
  on public.tap_payments (subscription_id, created_at desc);

create table if not exists public.tap_webhook_events (
  id uuid primary key default gen_random_uuid(),
  tap_event_id text null,
  event_type text null,
  charge_id text null,
  signature text null,
  payload jsonb not null,
  status text not null default 'received' check (status in ('received', 'processed', 'ignored', 'failed')),
  processed_at timestamptz null,
  error_message text null,
  created_at timestamptz not null default now(),
  unique (tap_event_id)
);

create index if not exists idx_tap_webhook_events_charge
  on public.tap_webhook_events (charge_id, created_at desc);
create index if not exists idx_tap_webhook_events_status
  on public.tap_webhook_events (status, created_at desc);

alter table public.subscriptions
  add column if not exists tap_customer_id text,
  add column if not exists tap_card_id text,
  add column if not exists tap_agreement_id text,
  add column if not exists last_payment_id text;

-- ----------------------------------------------------------
-- Triggers
-- ----------------------------------------------------------
drop trigger if exists partner_applications_set_updated_at on public.partner_applications;
create trigger partner_applications_set_updated_at
before update on public.partner_applications
for each row execute function public.set_updated_at();

drop trigger if exists partners_set_updated_at on public.partners;
create trigger partners_set_updated_at
before update on public.partners
for each row execute function public.set_updated_at();

drop trigger if exists partner_leads_set_updated_at on public.partner_leads;
create trigger partner_leads_set_updated_at
before update on public.partner_leads
for each row execute function public.set_updated_at();

drop trigger if exists partner_commissions_set_updated_at on public.partner_commissions;
create trigger partner_commissions_set_updated_at
before update on public.partner_commissions
for each row execute function public.set_updated_at();

drop trigger if exists partner_payouts_set_updated_at on public.partner_payouts;
create trigger partner_payouts_set_updated_at
before update on public.partner_payouts
for each row execute function public.set_updated_at();

drop trigger if exists tap_payments_set_updated_at on public.tap_payments;
create trigger tap_payments_set_updated_at
before update on public.tap_payments
for each row execute function public.set_updated_at();

-- ----------------------------------------------------------
-- Grants
-- ----------------------------------------------------------
grant insert on public.partner_applications to anon, authenticated;
grant select, update on public.partner_applications to authenticated;

grant select, insert, update, delete on public.partners to authenticated;
grant select, insert, update, delete on public.partner_clicks to authenticated;
grant select, insert, update, delete on public.partner_leads to authenticated;
grant select, insert, update, delete on public.partner_commissions to authenticated;
grant select, insert, update, delete on public.partner_payouts to authenticated;
grant select, insert on public.partner_audit_logs to authenticated;

grant select, insert, update on public.tap_payments to authenticated;
grant select, insert, update on public.tap_webhook_events to authenticated;

-- ----------------------------------------------------------
-- RLS
-- ----------------------------------------------------------
alter table public.partner_applications enable row level security;
alter table public.partners enable row level security;
alter table public.partner_clicks enable row level security;
alter table public.partner_leads enable row level security;
alter table public.partner_commissions enable row level security;
alter table public.partner_payouts enable row level security;
alter table public.partner_audit_logs enable row level security;
alter table public.tap_payments enable row level security;
alter table public.tap_webhook_events enable row level security;

-- Public can submit application only.
drop policy if exists partner_applications_insert_public on public.partner_applications;
create policy partner_applications_insert_public
on public.partner_applications
for insert
to anon, authenticated
with check (
  status = 'pending'
  and reviewed_by is null
  and reviewed_at is null
);

drop policy if exists partner_applications_select_admin on public.partner_applications;
create policy partner_applications_select_admin
on public.partner_applications
for select
to authenticated
using (public.is_app_admin());

drop policy if exists partner_applications_update_admin on public.partner_applications;
create policy partner_applications_update_admin
on public.partner_applications
for update
to authenticated
using (public.is_app_admin())
with check (public.is_app_admin());

-- Admin-only access for sensitive partner tables.
drop policy if exists partners_select_admin on public.partners;
create policy partners_select_admin
on public.partners
for select
to authenticated
using (public.is_app_admin() or user_id = auth.uid());

drop policy if exists partners_insert_admin on public.partners;
create policy partners_insert_admin
on public.partners
for insert
to authenticated
with check (public.is_app_admin());

drop policy if exists partners_update_admin on public.partners;
create policy partners_update_admin
on public.partners
for update
to authenticated
using (public.is_app_admin())
with check (public.is_app_admin());

drop policy if exists partner_clicks_select_admin on public.partner_clicks;
create policy partner_clicks_select_admin
on public.partner_clicks
for select
to authenticated
using (
  public.is_app_admin()
  or exists (
    select 1
    from public.partners p
    where p.id = partner_clicks.partner_id
      and p.user_id = auth.uid()
  )
);

drop policy if exists partner_clicks_insert_admin on public.partner_clicks;
create policy partner_clicks_insert_admin
on public.partner_clicks
for insert
to authenticated
with check (public.is_app_admin());

drop policy if exists partner_leads_select_admin on public.partner_leads;
create policy partner_leads_select_admin
on public.partner_leads
for select
to authenticated
using (
  public.is_app_admin()
  or exists (
    select 1
    from public.partners p
    where p.id = partner_leads.partner_id
      and p.user_id = auth.uid()
  )
);

drop policy if exists partner_leads_insert_admin on public.partner_leads;
create policy partner_leads_insert_admin
on public.partner_leads
for insert
to authenticated
with check (public.is_app_admin());

drop policy if exists partner_leads_update_admin on public.partner_leads;
create policy partner_leads_update_admin
on public.partner_leads
for update
to authenticated
using (public.is_app_admin())
with check (public.is_app_admin());

drop policy if exists partner_commissions_select_admin on public.partner_commissions;
create policy partner_commissions_select_admin
on public.partner_commissions
for select
to authenticated
using (
  public.is_app_admin()
  or exists (
    select 1
    from public.partners p
    where p.id = partner_commissions.partner_id
      and p.user_id = auth.uid()
  )
);

drop policy if exists partner_commissions_insert_admin on public.partner_commissions;
create policy partner_commissions_insert_admin
on public.partner_commissions
for insert
to authenticated
with check (public.is_app_admin());

drop policy if exists partner_commissions_update_admin on public.partner_commissions;
create policy partner_commissions_update_admin
on public.partner_commissions
for update
to authenticated
using (public.is_app_admin())
with check (public.is_app_admin());

drop policy if exists partner_payouts_select_admin on public.partner_payouts;
create policy partner_payouts_select_admin
on public.partner_payouts
for select
to authenticated
using (
  public.is_app_admin()
  or exists (
    select 1
    from public.partners p
    where p.id = partner_payouts.partner_id
      and p.user_id = auth.uid()
  )
);

drop policy if exists partner_payouts_insert_admin on public.partner_payouts;
create policy partner_payouts_insert_admin
on public.partner_payouts
for insert
to authenticated
with check (public.is_app_admin());

drop policy if exists partner_payouts_update_admin on public.partner_payouts;
create policy partner_payouts_update_admin
on public.partner_payouts
for update
to authenticated
using (public.is_app_admin())
with check (public.is_app_admin());

drop policy if exists partner_audit_logs_select_admin on public.partner_audit_logs;
create policy partner_audit_logs_select_admin
on public.partner_audit_logs
for select
to authenticated
using (public.is_app_admin());

drop policy if exists partner_audit_logs_insert_admin on public.partner_audit_logs;
create policy partner_audit_logs_insert_admin
on public.partner_audit_logs
for insert
to authenticated
with check (public.is_app_admin());

drop policy if exists tap_payments_select_admin on public.tap_payments;
create policy tap_payments_select_admin
on public.tap_payments
for select
to authenticated
using (public.is_app_admin());

drop policy if exists tap_payments_insert_admin on public.tap_payments;
create policy tap_payments_insert_admin
on public.tap_payments
for insert
to authenticated
with check (public.is_app_admin());

drop policy if exists tap_payments_update_admin on public.tap_payments;
create policy tap_payments_update_admin
on public.tap_payments
for update
to authenticated
using (public.is_app_admin())
with check (public.is_app_admin());

drop policy if exists tap_webhook_events_select_admin on public.tap_webhook_events;
create policy tap_webhook_events_select_admin
on public.tap_webhook_events
for select
to authenticated
using (public.is_app_admin());

drop policy if exists tap_webhook_events_insert_admin on public.tap_webhook_events;
create policy tap_webhook_events_insert_admin
on public.tap_webhook_events
for insert
to authenticated
with check (public.is_app_admin());

drop policy if exists tap_webhook_events_update_admin on public.tap_webhook_events;
create policy tap_webhook_events_update_admin
on public.tap_webhook_events
for update
to authenticated
using (public.is_app_admin())
with check (public.is_app_admin());
