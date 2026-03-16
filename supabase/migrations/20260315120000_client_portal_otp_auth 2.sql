create extension if not exists pgcrypto;

-- Normalize Saudi mobile numbers to E.164 (+9665XXXXXXXX).
create or replace function public.normalize_saudi_phone_e164(raw_input text)
returns text
language plpgsql
immutable
as $$
declare
  normalized text;
  digits text;
begin
  normalized := coalesce(raw_input, '');
  normalized := translate(
    normalized,
    '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹',
    '01234567890123456789'
  );
  digits := regexp_replace(normalized, '\D', '', 'g');

  if digits = '' then
    return null;
  end if;

  if left(digits, 5) = '00966' then
    digits := substr(digits, 6);
  elsif left(digits, 3) = '966' then
    digits := substr(digits, 4);
  end if;

  digits := regexp_replace(digits, '^0+', '');

  if digits !~ '^5[0-9]{8}$' then
    return null;
  end if;

  return '+966' || digits;
end;
$$;

create table if not exists public.client_portal_users (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  phone_e164 text not null,
  delivery_preference text not null default 'sms' check (delivery_preference in ('sms', 'whatsapp')),
  status text not null default 'active' check (status in ('active', 'disabled')),
  last_login_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, client_id),
  unique (phone_e164)
);

create index if not exists idx_client_portal_users_org on public.client_portal_users (org_id);
create index if not exists idx_client_portal_users_client on public.client_portal_users (client_id);
create index if not exists idx_client_portal_users_status on public.client_portal_users (status);

drop trigger if exists client_portal_users_set_updated_at on public.client_portal_users;
create trigger client_portal_users_set_updated_at
before update on public.client_portal_users
for each row
execute function public.set_updated_at();

create table if not exists public.client_portal_otp_codes (
  id uuid primary key default gen_random_uuid(),
  client_portal_user_id uuid not null references public.client_portal_users(id) on delete cascade,
  code_hash text not null,
  channel text not null check (channel in ('sms', 'whatsapp')),
  delivery_provider text null,
  provider_message_id text null,
  delivery_status text not null default 'sent' check (delivery_status in ('sent', 'failed')),
  failure_reason text null,
  request_ip text null,
  user_agent text null,
  attempts int not null default 0 check (attempts >= 0),
  max_attempts int not null default 5 check (max_attempts between 1 and 10),
  expires_at timestamptz not null,
  consumed_at timestamptz null,
  created_at timestamptz not null default now()
);

create index if not exists idx_client_portal_otp_user_created
  on public.client_portal_otp_codes (client_portal_user_id, created_at desc);
create index if not exists idx_client_portal_otp_expires
  on public.client_portal_otp_codes (expires_at);
create index if not exists idx_client_portal_otp_consumed
  on public.client_portal_otp_codes (consumed_at);

alter table public.client_portal_users enable row level security;
alter table public.client_portal_otp_codes enable row level security;

drop policy if exists client_portal_users_service_all on public.client_portal_users;
drop policy if exists client_portal_otp_codes_service_all on public.client_portal_otp_codes;

create policy client_portal_users_service_all
on public.client_portal_users
for all
to service_role
using (true)
with check (true);

create policy client_portal_otp_codes_service_all
on public.client_portal_otp_codes
for all
to service_role
using (true)
with check (true);

-- Bootstrap: auto-create portal access records for active clients with valid Saudi mobile numbers.
insert into public.client_portal_users (org_id, client_id, phone_e164, delivery_preference, status)
select
  c.org_id,
  c.id,
  public.normalize_saudi_phone_e164(c.phone) as phone_e164,
  'sms',
  'active'
from public.clients c
where c.status = 'active'
  and public.normalize_saudi_phone_e164(c.phone) is not null
on conflict (phone_e164) do nothing;
