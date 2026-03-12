export function isSelfReferral(params: {
  partnerEmail?: string | null;
  partnerUserId?: string | null;
  customerEmail?: string | null;
  customerUserId?: string | null;
}) {
  const partnerEmail = String(params.partnerEmail || '').trim().toLowerCase();
  const customerEmail = String(params.customerEmail || '').trim().toLowerCase();

  if (partnerEmail && customerEmail && partnerEmail === customerEmail) {
    return true;
  }

  if (params.partnerUserId && params.customerUserId && params.partnerUserId === params.customerUserId) {
    return true;
  }

  return false;
}

export function isWithinAttributionWindow(params: {
  capturedAt: string | null;
  windowDays: number;
  nowMs?: number;
}) {
  if (!params.capturedAt) {
    return true;
  }

  const capturedAtMs = new Date(params.capturedAt).getTime();
  if (!Number.isFinite(capturedAtMs)) {
    return true;
  }

  const now = params.nowMs ?? Date.now();
  const windowMs = Math.max(1, params.windowDays) * 24 * 60 * 60 * 1000;
  return now - capturedAtMs <= windowMs;
}
