-- ============================================================
-- Create Admin User Script
-- Usage: Run this in Supabase SQL Editor
-- ============================================================
-- 1. Create the user in auth.users (if not exists)
DO $$
DECLARE new_user_id uuid;
BEGIN -- Check if user already exists
SELECT id INTO new_user_id
FROM auth.users
WHERE email = 'Masar.almohami@outlook.sa';
IF new_user_id IS NULL THEN -- Insert new user
INSERT INTO auth.users (
        instance_id,
        id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        recovery_sent_at,
        last_sign_in_at,
        raw_app_meta_data,
        raw_user_meta_data,
        created_at,
        updated_at,
        confirmation_token,
        email_change,
        email_change_token_new,
        recovery_token
    )
VALUES (
        '00000000-0000-0000-0000-000000000000',
        -- standard instance_id
        gen_random_uuid(),
        'authenticated',
        'authenticated',
        'Masar.almohami@outlook.sa',
        crypt('Aa@19961996', gen_salt('bf')),
        -- hash the password
        now(),
        -- confirm email immediately
        null,
        now(),
        '{"provider":"email","providers":["email"]}',
        '{"full_name":"Admin User"}',
        now(),
        now(),
        '',
        '',
        '',
        ''
    )
RETURNING id INTO new_user_id;
ELSE -- Update password if user exists
UPDATE auth.users
SET encrypted_password = crypt('Aa@19961996', gen_salt('bf'))
WHERE id = new_user_id;
END IF;
-- 2. Add to public.profiles (if not exists)
INSERT INTO public.profiles (user_id, full_name, status)
VALUES (new_user_id, 'Admin User', 'active') ON CONFLICT (user_id) DO NOTHING;
-- 3. Add to public.app_admins (if not exists)
INSERT INTO public.app_admins (user_id)
VALUES (new_user_id) ON CONFLICT (user_id) DO NOTHING;
RAISE NOTICE 'Admin user created/updated successfully. ID: %',
new_user_id;
END $$;