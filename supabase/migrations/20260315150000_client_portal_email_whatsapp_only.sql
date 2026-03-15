-- Enable client portal OTP delivery channels: WhatsApp + Email (no SMS for portal login flow).

alter table public.client_portal_users
  drop constraint if exists client_portal_users_delivery_preference_check;

alter table public.client_portal_users
  add constraint client_portal_users_delivery_preference_check
  check (delivery_preference in ('sms', 'whatsapp', 'email'));

alter table public.client_portal_otp_codes
  drop constraint if exists client_portal_otp_codes_channel_check;

alter table public.client_portal_otp_codes
  add constraint client_portal_otp_codes_channel_check
  check (channel in ('sms', 'whatsapp', 'email'));

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
      values (new.org_id, new.id, normalized_phone, 'whatsapp', 'active')
      on conflict (org_id, client_id)
      do update set
        phone_e164 = excluded.phone_e164,
        delivery_preference = 'whatsapp',
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

update public.client_portal_users
set delivery_preference = 'whatsapp',
    updated_at = now()
where delivery_preference <> 'whatsapp';
