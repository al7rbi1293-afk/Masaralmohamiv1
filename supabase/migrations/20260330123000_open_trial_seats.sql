-- Make trial plans use open seats.

insert into public.plans (code, name_ar, price_monthly, currency, features, seat_limit)
values ('TRIAL', 'تجربة', null, 'SAR', '{}'::jsonb, null)
on conflict (code) do update
set
  name_ar = excluded.name_ar,
  price_monthly = excluded.price_monthly,
  currency = excluded.currency,
  features = excluded.features,
  seat_limit = excluded.seat_limit;
