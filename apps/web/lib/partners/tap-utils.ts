export function normalizeTapStatus(raw: unknown) {
  const status = String(raw || '').trim().toLowerCase();

  if (!status) return 'pending' as const;
  if (status === 'captured') return 'captured' as const;
  if (status === 'authorized') return 'authorized' as const;
  if (status === 'abandoned' || status === 'cancelled' || status === 'canceled') return 'cancelled' as const;
  if (status === 'failed' || status === 'declined' || status === 'void') return 'failed' as const;
  if (status === 'refunded' || status === 'partially_refunded') return 'refunded' as const;

  return 'pending' as const;
}

export function parseTapChargePayload(payload: Record<string, any>) {
  const candidate =
    (payload.object && typeof payload.object === 'object' ? payload.object : null) ||
    (payload.charge && typeof payload.charge === 'object' ? payload.charge : null) ||
    payload;

  const chargeId = String(candidate?.id || payload?.id || '').trim();
  const chargeStatus = normalizeTapStatus(candidate?.status || payload?.status);

  const metadata = (candidate?.metadata && typeof candidate.metadata === 'object' ? candidate.metadata : {}) as Record<string, unknown>;

  return {
    raw: candidate,
    chargeId,
    status: chargeStatus,
    amount: Number(candidate?.amount || 0),
    currency: String(candidate?.currency || 'SAR').toUpperCase(),
    metadata,
    customerId: String(candidate?.customer?.id || metadata.tap_customer_id || '').trim() || null,
    cardId: String(candidate?.card?.id || metadata.tap_card_id || '').trim() || null,
    agreementId: String(candidate?.payment_agreement?.id || metadata.tap_agreement_id || '').trim() || null,
    reference: String(candidate?.reference?.transaction || candidate?.reference?.order || '').trim() || null,
  };
}

export function resolvePeriodEnd(period: string | null) {
  const now = new Date();
  const end = new Date(now);

  if (period === 'yearly') {
    end.setFullYear(end.getFullYear() + 1);
  } else {
    end.setMonth(end.getMonth() + 1);
  }

  return {
    start: now.toISOString(),
    end: end.toISOString(),
  };
}
