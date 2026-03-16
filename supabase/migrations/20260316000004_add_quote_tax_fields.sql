-- Add tax fields to quotes table
alter table public.quotes add column if not exists subtotal numeric(14,2);
alter table public.quotes add column if not exists tax numeric(14,2) default 0;
alter table public.quotes add column if not exists tax_enabled boolean default false;
alter table public.quotes add column if not exists tax_number text;

-- Backfill subtotal from total for existing quotes
update public.quotes set subtotal = total where subtotal is null;

-- Ensure subtotal is not null after backfill
alter table public.quotes alter column subtotal set not null;
