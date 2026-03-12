'use client';

import { REFERRAL_LOCAL_STORAGE_KEY } from '@/lib/partners/constants';

export type StoredReferral = {
  code: string;
  partnerId: string;
  sessionId: string;
  clickId: string;
  capturedAt: string;
};

export function getStoredReferral(): StoredReferral | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(REFERRAL_LOCAL_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredReferral;
    if (!parsed?.code || !parsed?.sessionId) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function setStoredReferral(value: StoredReferral) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(REFERRAL_LOCAL_STORAGE_KEY, JSON.stringify(value));
  } catch {
    // no-op
  }
}

export function clearStoredReferral() {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.removeItem(REFERRAL_LOCAL_STORAGE_KEY);
  } catch {
    // no-op
  }
}
