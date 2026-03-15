-- Add address column to organizations and clients tables
ALTER TABLE organizations
    ADD COLUMN IF NOT EXISTS address TEXT DEFAULT NULL;

ALTER TABLE clients
    ADD COLUMN IF NOT EXISTS address TEXT DEFAULT NULL;
