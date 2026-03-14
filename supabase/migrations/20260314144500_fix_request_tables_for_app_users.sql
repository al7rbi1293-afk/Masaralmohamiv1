-- Align request tables with the app_users-based auth model.
-- This migration is idempotent and safe to run on mixed deployments.

-- --------------------------------------------------------------------
-- full_version_requests: ensure `type` exists and source includes `subscription`
-- --------------------------------------------------------------------
alter table if exists public.full_version_requests
  add column if not exists type text;

update public.full_version_requests
set type = 'activation_request'
where type is null;

alter table if exists public.full_version_requests
  alter column type set default 'activation_request';

alter table if exists public.full_version_requests
  alter column type set not null;

alter table if exists public.full_version_requests
  drop constraint if exists full_version_requests_type_check;

alter table if exists public.full_version_requests
  add constraint full_version_requests_type_check
  check (type in ('activation_request', 'delete_request'));

alter table if exists public.full_version_requests
  drop constraint if exists full_version_requests_source_check;

alter table if exists public.full_version_requests
  add constraint full_version_requests_source_check
  check (source in ('app', 'landing', 'contact', 'subscription'));

alter table if exists public.full_version_requests
  drop constraint if exists full_version_requests_user_id_fkey;

alter table if exists public.full_version_requests
  add constraint full_version_requests_user_id_fkey
  foreign key (user_id) references public.app_users(id) on delete set null;

-- --------------------------------------------------------------------
-- subscription_requests: reference app_users instead of auth.users
-- --------------------------------------------------------------------
alter table if exists public.subscription_requests
  drop constraint if exists subscription_requests_requester_user_id_fkey;

alter table if exists public.subscription_requests
  add constraint subscription_requests_requester_user_id_fkey
  foreign key (requester_user_id) references public.app_users(id);

alter table if exists public.subscription_requests
  drop constraint if exists subscription_requests_decided_by_fkey;

alter table if exists public.subscription_requests
  add constraint subscription_requests_decided_by_fkey
  foreign key (decided_by) references public.app_users(id);

-- --------------------------------------------------------------------
-- payment_requests: reference app_users instead of auth.users
-- --------------------------------------------------------------------
alter table if exists public.payment_requests
  drop constraint if exists payment_requests_user_id_fkey;

alter table if exists public.payment_requests
  add constraint payment_requests_user_id_fkey
  foreign key (user_id) references public.app_users(id) on delete set null;

alter table if exists public.payment_requests
  drop constraint if exists payment_requests_reviewed_by_fkey;

alter table if exists public.payment_requests
  add constraint payment_requests_reviewed_by_fkey
  foreign key (reviewed_by) references public.app_users(id) on delete set null;
