'use client';

import { useState } from 'react';
import { Button, buttonVariants } from '@/components/ui/button';
import { buildInvoiceEmailMessage } from '@/lib/invoice-email-template';

type InvoiceEmailButtonProps = {
  invoiceId: string;
  invoiceNumber: string;
  issuedAt?: string | null;
  dueAt?: string | null;
  total?: number | string | null;
  currency?: string | null;
  clientName?: string | null;
  officeName?: string | null;
  initialEmail?: string | null;
  label?: string;
  className?: string;
};

export function InvoiceEmailButton({
  invoiceId,
  invoiceNumber,
  issuedAt,
  dueAt,
  total,
  currency,
  clientName,
  officeName,
  initialEmail,
  label = 'إرسال بالبريد',
  className = '',
}: InvoiceEmailButtonProps) {
  const [open, setOpen] = useState(false);
  const [toEmail, setToEmail] = useState(initialEmail?.trim() ?? '');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const defaultMessage = buildInvoiceEmailMessage({
    invoiceNumber,
    issuedAt,
    dueAt,
    total,
    currency,
    clientName,
    officeName,
  });

  async function submit() {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/app/api/email/send-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoice_id: invoiceId,
          to_email: toEmail,
          message_optional: message || undefined,
        }),
      });

      const json = (await response.json().catch(() => ({}))) as any;
      if (!response.ok) {
        setError(String(json?.error ?? 'تعذر إرسال البريد.'));
        return;
      }

      setSuccess('تم إرسال الفاتورة بالبريد.');
      setTimeout(() => setOpen(false), 900);
    } catch {
      setError('تعذر إرسال البريد.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className={`${buttonVariants('outline', 'sm')} ${className}`}
        onClick={() => {
          setOpen(true);
          setToEmail(initialEmail?.trim() ?? '');
          setMessage(defaultMessage);
          setError('');
          setSuccess('');
        }}
      >
        {label}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-xl border border-brand-border bg-white p-5 shadow-panel dark:border-slate-700 dark:bg-slate-900"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-brand-navy dark:text-slate-100">إرسال الفاتورة بالبريد</h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  سيتم إرسال الفاتورة كملف PDF مرفق.
                </p>
              </div>
              <button type="button" className={buttonVariants('ghost', 'sm')} onClick={() => setOpen(false)}>
                إغلاق
              </button>
            </div>

            {error ? (
              <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
                {error}
              </p>
            ) : null}

            {success ? (
              <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200">
                {success}
              </p>
            ) : null}

            <label className="mt-4 block space-y-1 text-sm">
              <span className="font-medium text-slate-700 dark:text-slate-200">
                البريد الإلكتروني <span className="text-red-600">*</span>
              </span>
              <input
                value={toEmail}
                onChange={(event) => setToEmail(event.target.value)}
                placeholder="example@domain.com"
                className="h-11 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
              />
            </label>

            <label className="mt-4 block space-y-1 text-sm">
              <span className="font-medium text-slate-700 dark:text-slate-200">رسالة (اختياري)</span>
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                rows={9}
                className="w-full rounded-lg border border-brand-border px-3 py-2 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
                placeholder="سيتم تعبئة صياغة احترافية تلقائيًا..."
              />
            </label>

            <div className="mt-4 flex items-center justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)} disabled={loading}>
                إلغاء
              </Button>
              <Button type="button" variant="primary" size="sm" disabled={loading} onClick={submit}>
                {loading ? 'جارٍ الإرسال...' : 'إرسال'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
