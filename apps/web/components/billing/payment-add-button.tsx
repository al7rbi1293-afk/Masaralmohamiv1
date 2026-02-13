'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, buttonVariants } from '@/components/ui/button';

type PaymentAddButtonProps = {
  invoiceId: string;
  disabled?: boolean;
};

export function PaymentAddButton({ invoiceId, disabled = false }: PaymentAddButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('');
  const [paidAt, setPaidAt] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    setBusy(true);
    setError('');

    const amountNumber = Number(amount);
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
      setBusy(false);
      setError('يرجى إدخال مبلغ صحيح.');
      return;
    }

    try {
      const response = await fetch('/app/api/payments/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoice_id: invoiceId,
          amount: amountNumber,
          method: method.trim() || null,
          paid_at: paidAt ? new Date(paidAt).toISOString() : null,
          note: note.trim() || null,
        }),
      });

      const json = (await response.json().catch(() => ({}))) as any;
      if (!response.ok) {
        setError(String(json?.error ?? 'تعذر تسجيل الدفعة.'));
        return;
      }

      setOpen(false);
      setAmount('');
      setMethod('');
      setPaidAt('');
      setNote('');
      router.refresh();
    } catch {
      setError('تعذر تسجيل الدفعة.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button type="button" variant="primary" size="sm" disabled={disabled} onClick={() => setOpen(true)}>
        تسجيل دفعة
      </Button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => {
            if (!busy) setOpen(false);
          }}
        >
          <div
            className="w-full max-w-lg rounded-xl border border-brand-border bg-white p-5 shadow-panel dark:border-slate-700 dark:bg-slate-900"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-brand-navy dark:text-slate-100">تسجيل دفعة</h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  أضف دفعة يدوية لهذه الفاتورة.
                </p>
              </div>
              <button
                type="button"
                className={buttonVariants('ghost', 'sm')}
                onClick={() => {
                  if (!busy) setOpen(false);
                }}
              >
                إغلاق
              </button>
            </div>

            {error ? (
              <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
                {error}
              </p>
            ) : null}

            <div className="mt-4 grid gap-4">
              <label className="block space-y-1 text-sm">
                <span className="font-medium text-slate-700 dark:text-slate-200">المبلغ</span>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  className="h-11 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
                />
              </label>

              <label className="block space-y-1 text-sm">
                <span className="font-medium text-slate-700 dark:text-slate-200">طريقة الدفع (اختياري)</span>
                <input
                  value={method}
                  onChange={(event) => setMethod(event.target.value)}
                  placeholder="تحويل / كاش / ..."
                  className="h-11 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
                />
              </label>

              <label className="block space-y-1 text-sm">
                <span className="font-medium text-slate-700 dark:text-slate-200">تاريخ الدفع (اختياري)</span>
                <input
                  type="datetime-local"
                  value={paidAt}
                  onChange={(event) => setPaidAt(event.target.value)}
                  className="h-11 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
                />
              </label>

              <label className="block space-y-1 text-sm">
                <span className="font-medium text-slate-700 dark:text-slate-200">ملاحظة (اختياري)</span>
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-brand-border px-3 py-2 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
                />
              </label>

              <div className="flex flex-wrap gap-3">
                <Button type="button" variant="primary" size="md" disabled={busy} onClick={submit}>
                  {busy ? 'جارٍ الحفظ...' : 'حفظ'}
                </Button>
                <Button type="button" variant="outline" size="md" disabled={busy} onClick={() => setOpen(false)}>
                  إلغاء
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

