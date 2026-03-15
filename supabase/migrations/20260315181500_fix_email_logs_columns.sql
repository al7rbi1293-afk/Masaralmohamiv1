-- Fix email_logs table: add missing columns that the application code expects
-- The table was originally created by APPLY_ALL_MISSING.sql with different columns
-- than what migration 0019_email_log.sql (and the app code) expect.

-- 1. Add 'template' column (code uses this instead of 'email_type')
ALTER TABLE public.email_logs
  ADD COLUMN IF NOT EXISTS template text;

-- 2. Migrate existing data from email_type to template
UPDATE public.email_logs
  SET template = email_type
  WHERE template IS NULL AND email_type IS NOT NULL;

-- 3. Add 'sent_by' column
ALTER TABLE public.email_logs
  ADD COLUMN IF NOT EXISTS sent_by uuid REFERENCES auth.users(id);

-- 4. Add 'subject' column (may already exist from FIX_EMAIL_LOGS.sql)
ALTER TABLE public.email_logs
  ADD COLUMN IF NOT EXISTS subject text;

-- 5. Add 'error' column
ALTER TABLE public.email_logs
  ADD COLUMN IF NOT EXISTS error text;

-- 6. Add 'meta' column (code uses 'meta', APPLY_ALL_MISSING used 'metadata')
ALTER TABLE public.email_logs
  ADD COLUMN IF NOT EXISTS meta jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 7. Migrate existing data from metadata to meta
UPDATE public.email_logs
  SET meta = metadata
  WHERE meta = '{}'::jsonb AND metadata IS NOT NULL;

-- 8. Create missing indexes
CREATE INDEX IF NOT EXISTS idx_email_logs_org_created
  ON public.email_logs (org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_logs_org_template
  ON public.email_logs (org_id, template);
