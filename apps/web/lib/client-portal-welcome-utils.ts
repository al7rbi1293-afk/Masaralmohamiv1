type ClientPortalWelcomeDecisionParams = {
  previousEmail?: string | null;
  nextEmail?: string | null;
  clientStatus?: 'active' | 'archived' | null;
};

export function shouldSendClientPortalWelcomeEmail(params: ClientPortalWelcomeDecisionParams) {
  const previousEmail = normalizeEmail(params.previousEmail);
  const nextEmail = normalizeEmail(params.nextEmail);

  return params.clientStatus === 'active' && nextEmail !== null && nextEmail !== previousEmail;
}

function normalizeEmail(value?: string | null) {
  const normalized = String(value ?? '').trim().toLowerCase();
  return normalized || null;
}
