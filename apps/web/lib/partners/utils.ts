import { LEAD_STATUS_RANK } from '@/lib/partners/constants';
import type { PartnerLeadStatus } from '@/lib/partners/types';

export function normalizePartnerCode(raw: string | null | undefined) {
  return String(raw ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '');
}

export function emptyToNull(value: string | null | undefined) {
  const normalized = String(value ?? '').trim();
  return normalized ? normalized : null;
}

export function shouldPromoteLeadStatus(current: PartnerLeadStatus, next: PartnerLeadStatus) {
  return LEAD_STATUS_RANK[next] >= LEAD_STATUS_RANK[current];
}

export function toSafeNumber(value: unknown, fallback = 0) {
  const candidate = Number(value);
  return Number.isFinite(candidate) ? candidate : fallback;
}

export function nowIso() {
  return new Date().toISOString();
}
