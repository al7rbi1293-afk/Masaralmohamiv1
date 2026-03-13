'use client';

import { useEffect } from 'react';
import { captureUtm } from '@/lib/utm';
import {
  clearReferralCaptureGuard,
  getReferralCaptureGuard,
  getStoredReferral,
  setReferralCaptureGuard,
  setStoredReferral,
} from '@/lib/partners/referral-client';

export function ReferralCapture() {
  useEffect(() => {
    captureUtm();

    const url = new URL(window.location.href);
    const ref = (url.searchParams.get('ref') || '').trim();

    if (!ref) {
      return;
    }

    const landingPage = `${window.location.pathname}${window.location.search}`.slice(0, 1000);
    const existingGuard = getReferralCaptureGuard({
      code: ref,
      landingPage,
    });

    if (existingGuard) {
      return;
    }

    const previous = getStoredReferral();
    const sessionId = previous?.sessionId || crypto.randomUUID();
    setReferralCaptureGuard({
      code: ref,
      landingPage,
      sessionId,
    });

    const payload = {
      ref,
      session_id: sessionId,
      landing_page: landingPage,
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
      .then(async (res) => {
        const json = await res.json().catch(() => null);
        if (!res.ok) {
          clearReferralCaptureGuard({
            code: ref,
            landingPage,
          });
        }
        return json;
      })
      .then((json) => {
        const result = json?.result;
        if (!result) {
          clearReferralCaptureGuard({
            code: ref,
            landingPage,
          });
          return;
        }

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
        clearReferralCaptureGuard({
          code: ref,
          landingPage,
        });
      });
  }, []);

  return null;
}
