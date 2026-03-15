import assert from 'node:assert/strict';
import test from 'node:test';

import { shouldSendClientPortalWelcomeEmail } from './client-portal-welcome-utils';

test('sends welcome email when an active client gets an email for the first time', () => {
  assert.equal(
    shouldSendClientPortalWelcomeEmail({
      previousEmail: null,
      nextEmail: 'client@example.com',
      clientStatus: 'active',
    }),
    true,
  );
});

test('sends welcome email when an active client email changes', () => {
  assert.equal(
    shouldSendClientPortalWelcomeEmail({
      previousEmail: 'old@example.com',
      nextEmail: 'new@example.com',
      clientStatus: 'active',
    }),
    true,
  );
});

test('does not resend welcome email when the email is unchanged after normalization', () => {
  assert.equal(
    shouldSendClientPortalWelcomeEmail({
      previousEmail: 'Client@Example.com ',
      nextEmail: ' client@example.com',
      clientStatus: 'active',
    }),
    false,
  );
});

test('does not send welcome email for archived clients', () => {
  assert.equal(
    shouldSendClientPortalWelcomeEmail({
      previousEmail: null,
      nextEmail: 'client@example.com',
      clientStatus: 'archived',
    }),
    false,
  );
});
