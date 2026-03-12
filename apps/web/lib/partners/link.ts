import 'server-only';

import { getPublicSiteUrl } from '@/lib/env';

export function buildPartnerReferralLink(partnerCode: string) {
  const siteUrl = getPublicSiteUrl();
  const url = new URL('/', `${siteUrl}/`);
  url.searchParams.set('ref', partnerCode);
  return url.toString();
}
