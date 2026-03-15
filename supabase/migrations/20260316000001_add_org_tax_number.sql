-- Add tax_number column to organizations table
ALTER TABLE organizations
    ADD COLUMN IF NOT EXISTS tax_number TEXT DEFAULT NULL;
