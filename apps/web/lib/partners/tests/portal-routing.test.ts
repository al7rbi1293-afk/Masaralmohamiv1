import test from 'node:test';
import assert from 'node:assert/strict';

import {
  isPartnerOnlyUser,
  resolvePostSignInDestination,
  shouldRedirectPartnerOnlyToPortal,
} from '@/lib/partners/portal-routing';

test('partner-only detection requires linked partner without org or admin role', () => {
  assert.equal(isPartnerOnlyUser({
    hasLinkedPartner: true,
    hasOrganization: false,
    isAdmin: false,
  }), true);

  assert.equal(isPartnerOnlyUser({
    hasLinkedPartner: true,
    hasOrganization: true,
    isAdmin: false,
  }), false);

  assert.equal(isPartnerOnlyUser({
    hasLinkedPartner: true,
    hasOrganization: false,
    isAdmin: true,
  }), false);
});

test('partner-only users are forced back to the partner portal after sign-in', () => {
  assert.equal(resolvePostSignInDestination({
    requestedPath: null,
    isAdmin: false,
    isPartnerOnly: true,
  }), '/app/partners');

  assert.equal(resolvePostSignInDestination({
    requestedPath: '/app/clients',
    isAdmin: false,
    isPartnerOnly: true,
  }), '/app/partners');
});

test('office users and admins keep their intended destinations', () => {
  assert.equal(resolvePostSignInDestination({
    requestedPath: '/app/clients',
    isAdmin: false,
    isPartnerOnly: false,
  }), '/app/clients');

  assert.equal(resolvePostSignInDestination({
    requestedPath: null,
    isAdmin: true,
    isPartnerOnly: false,
  }), '/admin');
});

test('partner-only redirect helper ignores the portal itself and app api routes', () => {
  assert.equal(shouldRedirectPartnerOnlyToPortal('/app'), true);
  assert.equal(shouldRedirectPartnerOnlyToPortal('/app/clients'), true);
  assert.equal(shouldRedirectPartnerOnlyToPortal('/app/partners'), false);
  assert.equal(shouldRedirectPartnerOnlyToPortal('/app/api/partners'), false);
});
