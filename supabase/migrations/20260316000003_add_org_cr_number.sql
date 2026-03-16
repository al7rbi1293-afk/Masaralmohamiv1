-- Add cr_number column to organizations table
ALTER TABLE organizations
    ADD COLUMN IF NOT EXISTS cr_number TEXT DEFAULT NULL;
