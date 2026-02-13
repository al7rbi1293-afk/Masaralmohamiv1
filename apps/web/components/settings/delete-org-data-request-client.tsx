'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

export function DeleteOrgDataRequestClient() {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/app/api/privacy/delete-request', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: note.trim() || undefined }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; message?: string; error?: string }
        | null;

      if (!response.ok) {
        setError(payload?.error ?? 'تعذر إرسال الطلب. حاول مرة أخرى.');
        return;
      }

      setSuccess(payload?.message ?? 'تم استلام الطلب.');
      setNote('');
    } catch {
      setError('تعذر الاتصال بالخدمة. حاول مرة أخرى.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {success ? (
        <p
          role="status"
          aria-live="polite"
          className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300"
        >
          {success}
        </p>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300"
        >
          {error}
        </p>
      ) : null}

      <label className="block space-y-1 text-sm">
        <span className="font-medium text-slate-700 dark:text-slate-200">ملاحظة (اختياري)</span>
        <textarea
          rows={4}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="مثال: الرجاء حذف جميع بيانات المكتب بعد الانتهاء من التحقق."
          className="w-full rounded-lg border border-brand-border px-3 py-2 text-sm outline-none ring-brand-emerald transition focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
        />
      </label>

      <Button
        type="button"
        variant="outline"
        disabled={busy}
        onClick={() => setConfirmOpen(true)}
      >
        {busy ? 'جارٍ الإرسال...' : 'طلب حذف بيانات المكتب'}
      </Button>

      <ConfirmDialog
        open={confirmOpen}
        title="تأكيد طلب حذف البيانات"
        message="سيتم تنفيذ هذا الطلب يدويًا بعد التحقق من صلاحية المالك. هل تريد المتابعة؟"
        confirmLabel="إرسال الطلب"
        destructive
        busy={busy}
        onCancel={() => {
          if (!busy) setConfirmOpen(false);
        }}
        onConfirm={async () => {
          await submit();
          setConfirmOpen(false);
        }}
      />
    </div>
  );
}
