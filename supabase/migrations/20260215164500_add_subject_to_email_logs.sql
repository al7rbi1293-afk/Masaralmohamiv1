-- Add subject column to email_logs if it doesn't exist
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'email_logs'
        AND column_name = 'subject'
) THEN
ALTER TABLE public.email_logs
ADD COLUMN subject text;
END IF;
END $$;