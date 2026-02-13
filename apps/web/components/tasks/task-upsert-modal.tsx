'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button, buttonVariants } from '@/components/ui/button';

type TaskPriority = 'low' | 'medium' | 'high';
type TaskStatus = 'todo' | 'doing' | 'done' | 'canceled';

export type TaskUpsertMatterOption = {
  id: string;
  title: string;
};

export type TaskUpsertInitialTask = {
  id: string;
  title: string;
  description: string | null;
  matter_id: string | null;
  assignee_id: string | null;
  due_at: string | null;
  priority: TaskPriority;
  status: TaskStatus;
};

type TaskUpsertModalProps = {
  open: boolean;
  mode: 'create' | 'edit';
  currentUserId: string;
  matters: TaskUpsertMatterOption[];
  fixedMatterId?: string | null;
  initialTask?: TaskUpsertInitialTask | null;
  onClose: () => void;
  onSuccess: (message: string) => void;
};

export function TaskUpsertModal({
  open,
  mode,
  currentUserId,
  matters,
  fixedMatterId = null,
  initialTask = null,
  onClose,
  onSuccess,
}: TaskUpsertModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [matterId, setMatterId] = useState<string>('');
  const [assignee, setAssignee] = useState<'me' | 'unassigned'>('me');
  const [lockedAssigneeId, setLockedAssigneeId] = useState<string | null>(null);
  const [dueAtLocal, setDueAtLocal] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [status, setStatus] = useState<TaskStatus>('todo');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const heading = useMemo(() => {
    return mode === 'create' ? 'مهمة جديدة' : 'تعديل المهمة';
  }, [mode]);

  useEffect(() => {
    if (!open) return;

    setError('');
    setBusy(false);

    if (mode === 'edit' && initialTask) {
      setTitle(initialTask.title ?? '');
      setDescription(initialTask.description ?? '');
      setMatterId(fixedMatterId ?? initialTask.matter_id ?? '');
      const isAssignedToOther =
        Boolean(initialTask.assignee_id) && initialTask.assignee_id !== currentUserId;
      setLockedAssigneeId(isAssignedToOther ? initialTask.assignee_id : null);
      setAssignee(initialTask.assignee_id === currentUserId ? 'me' : 'unassigned');
      setDueAtLocal(initialTask.due_at ? toDateTimeLocal(initialTask.due_at) : '');
      setPriority(initialTask.priority ?? 'medium');
      setStatus(initialTask.status ?? 'todo');
      return;
    }

    setTitle('');
    setDescription('');
    setMatterId(fixedMatterId ?? '');
    setAssignee('me');
    setLockedAssigneeId(null);
    setDueAtLocal('');
    setPriority('medium');
    setStatus('todo');
  }, [open, mode, initialTask, fixedMatterId]);

  if (!open) {
    return null;
  }

  async function submit() {
    setBusy(true);
    setError('');

    const trimmedTitle = title.trim();
    if (trimmedTitle.length < 2) {
      setBusy(false);
      setError('عنوان المهمة مطلوب ويجب أن لا يقل عن حرفين.');
      return;
    }

    const payload: any = {
      title: trimmedTitle,
      description: description.trim() || null,
      matter_id: fixedMatterId ? fixedMatterId : matterId.trim() || null,
      assignee_id: lockedAssigneeId ? lockedAssigneeId : assignee === 'me' ? currentUserId : null,
      due_at: dueAtLocal ? new Date(dueAtLocal).toISOString() : null,
      priority,
      status,
    };

    try {
      const response =
        mode === 'create'
          ? await fetch('/app/api/tasks/create', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            })
          : await fetch('/app/api/tasks/update', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                id: initialTask?.id,
                ...payload,
              }),
            });

      const json = (await response.json().catch(() => ({}))) as any;
      if (!response.ok) {
        setError(String(json?.error ?? 'تعذر الحفظ. حاول مرة أخرى.'));
        return;
      }

      onSuccess(mode === 'create' ? 'تم إنشاء المهمة.' : 'تم تحديث المهمة.');
      onClose();
    } catch {
      setError('تعذر الحفظ. حاول مرة أخرى.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-xl border border-brand-border bg-white p-5 shadow-panel dark:border-slate-700 dark:bg-slate-900"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-brand-navy dark:text-slate-100">{heading}</h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              أدخل تفاصيل المهمة ثم احفظها.
            </p>
          </div>
          <button type="button" className={buttonVariants('ghost', 'sm')} onClick={onClose}>
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
            <span className="font-medium text-slate-700 dark:text-slate-200">العنوان</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="h-11 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
              required
              minLength={2}
            />
          </label>

          <label className="block space-y-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">الوصف (اختياري)</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={4}
              className="w-full rounded-lg border border-brand-border px-3 py-2 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1 text-sm">
              <span className="font-medium text-slate-700 dark:text-slate-200">الاستحقاق (اختياري)</span>
              <input
                type="datetime-local"
                value={dueAtLocal}
                onChange={(event) => setDueAtLocal(event.target.value)}
                className="h-11 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
              />
            </label>

            <label className="block space-y-1 text-sm">
              <span className="font-medium text-slate-700 dark:text-slate-200">الأولوية</span>
              <select
                value={priority}
                onChange={(event) => setPriority(event.target.value as TaskPriority)}
                className="h-11 w-full rounded-lg border border-brand-border bg-white px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
              >
                <option value="low">منخفضة</option>
                <option value="medium">متوسطة</option>
                <option value="high">عالية</option>
              </select>
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1 text-sm">
              <span className="font-medium text-slate-700 dark:text-slate-200">الحالة</span>
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value as TaskStatus)}
                className="h-11 w-full rounded-lg border border-brand-border bg-white px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
              >
                <option value="todo">للإنجاز</option>
                <option value="doing">قيد التنفيذ</option>
                <option value="done">تم</option>
                <option value="canceled">ملغي</option>
              </select>
            </label>

            <label className="block space-y-1 text-sm">
              <span className="font-medium text-slate-700 dark:text-slate-200">المسند إليه</span>
              {lockedAssigneeId ? (
                <div className="rounded-lg border border-brand-border bg-brand-background px-3 py-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  عضو الفريق (غير قابل للتغيير من هذا النموذج)
                </div>
              ) : (
                <select
                  value={assignee}
                  onChange={(event) => setAssignee(event.target.value as 'me' | 'unassigned')}
                  className="h-11 w-full rounded-lg border border-brand-border bg-white px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
                >
                  <option value="me">لي</option>
                  <option value="unassigned">غير مسند</option>
                </select>
              )}
            </label>
          </div>

          {!fixedMatterId ? (
            <label className="block space-y-1 text-sm">
              <span className="font-medium text-slate-700 dark:text-slate-200">ربط بقضية (اختياري)</span>
              <select
                value={matterId}
                onChange={(event) => setMatterId(event.target.value)}
                className="h-11 w-full rounded-lg border border-brand-border bg-white px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
              >
                <option value="">بدون ربط</option>
                {matters.map((matter) => (
                  <option key={matter.id} value={matter.id}>
                    {matter.title}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              سيتم ربط المهمة تلقائيًا بهذه القضية.
            </p>
          )}

          <div className="flex flex-wrap gap-3 pt-1">
            <Button type="button" variant="primary" size="md" disabled={busy} onClick={submit}>
              {busy ? 'جارٍ الحفظ...' : 'حفظ'}
            </Button>
            <Button type="button" variant="outline" size="md" disabled={busy} onClick={onClose}>
              إلغاء
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function toDateTimeLocal(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');

  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}
