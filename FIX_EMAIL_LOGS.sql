-- Create the column manually
ALTER TABLE public.email_logs
ADD COLUMN IF NOT EXISTS subject text;
-- Verify it exists
SELECT column_name,
    data_type
FROM information_schema.columns
WHERE table_name = 'email_logs'
    AND column_name = 'subject';