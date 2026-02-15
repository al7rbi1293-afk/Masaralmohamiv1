-- Step 11.2: Add missing columns to leads table for marketing pipeline
-- Adds: topic, message, utm (jsonb), referrer
alter table public.leads
add column if not exists topic text;
alter table public.leads
add column if not exists message text;
alter table public.leads
add column if not exists utm jsonb;
alter table public.leads
add column if not exists referrer text;