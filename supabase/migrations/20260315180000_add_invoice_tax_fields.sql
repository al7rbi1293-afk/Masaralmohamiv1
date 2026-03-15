-- Add tax_enabled and tax_number columns to invoices
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS tax_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tax_number  TEXT    DEFAULT NULL;
