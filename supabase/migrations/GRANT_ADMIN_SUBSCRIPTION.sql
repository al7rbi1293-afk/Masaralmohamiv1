-- ============================================================
-- Grant Unlimited Subscription to Admin (Robust Version)
-- Usage: Run this in Supabase SQL Editor
-- ============================================================
DO $$
DECLARE v_user_id uuid;
v_org_id uuid;
BEGIN -- 1. Get the user ID
SELECT id INTO v_user_id
FROM auth.users
WHERE email = 'Masar.almohami@outlook.sa';
IF v_user_id IS NULL THEN RAISE EXCEPTION 'User Masar.almohami@outlook.sa not found';
END IF;
-- 2. Find an organization owned by this user
SELECT org_id INTO v_org_id
FROM public.memberships
WHERE user_id = v_user_id
    AND role = 'owner'
LIMIT 1;
-- 3. If no organization, create one!
IF v_org_id IS NULL THEN RAISE NOTICE 'No organization found. Creating "Admin HQ" organization...';
INSERT INTO public.organizations (name)
VALUES ('مكتب الإدارة')
RETURNING id INTO v_org_id;
-- Add user as owner
INSERT INTO public.memberships (user_id, org_id, role)
VALUES (v_user_id, v_org_id, 'owner');
END IF;
-- 4. Upsert subscription with ENTERPRISE plan and expiry in 2076 (50 years)
INSERT INTO public.org_subscriptions (
        org_id,
        plan,
        status,
        current_period_start,
        current_period_end,
        created_at,
        updated_at
    )
VALUES (
        v_org_id,
        'ENTERPRISE',
        'active',
        now(),
        now() + interval '50 years',
        now(),
        now()
    ) ON CONFLICT (org_id) DO
UPDATE
SET plan = EXCLUDED.plan,
    status = EXCLUDED.status,
    current_period_start = EXCLUDED.current_period_start,
    current_period_end = EXCLUDED.current_period_end,
    updated_at = now();
RAISE NOTICE 'Granted ENTERPRISE subscription to Org ID: % for User: %',
v_org_id,
'Masar.almohami@outlook.sa';
END $$;