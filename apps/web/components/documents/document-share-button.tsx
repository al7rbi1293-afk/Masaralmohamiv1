'use client';

import { useMemo, useState } from 'react';
import { Button, buttonVariants } from '@/components/ui/button';

type ExpiresIn = '1h' | '24h' | '7d';

type DocumentShareButtonProps = {
  documentId: string;
  label?: string;
  className?: string;
};

export function DocumentShareButton({
  documentId,
  label = 'مشاركة',
  className = '',
}: DocumentShareButtonProps) {
  const [open, setOpen] = useState(false);
  const [expiresIn, setExpiresIn] = useState<ExpiresIn>('24h');
  const [shareUrl, setShareUrl] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [copied, setCopied] = useState(false);

  const expiresLabel = useMemo(() => {
    switch (expiresIn) {
      case '1h':
        return 'ساعة';
      case '24h':
        return '24 ساعة';
      case '7d':
        return '7 أيام';
      default:
        return '';
    }
  }, [expiresIn]);

  async function createShare() {
    setLoading(true);
    setError('');
    setCopied(false);
    setShareUrl('');

    try {
      const response = await fetch('/app/api/documents/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ document_id: documentId, expires_in: expiresIn }),
      });

      const json = (await response.json().catch(() => ({}))) as any;
      if (!response.ok) {
        setError(String(json?.error ?? 'تعذر إنشاء رابط المشاركة.'));
        return;
      }

      setShareUrl(String(json.shareUrl ?? ''));
    } catch {
      setError('تعذر إنشاء رابط المشاركة.');
    } finally {
      setLoading(false);
    }
  }

  async function copyLink() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // ignore
    }
  }

  return (
    <>
      <button
        type="button"
        className={`${buttonVariants('outline', 'sm')} ${className}`}
        onClick={() => {
          setOpen(true);
          setError('');
          setCopied(false);
          setShareUrl('');
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
                <h3 className="text-lg font-bold text-brand-navy dark:text-slate-100">مشاركة مستند</h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  أنشئ رابطًا مؤقتًا لتنزيل المستند.
                </p>
              </div>
              <button
                type="button"
                className={buttonVariants('ghost', 'sm')}
                onClick={() => setOpen(false)}
              >
                إغلاق
              </button>
            </div>

            {error ? (
              <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
                {error}
              </p>
            ) : null}

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1 text-sm">
                <span className="font-medium text-slate-700 dark:text-slate-200">مدة الصلاحية</span>
                <select
                  value={expiresIn}
                  onChange={(event) => setExpiresIn(event.target.value as ExpiresIn)}
                  className="h-11 w-full rounded-lg border border-brand-border bg-white px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
                >
                  <option value="1h">ساعة</option>
                  <option value="24h">24 ساعة</option>
                  <option value="7d">7 أيام</option>
                </select>
              </label>

              <div className="flex items-end">
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  className="w-full"
                  disabled={loading}
                  onClick={createShare}
                >
                  {loading ? 'جارٍ إنشاء الرابط...' : `إنشاء رابط (${expiresLabel})`}
                </Button>
              </div>
            </div>

            {shareUrl ? (
              <div className="mt-4 rounded-lg border border-brand-border bg-brand-background p-3 dark:border-slate-700 dark:bg-slate-800">
                <p className="text-xs text-slate-500 dark:text-slate-400">الرابط:</p>
                <p className="mt-1 break-all text-sm text-slate-800 dark:text-slate-100">{shareUrl}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={copyLink}>
                    {copied ? 'تم النسخ' : 'نسخ الرابط'}
                  </Button>
                  <a
                    href={shareUrl}
                    target="_blank"
                    rel="noreferrer"
                    className={buttonVariants('outline', 'sm')}
                  >
                    فتح
                  </a>
                </div>
                <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                  الرابط مؤقت وسيتم إيقافه تلقائيًا.
                </p>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}

