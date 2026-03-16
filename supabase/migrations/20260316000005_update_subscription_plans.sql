-- Update Subscription Plans Data
-- Date: 2026-03-16

UPDATE public.plans
SET
  name_ar = 'المحامي المستقل',
  price_monthly = 250,
  seat_limit = 1
WHERE code = 'SOLO';

UPDATE public.plans
SET
  name_ar = 'مكتب صغير',
  price_monthly = 500,
  seat_limit = 5
WHERE code = 'SMALL_OFFICE';

UPDATE public.plans
SET
  name_ar = 'مكتب متوسط',
  price_monthly = 750,
  seat_limit = 10
WHERE code = 'MEDIUM_OFFICE';

UPDATE public.plans
SET
  name_ar = 'مكتب كبير أو شركات',
  price_monthly = NULL,
  seat_limit = 30
WHERE code = 'ENTERPRISE';
