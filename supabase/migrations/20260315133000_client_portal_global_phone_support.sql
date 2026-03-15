-- Expand client portal phone normalization from Saudi-only to global E.164.
-- Keeps backward compatibility for existing local Saudi numbers.

create or replace function public.normalize_phone_e164(raw_input text)
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
  normalized := btrim(normalized);

  if normalized = '' then
    return null;
  end if;

  normalized := regexp_replace(normalized, '[^0-9+]', '', 'g');
  normalized := regexp_replace(normalized, '(?!^)\+', '', 'g');

  if left(normalized, 2) = '00' then
    normalized := '+' || substr(normalized, 3);
  end if;

  if left(normalized, 1) = '+' then
    digits := regexp_replace(substr(normalized, 2), '\D', '', 'g');
    if length(digits) between 8 and 15 and digits !~ '^0+$' then
      return '+' || digits;
    end if;
    return null;
  end if;

  -- Backward compatibility: local Saudi numbers without country code.
  digits := regexp_replace(normalized, '\D', '', 'g');
  digits := regexp_replace(digits, '^0+', '');
  if digits ~ '^5[0-9]{8}$' then
    return '+966' || digits;
  end if;

  return null;
end;
$$;

create or replace function public.sync_client_portal_user_from_client()
returns trigger
language plpgsql
as $$
declare
  normalized_phone text;
begin
  normalized_phone := public.normalize_phone_e164(new.phone);

  if new.status = 'active' and normalized_phone is not null then
    begin
      insert into public.client_portal_users (org_id, client_id, phone_e164, delivery_preference, status)
      values (new.org_id, new.id, normalized_phone, 'sms', 'active')
      on conflict (org_id, client_id)
      do update set
        phone_e164 = excluded.phone_e164,
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

-- Re-sync all clients through the new global normalization logic.
do $$
declare
  client_row record;
  normalized_phone text;
begin
  for client_row in
    select c.id, c.org_id, c.phone, c.status
    from public.clients c
  loop
    normalized_phone := public.normalize_phone_e164(client_row.phone);

    if client_row.status = 'active' and normalized_phone is not null then
      begin
        insert into public.client_portal_users (org_id, client_id, phone_e164, delivery_preference, status)
        values (client_row.org_id, client_row.id, normalized_phone, 'sms', 'active')
        on conflict (org_id, client_id)
        do update set
          phone_e164 = excluded.phone_e164,
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
      set status = 'disabled', updated_at = now()
      where org_id = client_row.org_id
        and client_id = client_row.id;
    end if;
  end loop;
end;
$$;

