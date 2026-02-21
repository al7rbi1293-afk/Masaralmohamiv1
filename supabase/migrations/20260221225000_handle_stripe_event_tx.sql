-- Migration: handle_stripe_event_tx
-- Description: Groups stripe subscription updates and event inserts together in an atomic transaction.
CREATE OR REPLACE FUNCTION handle_stripe_event_tx(
        p_org_id UUID,
        p_plan_code TEXT,
        p_provider TEXT,
        p_provider_customer_id TEXT,
        p_provider_subscription_id TEXT,
        p_status TEXT,
        p_seats INTEGER,
        p_current_period_start TIMESTAMPTZ,
        p_current_period_end TIMESTAMPTZ,
        p_cancel_at_period_end BOOLEAN,
        p_event_type TEXT,
        p_event_meta JSONB
    ) RETURNS void AS $$ BEGIN -- Upsert the subscription
INSERT INTO subscriptions (
        org_id,
        plan_code,
        provider,
        provider_customer_id,
        provider_subscription_id,
        status,
        seats,
        current_period_start,
        current_period_end,
        cancel_at_period_end
    )
VALUES (
        p_org_id,
        COALESCE(p_plan_code, 'SOLO'),
        p_provider,
        p_provider_customer_id,
        p_provider_subscription_id,
        COALESCE(p_status, 'trial'),
        COALESCE(p_seats, 1),
        p_current_period_start,
        p_current_period_end,
        COALESCE(p_cancel_at_period_end, false)
    ) ON CONFLICT (org_id) DO
UPDATE
SET plan_code = EXCLUDED.plan_code,
    provider = EXCLUDED.provider,
    provider_customer_id = EXCLUDED.provider_customer_id,
    provider_subscription_id = COALESCE(
        EXCLUDED.provider_subscription_id,
        subscriptions.provider_subscription_id
    ),
    status = COALESCE(EXCLUDED.status, subscriptions.status),
    seats = COALESCE(EXCLUDED.seats, subscriptions.seats),
    current_period_start = COALESCE(
        EXCLUDED.current_period_start,
        subscriptions.current_period_start
    ),
    current_period_end = COALESCE(
        EXCLUDED.current_period_end,
        subscriptions.current_period_end
    ),
    cancel_at_period_end = COALESCE(
        EXCLUDED.cancel_at_period_end,
        subscriptions.cancel_at_period_end
    );
-- Insert the event log
INSERT INTO subscription_events (org_id, type, meta)
VALUES (
        p_org_id,
        p_event_type,
        p_event_meta
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;