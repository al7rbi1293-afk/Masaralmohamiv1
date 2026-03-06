'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { TaskUpsertModal, type TaskUpsertInitialTask } from './task-upsert-modal';

type TaskPriority = 'low' | 'medium' | 'high';
type TaskStatus = 'todo' | 'doing' | 'done' | 'canceled';

export type MatterTaskItem = {
  id: string;
  title: string;
  description: string | null;
  matter_id: string | null;
  assignee_id: string | null;
  due_at: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  is_archived: boolean;
};

type MatterTasksClientProps = {
  matterId: string;
  tasks: MatterTaskItem[];
  currentUserId: string;
};

const statusLabel: Record<TaskStatus, string> = {
  todo: 'للإنجاز',
  doing: 'قيد التنفيذ',
  done: 'تم',
  canceled: 'ملغي',
};

const statusVariant: Record<TaskStatus, 'default' | 'success' | 'warning' | 'danger'> = {
  todo: 'default',
  doing: 'warning',
  done: 'success',
  canceled: 'danger',
};

export function MatterTasksClient({ matterId, tasks, currentUserId }: MatterTasksClientProps) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [selectedTask, setSelectedTask] = useState<TaskUpsertInitialTask | null>(null);
  const [busyTaskId, setBusyTaskId] = useState<string>('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [confirmAction, setConfirmAction] = useState<{
    taskId: string;
    mode: 'archive' | 'restore' | 'delete';
  } | null>(null);

  const now = useMemo(() => Date.now(), []);

  function openCreate() {
    setSelectedTask(null);
    setModalMode('create');
    setModalOpen(true);
    setError('');
    setMessage('');
  }

  function openEdit(task: MatterTaskItem) {
    setSelectedTask({
      id: task.id,
      title: task.title,
      description: task.description,
      matter_id: task.matter_id,
      assignee_id: task.assignee_id,
      due_at: task.due_at,
      priority: task.priority,
      status: task.status,
    });
    setModalMode('edit');
    setModalOpen(true);
    setError('');
    setMessage('');
  }

  async function changeStatus(taskId: string, status: TaskStatus) {
    setBusyTaskId(taskId);
    setError('');
    setMessage('');

    try {
      const response = await fetch('/app/api/tasks/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: taskId, status }),
      });
      const json = (await response.json().catch(() => ({}))) as any;
      if (!response.ok) {
        setError(String(json?.error ?? 'تعذر تغيير حالة المهمة.'));
        return;
      }

      setMessage('تم تغيير حالة المهمة.');
      router.refresh();
    } catch {
      setError('تعذر تغيير حالة المهمة.');
    } finally {
      setBusyTaskId('');
    }
  }

  async function changeArchive(taskId: string, archived: boolean) {
    setBusyTaskId(taskId);
    setError('');
    setMessage('');

    try {
      const response = await fetch('/app/api/tasks/archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: taskId, archived }),
      });
      const json = (await response.json().catch(() => ({}))) as any;
      if (!response.ok) {
        setError(String(json?.error ?? 'تعذر تحديث أرشفة المهمة.'));
        return;
      }

      setMessage(archived ? 'تمت أرشفة المهمة.' : 'تمت استعادة المهمة.');
      router.refresh();
    } catch {
      setError(archived ? 'تعذر أرشفة المهمة.' : 'تعذر استعادة المهمة.');
    } finally {
      setBusyTaskId('');
    }
  }

  async function removeTask(taskId: string) {
    setBusyTaskId(taskId);
    setError('');
    setMessage('');

    try {
      const response = await fetch('/app/api/tasks/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: taskId }),
      });
      const json = (await response.json().catch(() => ({}))) as any;
      if (!response.ok) {
        setError(String(json?.error ?? 'تعذر حذف المهمة.'));
        return;
      }

      setMessage('تم حذف المهمة نهائيًا.');
      router.refresh();
    } catch {
      setError('تعذر حذف المهمة.');
    } finally {
      setBusyTaskId('');
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-brand-navy dark:text-slate-100">مهام القضية</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">تابع المهام المرتبطة بهذه القضية.</p>
        </div>
        <Button type="button" variant="primary" size="sm" onClick={openCreate}>
          إضافة مهمة للقضية
        </Button>
      </div>

      {message ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200">
          {message}
        </p>
      ) : null}

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </p>
      ) : null}

      {!tasks.length ? (
        <div className="rounded-lg border border-brand-border p-6 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">
          لا توجد مهام مرتبطة بهذه القضية.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-brand-border dark:border-slate-700">
          <table className="min-w-full text-sm">
            <thead className="border-b border-brand-border text-slate-600 dark:border-slate-700 dark:text-slate-300">
              <tr>
                <th className="px-3 py-3 text-start font-medium">المهمة</th>
                <th className="px-3 py-3 text-start font-medium">الاستحقاق</th>
                <th className="px-3 py-3 text-start font-medium">الحالة</th>
                <th className="px-3 py-3 text-start font-medium">المسند إليه</th>
                <th className="px-3 py-3 text-start font-medium">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-border dark:divide-slate-800">
              {tasks.map((task) => {
                const due = task.due_at ? new Date(task.due_at) : null;
                const isOverdue = Boolean(due && due.getTime() < now && task.status !== 'done' && task.status !== 'canceled');

                return (
                  <tr key={task.id} className="hover:bg-brand-background/60 dark:hover:bg-slate-800/60">
                    <td className="px-3 py-3 font-medium text-brand-navy dark:text-slate-100">{task.title}</td>
                    <td className="px-3 py-3 text-slate-700 dark:text-slate-200">
                      {task.due_at ? (
                        <span className={isOverdue ? 'text-red-700 dark:text-red-300' : ''}>
                          {new Date(task.due_at).toLocaleString('ar-SA')}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Badge variant={statusVariant[task.status]}>{statusLabel[task.status]}</Badge>
                        {task.is_archived ? <Badge variant="warning">مؤرشفة</Badge> : null}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-slate-700 dark:text-slate-200">
                      {task.assignee_id ? (task.assignee_id === currentUserId ? 'أنا' : 'عضو الفريق') : '—'}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className={buttonVariants('outline', 'sm')}
                          disabled={busyTaskId === task.id}
                          onClick={() => openEdit(task)}
                        >
                          عرض/تعديل
                        </button>
                        <button
                          type="button"
                          className={buttonVariants('outline', 'sm')}
                          disabled={busyTaskId === task.id || task.is_archived || task.status === 'done' || task.status === 'canceled'}
                          onClick={() => changeStatus(task.id, 'done')}
                        >
                          تم
                        </button>
                        <button
                          type="button"
                          className={buttonVariants('outline', 'sm')}
                          disabled={busyTaskId === task.id || task.is_archived || task.status === 'canceled'}
                          onClick={() => changeStatus(task.id, 'canceled')}
                        >
                          إلغاء
                        </button>
                        <button
                          type="button"
                          className={buttonVariants('outline', 'sm')}
                          disabled={busyTaskId === task.id}
                          onClick={() => setConfirmAction({ taskId: task.id, mode: task.is_archived ? 'restore' : 'archive' })}
                        >
                          {task.is_archived ? 'استعادة' : 'أرشفة'}
                        </button>
                        <button
                          type="button"
                          className={buttonVariants('outline', 'sm')}
                          disabled={busyTaskId === task.id}
                          onClick={() => setConfirmAction({ taskId: task.id, mode: 'delete' })}
                        >
                          حذف
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <TaskUpsertModal
        open={modalOpen}
        mode={modalMode}
        currentUserId={currentUserId}
        matters={[]}
        fixedMatterId={matterId}
        initialTask={selectedTask}
        onClose={() => setModalOpen(false)}
        onSuccess={(msg) => {
          setMessage(msg);
          setError('');
          router.refresh();
        }}
      />

      <ConfirmDialog
        open={Boolean(confirmAction)}
        title={
          confirmAction?.mode === 'delete'
            ? 'حذف المهمة نهائيًا'
            : confirmAction?.mode === 'restore'
              ? 'استعادة المهمة'
              : 'أرشفة المهمة'
        }
        message={
          confirmAction?.mode === 'delete'
            ? 'سيتم حذف المهمة نهائيًا ولا يمكن التراجع عن هذا الإجراء.'
            : confirmAction?.mode === 'restore'
              ? 'هل تريد استعادة هذه المهمة إلى القائمة النشطة؟'
              : 'هل تريد أرشفة هذه المهمة؟ يمكنك استعادتها لاحقًا.'
        }
        confirmLabel={
          confirmAction?.mode === 'delete'
            ? 'حذف نهائي'
            : confirmAction?.mode === 'restore'
              ? 'استعادة'
              : 'أرشفة'
        }
        destructive={confirmAction?.mode !== 'restore'}
        onCancel={() => setConfirmAction(null)}
        onConfirm={async () => {
          const pending = confirmAction;
          setConfirmAction(null);
          if (!pending) return;
          if (pending.mode === 'delete') {
            await removeTask(pending.taskId);
            return;
          }
          await changeArchive(pending.taskId, pending.mode === 'archive');
        }}
      />
    </section>
  );
}
