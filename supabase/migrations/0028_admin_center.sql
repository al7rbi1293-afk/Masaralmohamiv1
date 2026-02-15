-- ============================================================
-- 0028: Admin Control Center
-- app_admins, subscription_requests, org_subscriptions,
-- profiles.status, organizations.status, admin RLS policies
-- ============================================================
-- =========================
-- app_admins
-- =========================
create table if not exists public.app_admins (
    user_id uuid primary key references auth.users(id) on delete cascade,
    created_at timestamptz not null default now()
);
alter table public.app_admins enable row level security;
grant select on public.app_admins to authenticated;
-- Any authenticated user can check if they are an admin (needed by middleware/guard)
drop policy if exists app_admins_select_self on public.app_admins;
create policy app_admins_select_self on public.app_admins for
select to authenticated using (user_id = auth.uid());
-- Helper function: is current user an app admin?
create or replace function public.is_app_admin() returns boolean language sql stable security definer
set search_path = public as $$
select exists (
        select 1
        from public.app_admins
        where user_id = auth.uid()
    );
$$;
-- =========================
-- subscription_requests
-- =========================
create table if not exists public.subscription_requests (
    id uuid primary key default gen_random_uuid(),
    org_id uuid not null references public.organizations(id) on delete cascade,
    requester_user_id uuid not null references auth.users(id),
    plan_requested text not null,
    duration_months integer not null default 1,
    payment_method text,
    payment_reference text,
    proof_file_path text,
    status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
    notes text,
    requested_at timestamptz not null default now(),
    decided_at timestamptz,
    decided_by uuid references auth.users(id)
);
create index if not exists idx_subscription_requests_org on public.subscription_requests (org_id);
create index if not exists idx_subscription_requests_status on public.subscription_requests (status);
grant select,
    insert,
    update on public.subscription_requests to authenticated;
alter table public.subscription_requests enable row level security;
-- Org members can INSERT requests for their org
drop policy if exists sub_requests_insert_member on public.subscription_requests;
create policy sub_requests_insert_member on public.subscription_requests for
insert to authenticated with check (
        requester_user_id = auth.uid()
        and exists (
            select 1
            from public.memberships m
            where m.org_id = subscription_requests.org_id
                and m.user_id = auth.uid()
        )
    );
-- Org members can SELECT their org's requests
drop policy if exists sub_requests_select_member on public.subscription_requests;
create policy sub_requests_select_member on public.subscription_requests for
select to authenticated using (
        exists (
            select 1
            from public.memberships m
            where m.org_id = subscription_requests.org_id
                and m.user_id = auth.uid()
        )
        or public.is_app_admin()
    );
-- Only admins can UPDATE (approve/reject)
drop policy if exists sub_requests_update_admin on public.subscription_requests;
create policy sub_requests_update_admin on public.subscription_requests for
update to authenticated using (public.is_app_admin()) with check (public.is_app_admin());
-- =========================
-- org_subscriptions
-- =========================
create table if not exists public.org_subscriptions (
    id uuid primary key default gen_random_uuid(),
    org_id uuid not null references public.organizations(id) on delete cascade,
    status text not null default 'trial' check (
        status in ('trial', 'active', 'expired', 'cancelled')
    ),
    plan text,
    payment_status text default 'unpaid' check (payment_status in ('unpaid', 'paid', 'pending')),
    current_period_start timestamptz,
    current_period_end timestamptz,
    last_payment_ref text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (org_id)
);
create index if not exists idx_org_subscriptions_org on public.org_subscriptions (org_id);
grant select,
    insert,
    update on public.org_subscriptions to authenticated;
alter table public.org_subscriptions enable row level security;
-- Org members can select their own org subscription
drop policy if exists org_subs_select_member on public.org_subscriptions;
create policy org_subs_select_member on public.org_subscriptions for
select to authenticated using (
        exists (
            select 1
            from public.memberships m
            where m.org_id = org_subscriptions.org_id
                and m.user_id = auth.uid()
        )
        or public.is_app_admin()
    );
-- Only admins can insert/update
drop policy if exists org_subs_insert_admin on public.org_subscriptions;
create policy org_subs_insert_admin on public.org_subscriptions for
insert to authenticated with check (public.is_app_admin());
drop policy if exists org_subs_update_admin on public.org_subscriptions;
create policy org_subs_update_admin on public.org_subscriptions for
update to authenticated using (public.is_app_admin()) with check (public.is_app_admin());
-- =========================
-- Add status columns
-- =========================
alter table public.profiles
add column if not exists status text not null default 'active';
alter table public.organizations
add column if not exists status text not null default 'active';
-- =========================
-- Admin audit_logs policy (admin can see ALL logs)
-- =========================
drop policy if exists audit_logs_select_admin on public.audit_logs;
create policy audit_logs_select_admin on public.audit_logs for
select to authenticated using (public.is_app_admin());
-- Admin can insert audit logs for any org
drop policy if exists audit_logs_insert_admin on public.audit_logs;
create policy audit_logs_insert_admin on public.audit_logs for
insert to authenticated with check (public.is_app_admin());
-- =========================
-- Admin policies for profiles (admin can select/update all)
-- =========================
drop policy if exists profiles_select_admin on public.profiles;
create policy profiles_select_admin on public.profiles for
select to authenticated using (public.is_app_admin());
drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_update_admin on public.profiles for
update to authenticated using (public.is_app_admin()) with check (public.is_app_admin());
-- =========================
-- Admin policies for organizations (admin can select/update all)
-- =========================
drop policy if exists organizations_select_admin on public.organizations;
create policy organizations_select_admin on public.organizations for
select to authenticated using (public.is_app_admin());
drop policy if exists organizations_update_admin on public.organizations;
create policy organizations_update_admin on public.organizations for
update to authenticated using (public.is_app_admin()) with check (public.is_app_admin());
-- =========================
-- Admin policies for memberships (admin can select all for user/org views)
-- =========================
drop policy if exists memberships_select_admin on public.memberships;
create policy memberships_select_admin on public.memberships for
select to authenticated using (public.is_app_admin());
-- =========================
-- DONE
-- =========================
-- HOW TO SEED AN ADMIN:
-- In Supabase SQL Editor, run:
--   INSERT INTO public.app_admins (user_id) VALUES ('<your-user-uuid>');
-- To find your user_id, check auth.users or profiles table.