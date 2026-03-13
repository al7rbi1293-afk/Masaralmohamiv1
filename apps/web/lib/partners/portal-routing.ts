export function isPartnerOnlyUser(params: {
  hasLinkedPartner: boolean;
  hasOrganization: boolean;
  isAdmin: boolean;
}) {
  return params.hasLinkedPartner && !params.hasOrganization && !params.isAdmin;
}

export function isPartnerPortalPath(pathname: string) {
  return pathname === '/app/partners' || pathname.startsWith('/app/partners/');
}

export function shouldRedirectPartnerOnlyToPortal(pathname: string) {
  if (!pathname.startsWith('/app')) {
    return false;
  }

  if (pathname.startsWith('/app/api/')) {
    return false;
  }

  return !isPartnerPortalPath(pathname);
}

export function resolvePostSignInDestination(params: {
  requestedPath: string | null;
  isAdmin: boolean;
  isPartnerOnly: boolean;
}) {
  const defaultDestination = params.isAdmin
    ? '/admin'
    : params.isPartnerOnly
      ? '/app/partners'
      : '/app';

  if (!params.requestedPath) {
    return defaultDestination;
  }

  if (params.isPartnerOnly && params.requestedPath.startsWith('/app') && !isPartnerPortalPath(params.requestedPath)) {
    return '/app/partners';
  }

  if (!params.isAdmin && params.requestedPath.startsWith('/admin')) {
    return defaultDestination;
  }

  return params.requestedPath;
}
