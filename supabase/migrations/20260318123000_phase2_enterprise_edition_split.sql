-- Phase 2 foundation: normalize legacy plan codes so standard plans stay isolated
-- from enterprise/company-only integrations such as Najiz.

UPDATE public.subscriptions
SET plan_code = CASE UPPER(plan_code)
  WHEN 'TEAM' THEN 'SMALL_OFFICE'
  WHEN 'BUSINESS' THEN 'MEDIUM_OFFICE'
  WHEN 'MEDIUM' THEN 'MEDIUM_OFFICE'
  WHEN 'PRO' THEN 'ENTERPRISE'
  ELSE plan_code
END
WHERE UPPER(plan_code) IN ('TEAM', 'BUSINESS', 'MEDIUM', 'PRO');

UPDATE public.org_subscriptions
SET plan = CASE UPPER(plan)
  WHEN 'TEAM' THEN 'SMALL_OFFICE'
  WHEN 'BUSINESS' THEN 'MEDIUM_OFFICE'
  WHEN 'MEDIUM' THEN 'MEDIUM_OFFICE'
  WHEN 'PRO' THEN 'ENTERPRISE'
  ELSE plan
END
WHERE plan IS NOT NULL
  AND UPPER(plan) IN ('TEAM', 'BUSINESS', 'MEDIUM', 'PRO');

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'payment_requests'
  ) THEN
    UPDATE public.payment_requests
    SET plan_code = CASE UPPER(plan_code)
      WHEN 'TEAM' THEN 'SMALL_OFFICE'
      WHEN 'BUSINESS' THEN 'MEDIUM_OFFICE'
      WHEN 'MEDIUM' THEN 'MEDIUM_OFFICE'
      WHEN 'PRO' THEN 'ENTERPRISE'
      ELSE plan_code
    END
    WHERE UPPER(plan_code) IN ('TEAM', 'BUSINESS', 'MEDIUM', 'PRO');
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'subscription_requests'
  ) THEN
    UPDATE public.subscription_requests
    SET plan_requested = CASE UPPER(plan_requested)
      WHEN 'TEAM' THEN 'SMALL_OFFICE'
      WHEN 'BUSINESS' THEN 'MEDIUM_OFFICE'
      WHEN 'MEDIUM' THEN 'MEDIUM_OFFICE'
      WHEN 'PRO' THEN 'ENTERPRISE'
      ELSE plan_requested
    END
    WHERE UPPER(plan_requested) IN ('TEAM', 'BUSINESS', 'MEDIUM', 'PRO');
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'tap_payments'
  ) THEN
    UPDATE public.tap_payments
    SET plan_id = CASE UPPER(plan_id)
      WHEN 'TEAM' THEN 'SMALL_OFFICE'
      WHEN 'BUSINESS' THEN 'MEDIUM_OFFICE'
      WHEN 'MEDIUM' THEN 'MEDIUM_OFFICE'
      WHEN 'PRO' THEN 'ENTERPRISE'
      ELSE plan_id
    END
    WHERE plan_id IS NOT NULL
      AND UPPER(plan_id) IN ('TEAM', 'BUSINESS', 'MEDIUM', 'PRO');
  END IF;
END $$;
