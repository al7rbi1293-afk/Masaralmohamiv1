'use client';

import * as React from 'react';

interface SwitchProps {
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
    disabled?: boolean;
}

export function Switch({ checked, onCheckedChange, disabled }: SwitchProps) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            disabled={disabled}
            onClick={() => onCheckedChange(!checked)}
            className={`
        peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-emerald focus-visible:ring-offset-2
        ${checked ? 'bg-brand-emerald' : 'bg-slate-200 dark:bg-slate-700'}
        ${disabled ? 'cursor-not-allowed opacity-50' : ''}
      `}
        >
            <span
                className={`
          pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform dark:bg-slate-950
          ${checked ? 'translate-x-5' : 'translate-x-0'}
        `}
            />
        </button>
    );
}
