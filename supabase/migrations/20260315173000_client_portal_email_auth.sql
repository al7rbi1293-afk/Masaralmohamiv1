-- Client portal auth switch: email-only OTP login.
-- Keep phone as optional metadata only.

alter table public.client_portal_users
  add column if not exists email text null;

alter table public.client_portal_users
  alter column phone_e164 drop not null;

alter table public.client_portal_users
  alter column delivery_preference set default 'email';

create or replace function public.normalize_client_email(raw_input text)
returns text
language plpgsql
immutable
as $$
declare
  normalized text;
begin
  normalized := lower(btrim(coalesce(raw_input, '')));
  if normalized = '' then
    return null;
  end if;

  if normalized !~ '^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$' then
    return null;
  end if;

  return normalized;
end;
$$;

update public.client_portal_users cpu
set email = public.normalize_client_email(c.email),
    updated_at = now()
from public.clients c
where c.id = cpu.client_id
  and c.org_id = cpu.org_id;

-- Keep one active portal account per normalized email.
with ranked as (
  select
    id,
    row_number() over (
      partition by lower(email)
      order by updated_at desc nulls last, created_at desc nulls last, id desc
    ) as rn
  from public.client_portal_users
  where email is not null
    and status = 'active'
)
update public.client_portal_users u
set status = 'disabled',
    updated_at = now()
from ranked r
where u.id = r.id
  and r.rn > 1;

create unique index if not exists uq_client_portal_users_active_email
  on public.client_portal_users (lower(email))
  where status = 'active' and email is not null;

create index if not exists idx_client_portal_users_email_status
  on public.client_portal_users (email, status);

create or replace function public.sync_client_portal_user_from_client()
returns trigger
language plpgsql
as $$
declare
  normalized_phone text;
  normalized_email text;
begin
  normalized_phone := public.normalize_phone_e164(new.phone);
  normalized_email := public.normalize_client_email(new.email);

  if new.status = 'active' and normalized_email is not null then
    begin
      insert into public.client_portal_users (org_id, client_id, phone_e164, email, delivery_preference, status)
      values (new.org_id, new.id, normalized_phone, normalized_email, 'email', 'active')
      on conflict (org_id, client_id)
      do update set
        phone_e164 = excluded.phone_e164,
        email = excluded.email,
        delivery_preference = 'email',
        status = 'active',
        updated_at = now();
    exception
      when unique_violation then
        update public.client_portal_users
        set status = 'disabled', updated_at = now()
        where org_id = new.org_id
          and client_id = new.id;
    end;
  else
    update public.client_portal_users
    set status = 'disabled', updated_at = now()
    where org_id = new.org_id
      and client_id = new.id;
  end if;

  return new;
end;
$$;

-- Re-sync all clients with email-first portal auth policy.
do $$
declare
  client_row record;
  normalized_phone text;
  normalized_email text;
begin
  for client_row in
    select c.id, c.org_id, c.phone, c.email, c.status
    from public.clients c
  loop
    normalized_phone := public.normalize_phone_e164(client_row.phone);
    normalized_email := public.normalize_client_email(client_row.email);

    if client_row.status = 'active' and normalized_email is not null then
      begin
        insert into public.client_portal_users (org_id, client_id, phone_e164, email, delivery_preference, status)
        values (client_row.org_id, client_row.id, normalized_phone, normalized_email, 'email', 'active')
        on conflict (org_id, client_id)
        do update set
          phone_e164 = excluded.phone_e164,
          email = excluded.email,
          delivery_preference = 'email',
          status = 'active',
          updated_at = now();
      exception
        when unique_violation then
          update public.client_portal_users
          set status = 'disabled', updated_at = now()
          where org_id = client_row.org_id
            and client_id = client_row.id;
      end;
    else
      update public.client_portal_users
      set status = 'disabled',
          email = normalized_email,
          phone_e164 = normalized_phone,
          updated_at = now()
      where org_id = client_row.org_id
        and client_id = client_row.id;
    end if;
  end loop;
end;
$$;

update public.client_portal_users
set delivery_preference = 'email',
    updated_at = now()
where delivery_preference <> 'email';
