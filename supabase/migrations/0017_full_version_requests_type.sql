-- Phase 9.2.1: Data retention / org deletion request metadata
--
-- Add a lightweight request "type" to full_version_requests so we can track:
-- - activation_request (existing behavior)
-- - delete_request (owner-only workflow, manual processing)
--
-- Also expands allowed sources to include "subscription" (used by /api/contact-request).

alter table public.full_version_requests
  add column if not exists type text;

update public.full_version_requests
set type = 'activation_request'
where type is null;

alter table public.full_version_requests
  alter column type set default 'activation_request';

alter table public.full_version_requests
  alter column type set not null;

alter table public.full_version_requests
  drop constraint if exists full_version_requests_type_check;

alter table public.full_version_requests
  add constraint full_version_requests_type_check
  check (type in ('activation_request', 'delete_request'));

alter table public.full_version_requests
  drop constraint if exists full_version_requests_source_check;

alter table public.full_version_requests
  add constraint full_version_requests_source_check
  check (source in ('app', 'landing', 'contact', 'subscription'));

