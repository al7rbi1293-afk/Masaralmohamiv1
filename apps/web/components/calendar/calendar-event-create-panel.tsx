'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

type MatterOption = {
  id: string;
  title: string;
};

type CalendarEventCreatePanelProps = {
  matters: MatterOption[];
};

export function CalendarEventCreatePanel({ matters }: CalendarEventCreatePanelProps) {
  const router = useRouter();
  const initialTimes = useMemo(() => buildInitialTimes(), []);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [matterId, setMatterId] = useState('');
  const [startAtLocal, setStartAtLocal] = useState(initialTimes.startAtLocal);
  const [endAtLocal, setEndAtLocal] = useState(initialTimes.endAtLocal);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSuccess('');

    const startAtIso = toIso(startAtLocal);
    const endAtIso = toIso(endAtLocal);

    if (!title.trim()) {
      setError('عنوان الموعد مطلوب.');
      return;
    }
    if (!startAtIso || !endAtIso) {
      setError('يرجى إدخال تاريخ بداية ونهاية صالحين.');
      return;
    }
    if (new Date(endAtIso).getTime() <= new Date(startAtIso).getTime()) {
      setError('وقت النهاية يجب أن يكون بعد وقت البداية.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/calendar/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          location: location.trim() || undefined,
          start_at: startAtIso,
          end_at: endAtIso,
          matter_id: matterId || undefined,
        }),
      });

      const json = (await response.json().catch(() => ({}))) as {
        message?: string;
        reminder_jobs_count?: number;
        reminder_warning?: string | null;
      };
      if (!response.ok) {
        setError(String(json.message ?? 'تعذر إنشاء الموعد.'));
        return;
      }

      setTitle('');
      setDescription('');
      setLocation('');
      setMatterId('');
      const nextTimes = buildInitialTimes();
      setStartAtLocal(nextTimes.startAtLocal);
      setEndAtLocal(nextTimes.endAtLocal);
      const scheduledCount = Number(json.reminder_jobs_count ?? 0);
      if (json.reminder_warning) {
        setSuccess(String(json.reminder_warning));
      } else if (scheduledCount > 0) {
        setSuccess(`تم إنشاء الموعد وجدولة ${scheduledCount} تنبيه بريدي.`);
      } else {
        setSuccess('تم إنشاء الموعد بنجاح.');
      }
      router.refresh();
    } catch {
      setError('تعذر إنشاء الموعد حاليًا. حاول مرة أخرى.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      {success ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200">
          {success}
        </p>
      ) : null}

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1 text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-200">
            العنوان <span className="text-red-600">*</span>
          </span>
          <input
            value={title}
            onChange={(nextEvent) => setTitle(nextEvent.target.value)}
            className="h-11 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
            placeholder="مثال: اجتماع مراجعة الملف"
            minLength={2}
            maxLength={200}
            required
          />
        </label>

        <label className="block space-y-1 text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-200">القضية (اختياري)</span>
          <select
            value={matterId}
            onChange={(nextEvent) => setMatterId(nextEvent.target.value)}
            className="h-11 w-full rounded-lg border border-brand-border bg-white px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="">بدون ربط بقضية</option>
            {matters.map((matter) => (
              <option key={matter.id} value={matter.id}>
                {matter.title}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1 text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-200">
            البداية <span className="text-red-600">*</span>
          </span>
          <input
            type="datetime-local"
            value={startAtLocal}
            onChange={(nextEvent) => setStartAtLocal(nextEvent.target.value)}
            className="h-11 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
            required
          />
        </label>

        <label className="block space-y-1 text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-200">
            النهاية <span className="text-red-600">*</span>
          </span>
          <input
            type="datetime-local"
            value={endAtLocal}
            onChange={(nextEvent) => setEndAtLocal(nextEvent.target.value)}
            className="h-11 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
            required
          />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1 text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-200">الموقع (اختياري)</span>
          <input
            value={location}
            onChange={(nextEvent) => setLocation(nextEvent.target.value)}
            className="h-11 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
            placeholder="المحكمة أو رابط الاجتماع"
            maxLength={200}
          />
        </label>

        <label className="block space-y-1 text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-200">الوصف (اختياري)</span>
          <textarea
            value={description}
            onChange={(nextEvent) => setDescription(nextEvent.target.value)}
            rows={3}
            className="w-full rounded-lg border border-brand-border px-3 py-2 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
            placeholder="ملاحظات مختصرة عن الموعد"
            maxLength={2000}
          />
        </label>
      </div>

      <div className="flex items-center justify-end">
        <Button type="submit" variant="primary" size="md" disabled={submitting}>
          {submitting ? 'جارٍ إنشاء الموعد...' : 'إنشاء موعد مع تنبيهات'}
        </Button>
      </div>
    </form>
  );
}

function buildInitialTimes() {
  const start = roundToNextHalfHour(new Date());
  const end = new Date(start.getTime() + 60 * 60 * 1000);

  return {
    startAtLocal: toLocalInputValue(start),
    endAtLocal: toLocalInputValue(end),
  };
}

function roundToNextHalfHour(value: Date) {
  const result = new Date(value);
  result.setSeconds(0, 0);

  const minutes = result.getMinutes();
  const roundedMinutes = minutes === 0 ? 30 : minutes <= 30 ? 30 : 60;
  result.setMinutes(roundedMinutes);
  if (roundedMinutes === 60) {
    result.setHours(result.getHours() + 1, 0, 0, 0);
  }

  return result;
}

function toLocalInputValue(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  const hour = String(value.getHours()).padStart(2, '0');
  const minute = String(value.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

function toIso(value: string) {
  const normalized = value.trim();
  if (!normalized) return '';

  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toISOString();
}
