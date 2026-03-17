-- 20260317160000_add_user_license_otp_permissions.sql

ALTER TABLE app_users ADD COLUMN IF NOT EXISTS license_number TEXT;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS otp_code TEXT;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS otp_expires_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE memberships ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{}'::jsonb;
