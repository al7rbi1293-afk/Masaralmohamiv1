-- Phase 8: Custom Users Table
-- Replaces Supabase auth.users with a self-managed app_users table.
-- 1. Create the app_users table
CREATE TABLE IF NOT EXISTS public.app_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL DEFAULT '',
    phone TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
    email_verified BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Unique constraint on lowercased email
CREATE UNIQUE INDEX IF NOT EXISTS idx_app_users_email_unique ON public.app_users (lower(email));
CREATE INDEX IF NOT EXISTS idx_app_users_status ON public.app_users (status);
-- 2. Migrate existing users from auth.users + profiles into app_users
-- This copies email from auth.users and full_name from profiles.
-- password_hash is set to empty since we can't extract bcrypt hashes from Supabase Auth easily.
-- Users will need to reset their passwords after migration.
INSERT INTO public.app_users (
        id,
        email,
        password_hash,
        full_name,
        phone,
        email_verified,
        created_at
    )
SELECT au.id,
    au.email,
    '' AS password_hash,
    -- Will require password reset
    COALESCE(p.full_name, ''),
    p.phone,
    CASE
        WHEN au.email_confirmed_at IS NOT NULL THEN true
        ELSE false
    END,
    au.created_at
FROM auth.users au
    LEFT JOIN public.profiles p ON p.user_id = au.id ON CONFLICT (id) DO NOTHING;
-- 3. Drop old profiles foreign key and re-point to app_users
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_user_id_fkey;
ALTER TABLE public.profiles
ADD CONSTRAINT profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.app_users(id) ON DELETE CASCADE;
-- 4. Drop old memberships foreign key and re-point to app_users
ALTER TABLE public.memberships DROP CONSTRAINT IF EXISTS memberships_user_id_fkey;
ALTER TABLE public.memberships
ADD CONSTRAINT memberships_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.app_users(id) ON DELETE CASCADE;
-- 5. Grant permissions (service role bypasses RLS, but we grant for safety)
GRANT ALL ON public.app_users TO authenticated,
    service_role;
-- 6. Disable RLS on app_users (all access is controlled by application code)
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;
-- Allow service_role full access
CREATE POLICY app_users_service_all ON public.app_users FOR ALL TO service_role USING (true) WITH CHECK (true);
-- 7. Drop the old auth trigger (no longer needed)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;