import test from 'node:test';
import assert from 'node:assert/strict';

import { generatePartnerCode, partnerSlugFromCode } from '@/lib/partners/code';
import { normalizePartnerCode } from '@/lib/partners/utils';
import { isSelfReferral, isWithinAttributionWindow } from '@/lib/partners/rules';
import { calculateCommissionAmounts } from '@/lib/partners/math';
import { normalizeTapStatus, parseTapChargePayload } from '@/lib/partners/tap-utils';

test('partner code generation returns professional pattern', () => {
  const code = generatePartnerCode();
  assert.match(code, /^MASAR-[A-Z0-9]{6}$/);
});

test('partner code generation has low collision for short sample', () => {
  const sample = new Set<string>();

  for (let i = 0; i < 500; i += 1) {
    sample.add(generatePartnerCode());
  }

  // probabilistic guard: we should not collide in this small sample.
  assert.equal(sample.size, 500);
});

test('partner slug should be readable and deterministic', () => {
  const slug = partnerSlugFromCode('MASAR-AB12CD');
  assert.equal(slug, 'masar-ab12cd');
});

test('referral parsing normalizes and sanitizes partner code', () => {
  assert.equal(normalizePartnerCode(' masar-abc123 '), 'MASAR-ABC123');
  assert.equal(normalizePartnerCode('mAsAr-12*34'), 'MASAR-1234');
});

test('attribution window accepts valid recent capture', () => {
  const now = Date.UTC(2026, 2, 12);
  const capturedAt = new Date(now - 5 * 24 * 60 * 60 * 1000).toISOString();

  assert.equal(isWithinAttributionWindow({ capturedAt, windowDays: 30, nowMs: now }), true);
});

test('attribution window rejects expired capture', () => {
  const now = Date.UTC(2026, 2, 12);
  const capturedAt = new Date(now - 45 * 24 * 60 * 60 * 1000).toISOString();

  assert.equal(isWithinAttributionWindow({ capturedAt, windowDays: 30, nowMs: now }), false);
});

test('self-referral block works by email and user id', () => {
  assert.equal(
    isSelfReferral({
      partnerEmail: 'owner@example.com',
      customerEmail: 'owner@example.com',
    }),
    true,
  );

  assert.equal(
    isSelfReferral({
      partnerUserId: 'user-1',
      customerUserId: 'user-1',
    }),
    true,
  );

  assert.equal(
    isSelfReferral({
      partnerEmail: 'partner@example.com',
      customerEmail: 'customer@example.com',
      partnerUserId: 'u1',
      customerUserId: 'u2',
    }),
    false,
  );
});

test('commission calculator returns expected 5% + 5% split', () => {
  const result = calculateCommissionAmounts({
    baseAmount: 1000,
    partnerRate: 5,
    marketingRate: 5,
  });

  assert.equal(result.partnerAmount, 50);
  assert.equal(result.marketingAmount, 50);
});

test('tap status normalization handles success and failure statuses', () => {
  assert.equal(normalizeTapStatus('CAPTURED'), 'captured');
  assert.equal(normalizeTapStatus('AUTHORIZED'), 'authorized');
  assert.equal(normalizeTapStatus('FAILED'), 'failed');
  assert.equal(normalizeTapStatus('CANCELLED'), 'cancelled');
  assert.equal(normalizeTapStatus('REFUNDED'), 'refunded');
});

test('webhook parser extracts charge and metadata safely', () => {
  const parsed = parseTapChargePayload({
    object: {
      id: 'chg_test_123',
      status: 'CAPTURED',
      amount: 500,
      currency: 'SAR',
      metadata: {
        org_id: 'org-1',
        user_id: 'user-1',
      },
      customer: { id: 'cus_1' },
      card: { id: 'card_1' },
      payment_agreement: { id: 'agr_1' },
    },
  });

  assert.equal(parsed.chargeId, 'chg_test_123');
  assert.equal(parsed.status, 'captured');
  assert.equal(parsed.customerId, 'cus_1');
  assert.equal(parsed.cardId, 'card_1');
  assert.equal(parsed.agreementId, 'agr_1');
  assert.equal(parsed.metadata.org_id, 'org-1');
});
