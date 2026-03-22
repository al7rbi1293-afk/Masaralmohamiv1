-- Support automated trial reminder / expiry emails in email_logs
-- and align sent_by with the custom app_users auth model.

ALTER TABLE public.email_logs
  ADD COLUMN IF NOT EXISTS template text;

ALTER TABLE public.email_logs
  ADD COLUMN IF NOT EXISTS sent_by uuid;

ALTER TABLE public.email_logs
  ALTER COLUMN sent_by DROP NOT NULL;

ALTER TABLE public.email_logs
  DROP CONSTRAINT IF EXISTS email_logs_sent_by_fkey;

ALTER TABLE public.email_logs
  ADD CONSTRAINT email_logs_sent_by_fkey
  FOREIGN KEY (sent_by) REFERENCES public.app_users(id) ON DELETE SET NULL;

ALTER TABLE public.email_logs
  DROP CONSTRAINT IF EXISTS email_logs_template_check;

ALTER TABLE public.email_logs
  ADD CONSTRAINT email_logs_template_check
  CHECK (
    template IS NULL OR template IN (
      'doc_share',
      'invoice',
      'task_reminder',
      'trial_reminder',
      'trial_expired'
    )
  );
