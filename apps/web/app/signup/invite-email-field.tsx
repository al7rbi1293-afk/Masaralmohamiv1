'use client';

import { useMemo, useState } from 'react';

type InviteEmailFieldProps = {
  invitedEmail: string;
};

export function InviteEmailField({ invitedEmail }: InviteEmailFieldProps) {
  const [value, setValue] = useState(invitedEmail);

  const invitedNormalized = useMemo(() => invitedEmail.trim().toLowerCase(), [invitedEmail]);
  const currentNormalized = useMemo(() => value.trim().toLowerCase(), [value]);
  const mismatch =
    Boolean(invitedNormalized) && Boolean(currentNormalized) && currentNormalized !== invitedNormalized;

  return (
    <label className="block space-y-1 text-sm">
      <span className="font-medium text-slate-700 dark:text-slate-200">البريد الإلكتروني</span>
      <input
        required
        name="email"
        type="email"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="h-11 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
      />

      <p className="text-xs text-slate-500 dark:text-slate-400">
        يجب استخدام البريد المدعو: <span className="font-medium">{invitedEmail}</span>
      </p>

      {mismatch ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
          تنبيه: البريد المدخل مختلف عن البريد المدعو. قد لا تتمكن من قبول الدعوة لاحقًا.
        </p>
      ) : null}
    </label>
  );
}

