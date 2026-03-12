'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

type TapCheckoutButtonProps = {
  planCode: string;
  period: 'monthly' | 'yearly';
};

export function TapCheckoutButton({ planCode, period }: TapCheckoutButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function startTapCheckout() {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/app/api/tap/create-charge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          plan_code: planCode,
          billing_period: period,
          currency: 'SAR',
        }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        setErrorMessage(payload?.error || 'تعذر بدء عملية الدفع عبر Tap.');
        return;
      }

      const paymentUrl = payload?.payment_url as string | null;
      const chargeId = payload?.charge_id as string | null;

      if (paymentUrl) {
        window.location.assign(paymentUrl);
        return;
      }

      if (chargeId) {
        window.location.assign(`/app/billing/result?provider=tap&charge_id=${encodeURIComponent(chargeId)}`);
        return;
      }

      setErrorMessage('تم إنشاء العملية لكن لم يتم إرجاع رابط الدفع.');
    } catch {
      setErrorMessage('حدث خطأ بالاتصال. حاول مرة أخرى.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button type="button" onClick={startTapCheckout} disabled={isLoading} className="w-full">
        {isLoading ? 'جارٍ تحويلك إلى Tap...' : 'الدفع عبر Tap (بطاقة / مدى / Apple Pay)'}
      </Button>
      {errorMessage ? <p className="text-xs text-red-600">{errorMessage}</p> : null}
    </div>
  );
}
