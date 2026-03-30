import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveEffectivePlanCode } from './plans';

test('trial subscription rows are treated as the TRIAL plan even when plan_code was stored as SOLO', () => {
  assert.equal(
    resolveEffectivePlanCode({
      subscriptionPlan: 'SOLO',
      subscriptionStatus: 'trial',
    }),
    'TRIAL',
  );
});

test('active paid subscriptions still resolve to their paid plan', () => {
  assert.equal(
    resolveEffectivePlanCode({
      subscriptionPlan: 'SMALL_OFFICE',
      subscriptionStatus: 'active',
      hasActiveTrial: true,
    }),
    'SMALL_OFFICE',
  );
});

test('active trial records without a paid subscription resolve to TRIAL', () => {
  assert.equal(
    resolveEffectivePlanCode({
      hasActiveTrial: true,
    }),
    'TRIAL',
  );
});
