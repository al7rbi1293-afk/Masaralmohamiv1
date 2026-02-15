-- Create enum types for payment method and status
CREATE TYPE payment_method_type_new AS ENUM (
    'bank_transfer',
    'credit_card',
    'apple_pay',
    'mada'
);
CREATE TYPE payment_status_type_new AS ENUM ('pending', 'approved', 'rejected');
-- Drop if exists (idempotency)
DROP TABLE IF EXISTS payment_requests;
-- Create payment_requests table
CREATE TABLE payment_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    user_id uuid REFERENCES auth.users(id) ON DELETE
    SET NULL,
        -- who requested
        -- Payment Details
        amount decimal(10, 2) NOT NULL,
        currency text DEFAULT 'SAR',
        plan_code text NOT NULL,
        -- e.g. 'SOLO', 'SMALL_OFFICE'
        billing_period text NOT NULL CHECK (billing_period IN ('monthly', 'yearly')),
        method payment_method_type_new NOT NULL,
        status payment_status_type_new DEFAULT 'pending',
        -- For Bank Transfer
        proof_url text,
        -- URL to uploaded receipt image
        bank_reference text,
        -- Optional text reference
        -- Audit
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now(),
        -- Admin Review
        reviewed_at timestamptz,
        reviewed_by uuid REFERENCES auth.users(id) ON DELETE
    SET NULL,
        -- Admin ID
        review_note text -- Reason for rejection or note
);
-- Enable RLS
ALTER TABLE payment_requests ENABLE ROW LEVEL SECURITY;
-- Policies for payment_requests
-- 1. Users can view their own org's requests
CREATE POLICY "Users can view own org payment requests" ON payment_requests FOR
SELECT USING (
        EXISTS (
            SELECT 1
            FROM memberships
            WHERE memberships.user_id = auth.uid()
                AND memberships.org_id = payment_requests.org_id
        )
    );
-- 2. Users can insert requests for their own org
CREATE POLICY "Users can insert payment requests for own org" ON payment_requests FOR
INSERT WITH CHECK (
        EXISTS (
            SELECT 1
            FROM memberships
            WHERE memberships.user_id = auth.uid()
                AND memberships.org_id = payment_requests.org_id
        )
    );
-- 3. Admins can view/update all (Assuming we have an 'admin' role or check via email)
-- For now, allow auth.uid() = {YOUR_ADMIN_UUID} or handle via service_role in API.
-- We will use service_role client in the admin actions, so RLS isn't strictly needed for admin updates there,
-- but good to have if we build a client-side admin panel.