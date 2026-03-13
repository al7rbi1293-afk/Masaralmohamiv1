'use client';

import { REFERRAL_LOCAL_STORAGE_KEY } from '@/lib/partners/constants';
import {
  buildReferralCaptureKey,
  isRecentReferralTimestamp,
} from '@/lib/partners/referral-capture-utils';

export type StoredReferral = {
  code: string;
  partnerId: string;
  sessionId: string;
  clickId: string;
  capturedAt: string;
};

type ReferralCaptureGuardEntry = {
  sessionId: string;
  createdAt: string;
};

const REFERRAL_CAPTURE_GUARD_STORAGE_KEY = 'masar_referral_capture_guard';

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

function readReferralCaptureGuards() {
  if (typeof window === 'undefined') {
    return {} as Record<string, ReferralCaptureGuardEntry>;
  }

  try {
    const raw = window.sessionStorage.getItem(REFERRAL_CAPTURE_GUARD_STORAGE_KEY);
    if (!raw) {
      return {} as Record<string, ReferralCaptureGuardEntry>;
    }

    const parsed = JSON.parse(raw) as Record<string, ReferralCaptureGuardEntry>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {} as Record<string, ReferralCaptureGuardEntry>;
  }
}

function writeReferralCaptureGuards(value: Record<string, ReferralCaptureGuardEntry>) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    const keys = Object.keys(value);
    if (keys.length === 0) {
      window.sessionStorage.removeItem(REFERRAL_CAPTURE_GUARD_STORAGE_KEY);
      return;
    }

    window.sessionStorage.setItem(REFERRAL_CAPTURE_GUARD_STORAGE_KEY, JSON.stringify(value));
  } catch {
    // no-op
  }
}

function pruneReferralCaptureGuards(
  guards: Record<string, ReferralCaptureGuardEntry>,
  nowMs = Date.now(),
) {
  return Object.fromEntries(
    Object.entries(guards).filter(([, entry]) => isRecentReferralTimestamp(entry.createdAt, nowMs)),
  );
}

export function getReferralCaptureGuard(params: {
  code: string;
  landingPage: string;
}) {
  if (typeof window === 'undefined') {
    return null;
  }

  const key = buildReferralCaptureKey(params);
  const nextGuards = pruneReferralCaptureGuards(readReferralCaptureGuards());
  writeReferralCaptureGuards(nextGuards);

  const entry = nextGuards[key];
  if (!entry) {
    return null;
  }

  return {
    key,
    ...entry,
  };
}

export function setReferralCaptureGuard(params: {
  code: string;
  landingPage: string;
  sessionId: string;
  createdAt?: string;
}) {
  if (typeof window === 'undefined') {
    return;
  }

  const key = buildReferralCaptureKey(params);
  const nextGuards = pruneReferralCaptureGuards(readReferralCaptureGuards());
  nextGuards[key] = {
    sessionId: params.sessionId,
    createdAt: params.createdAt || new Date().toISOString(),
  };
  writeReferralCaptureGuards(nextGuards);
}

export function clearReferralCaptureGuard(params: {
  code: string;
  landingPage: string;
}) {
  if (typeof window === 'undefined') {
    return;
  }

  const key = buildReferralCaptureKey(params);
  const nextGuards = pruneReferralCaptureGuards(readReferralCaptureGuards());
  delete nextGuards[key];
  writeReferralCaptureGuards(nextGuards);
}
