-- Normalize trial subscriptions so they consistently use the TRIAL plan.

insert into public.plans (code, name_ar, price_monthly, currency, features, seat_limit)
values ('TRIAL', 'تجربة', null, 'SAR', '{}'::jsonb, 2)
on conflict (code) do update
set
  name_ar = excluded.name_ar,
  price_monthly = excluded.price_monthly,
  currency = excluded.currency,
  features = excluded.features,
  seat_limit = excluded.seat_limit;

update public.subscriptions
set
  plan_code = 'TRIAL',
  seats = 2
where status = 'trial'
  and (
    plan_code is distinct from 'TRIAL'
    or seats is distinct from 2
  );
