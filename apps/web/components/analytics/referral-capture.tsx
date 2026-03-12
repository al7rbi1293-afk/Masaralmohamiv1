'use client';

import { useEffect } from 'react';
import { captureUtm } from '@/lib/utm';
import { getStoredReferral, setStoredReferral } from '@/lib/partners/referral-client';

export function ReferralCapture() {
  useEffect(() => {
    captureUtm();

    const url = new URL(window.location.href);
    const ref = (url.searchParams.get('ref') || '').trim();

    if (!ref) {
      return;
    }

    const previous = getStoredReferral();
    const sessionId = previous?.sessionId || crypto.randomUUID();

    const payload = {
      ref,
      session_id: sessionId,
      landing_page: `${window.location.pathname}${window.location.search}`.slice(0, 1000),
      utm_source: url.searchParams.get('utm_source') || undefined,
      utm_medium: url.searchParams.get('utm_medium') || undefined,
      utm_campaign: url.searchParams.get('utm_campaign') || undefined,
    };

    fetch('/api/referrals/capture', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      credentials: 'include',
    })
      .then((res) => res.json().catch(() => null))
      .then((json) => {
        const result = json?.result;
        if (!result?.captured) {
          return;
        }

        setStoredReferral({
          code: String(result.partnerCode),
          partnerId: String(result.partnerId),
          sessionId: String(result.sessionId),
          clickId: String(result.clickId),
          capturedAt: new Date().toISOString(),
        });
      })
      .catch(() => {
        // best-effort tracking
      });
  }, []);

  return null;
}
