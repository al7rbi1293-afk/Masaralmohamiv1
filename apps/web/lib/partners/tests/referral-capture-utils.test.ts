import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildReferralCaptureKey,
  getRecentReferralWindowStart,
  isRecentReferralTimestamp,
} from '@/lib/partners/referral-capture-utils';

test('referral capture key is normalized and stable', () => {
  const key = buildReferralCaptureKey({
    code: ' masar-abc123 ',
    landingPage: '/?ref=masar-abc123&utm_source=test',
  });

  assert.equal(key, 'MASAR-ABC123::/?ref=masar-abc123&utm_source=test');
});

test('recent referral timestamp accepts fresh records and rejects stale ones', () => {
  const now = Date.UTC(2026, 2, 13, 12, 0, 0);

  assert.equal(isRecentReferralTimestamp(new Date(now - 5_000).toISOString(), now), true);
  assert.equal(isRecentReferralTimestamp(new Date(now - 20_000).toISOString(), now), false);
  assert.equal(isRecentReferralTimestamp('not-a-date', now), false);
});

test('recent referral window start uses the provided offset', () => {
  const now = Date.UTC(2026, 2, 13, 12, 0, 0);

  assert.equal(
    getRecentReferralWindowStart(15_000, now),
    new Date(now - 15_000).toISOString(),
  );
});
