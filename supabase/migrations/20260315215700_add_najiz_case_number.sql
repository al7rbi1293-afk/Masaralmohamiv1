-- Migration to add najiz_case_number to matters table
ALTER TABLE public.matters ADD COLUMN IF NOT EXISTS najiz_case_number text null;
