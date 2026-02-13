'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

type StripeCheckoutClientProps = {
  planCode: string;
  disabled?: boolean;
};

export function StripeCheckoutClient({ planCode, disabled = false }: StripeCheckoutClientProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function startCheckout() {
    setBusy(true);
    setError('');

    try {
      const res = await fetch('/app/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ plan_code: planCode }),
      });

      const json = (await res.json().catch(() => ({}))) as any;
      if (!res.ok) {
        setError(String(json?.error ?? 'تعذر بدء الدفع.'));
        return;
      }

      const url = String(json?.url ?? '');
      if (!url) {
        setError('تعذر بدء الدفع.');
        return;
      }

      window.location.assign(url);
    } catch {
      setError('تعذر الاتصال بالخدمة. حاول مرة أخرى.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="primary"
        size="sm"
        disabled={disabled || busy}
        onClick={startCheckout}
      >
        {busy ? 'جارٍ تحويلك للدفع...' : 'اشترك الآن'}
      </Button>
      {error ? (
        <p className="text-xs text-red-700 dark:text-red-300" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

