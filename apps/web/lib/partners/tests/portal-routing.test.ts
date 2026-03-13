import test from 'node:test';
import assert from 'node:assert/strict';

import {
  isPartnerUser,
  isPartnerOnlyUser,
  resolvePostSignInDestination,
  shouldRedirectPartnerOnlyToPortal,
} from '@/lib/partners/portal-routing';

test('partner user detection requires linked partner and skips admins', () => {
  assert.equal(isPartnerUser({
    hasLinkedPartner: true,
    isAdmin: false,
  }), true);

  assert.equal(isPartnerUser({
    hasLinkedPartner: false,
    isAdmin: false,
  }), false);

  assert.equal(isPartnerUser({
    hasLinkedPartner: true,
    isAdmin: true,
  }), false);
});

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
    isPartnerUser: true,
    isPartnerOnly: true,
  }), '/app/partners');

  assert.equal(resolvePostSignInDestination({
    requestedPath: '/app/clients',
    isAdmin: false,
    isPartnerUser: true,
    isPartnerOnly: true,
  }), '/app/partners');
});

test('partner users default to the partner portal but keep explicit office routes', () => {
  assert.equal(resolvePostSignInDestination({
    requestedPath: null,
    isAdmin: false,
    isPartnerUser: true,
    isPartnerOnly: false,
  }), '/app/partners');

  assert.equal(resolvePostSignInDestination({
    requestedPath: '/app',
    isAdmin: false,
    isPartnerUser: true,
    isPartnerOnly: false,
  }), '/app/partners');

  assert.equal(resolvePostSignInDestination({
    requestedPath: '/app/clients',
    isAdmin: false,
    isPartnerUser: true,
    isPartnerOnly: false,
  }), '/app/clients');
});

test('office users and admins keep their intended destinations', () => {
  assert.equal(resolvePostSignInDestination({
    requestedPath: '/app/clients',
    isAdmin: false,
    isPartnerUser: false,
    isPartnerOnly: false,
  }), '/app/clients');

  assert.equal(resolvePostSignInDestination({
    requestedPath: null,
    isAdmin: true,
    isPartnerUser: false,
    isPartnerOnly: false,
  }), '/admin');
});

test('partner-only redirect helper ignores the portal itself and app api routes', () => {
  assert.equal(shouldRedirectPartnerOnlyToPortal('/app'), true);
  assert.equal(shouldRedirectPartnerOnlyToPortal('/app/clients'), true);
  assert.equal(shouldRedirectPartnerOnlyToPortal('/app/partners'), false);
  assert.equal(shouldRedirectPartnerOnlyToPortal('/app/api/partners'), false);
});
