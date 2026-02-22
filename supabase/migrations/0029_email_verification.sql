-- Phase 9: Restore Email Verification
-- Adds columns to track email verification tokens for the custom auth system
ALTER TABLE public.app_users
ADD COLUMN IF NOT EXISTS email_verification_token TEXT;
ALTER TABLE public.app_users
ADD COLUMN IF NOT EXISTS email_verification_expires_at TIMESTAMPTZ;
-- We don't drop the default 'active' status, but we rely on email_verified = false to block login.