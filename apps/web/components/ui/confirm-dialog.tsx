'use client';

import { Button, buttonVariants } from '@/components/ui/button';

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'تأكيد',
  cancelLabel = 'إلغاء',
  destructive = false,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={() => {
        if (!busy) onCancel();
      }}
    >
      <div
        className="w-full max-w-lg rounded-xl border border-brand-border bg-white p-5 shadow-panel dark:border-slate-700 dark:bg-slate-900"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-brand-navy dark:text-slate-100">{title}</h3>
            <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-300">{message}</p>
          </div>
          <button
            type="button"
            className={buttonVariants('ghost', 'sm')}
            onClick={() => onCancel()}
            disabled={busy}
          >
            إغلاق
          </button>
        </div>

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" size="md" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </Button>
          <button
            type="button"
            className={`${buttonVariants('primary', 'md')} ${
              destructive ? 'bg-red-600 hover:bg-red-700 focus-visible:ring-red-500' : ''
            }`}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'جارٍ التنفيذ...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

