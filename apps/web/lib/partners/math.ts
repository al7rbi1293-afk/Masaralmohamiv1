import { DEFAULT_MARKETING_COMMISSION_RATE, DEFAULT_PARTNER_COMMISSION_RATE } from '@/lib/partners/constants';

export function calculateCommissionAmounts(params: {
  baseAmount: number;
  partnerRate?: number;
  marketingRate?: number;
}) {
  const baseAmount = Number(params.baseAmount || 0);
  const partnerRate = Number(params.partnerRate ?? DEFAULT_PARTNER_COMMISSION_RATE);
  const marketingRate = Number(params.marketingRate ?? DEFAULT_MARKETING_COMMISSION_RATE);

  const partnerAmount = Number(((baseAmount * partnerRate) / 100).toFixed(2));
  const marketingAmount = Number(((baseAmount * marketingRate) / 100).toFixed(2));

  return {
    baseAmount,
    partnerRate,
    marketingRate,
    partnerAmount,
    marketingAmount,
  };
}
