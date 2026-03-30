import type { ReactNode } from 'react';
import { buttonVariants } from '@/components/ui/button';

export function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/50">
      <p className="mb-1 text-sm text-slate-500 dark:text-slate-400">{label}</p>
      <p className="font-medium text-slate-900 dark:text-slate-100">{value}</p>
    </div>
  );
}

export function ActionCard({
  icon,
  title,
  description,
  tone,
  onClick,
  disabled,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  tone: 'emerald' | 'amber' | 'red' | 'slate';
  onClick: () => void;
  disabled?: boolean;
}) {
  const toneClassMap = {
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-900/30 dark:bg-emerald-950/20 dark:text-emerald-300 dark:hover:bg-emerald-900/30',
    amber: 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-300 dark:hover:bg-amber-900/30',
    red: 'border-red-200 bg-red-50 text-red-800 hover:bg-red-100 dark:border-red-900/30 dark:bg-red-950/20 dark:text-red-300 dark:hover:bg-red-900/30',
    slate: 'border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-200 dark:hover:bg-slate-800',
  } as const;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-full rounded-xl border p-4 text-start transition ${toneClassMap[tone]} disabled:cursor-not-allowed disabled:opacity-60`}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5">{icon}</div>
        <div>
          <p className="font-semibold">{title}</p>
          <p className="mt-1 text-sm leading-6 opacity-90">{description}</p>
        </div>
      </div>
    </button>
  );
}

export function ModalShell({
  title,
  description,
  children,
  onClose,
}: {
  title: string;
  description: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="mobile-modal-panel w-full max-w-xl rounded-xl border border-brand-border bg-white p-4 shadow-panel sm:p-5 dark:border-slate-700 dark:bg-slate-900"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-brand-navy dark:text-slate-100">{title}</h3>
            <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-300">{description}</p>
          </div>
          <button type="button" className={buttonVariants('ghost', 'sm')} onClick={onClose}>
            إغلاق
          </button>
        </div>
        <div className="mt-5">{children}</div>
      </div>
    </div>
  );
}

export function FormField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">{label}</span>
      {children}
    </label>
  );
}
