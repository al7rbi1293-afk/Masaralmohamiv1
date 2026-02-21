import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { TasksTableClient } from '@/components/tasks/tasks-table-client';
import { listMatters } from '@/lib/matters';
import { listTasks, type TaskAssigneeFilter, type TaskDueFilter, type TaskPriority, type TaskStatus } from '@/lib/tasks';
import { getCurrentAuthUser } from '@/lib/supabase/auth-session';

type TasksPageProps = {
  searchParams?: {
    q?: string;
    status?: string;
    priority?: string;
    due?: string;
    assignee?: string;
    page?: string;
    error?: string;
    new?: string;
  };
};

const allowedStatuses: Array<TaskStatus | 'all'> = ['all', 'todo', 'doing', 'done', 'canceled'];
const allowedPriorities: Array<TaskPriority | 'all'> = ['all', 'low', 'medium', 'high'];
const allowedDue: TaskDueFilter[] = ['all', 'overdue', 'today', 'week'];
const allowedAssignee: TaskAssigneeFilter[] = ['any', 'me', 'unassigned'];

export default async function TasksPage({ searchParams }: TasksPageProps) {
  const q = (searchParams?.q ?? '').trim();

  const statusRaw = (searchParams?.status ?? 'all').trim();
  const status: TaskStatus | 'all' = allowedStatuses.includes(statusRaw as any) ? (statusRaw as any) : 'all';

  const priorityRaw = (searchParams?.priority ?? 'all').trim();
  const priority: TaskPriority | 'all' = allowedPriorities.includes(priorityRaw as any)
    ? (priorityRaw as any)
    : 'all';

  const dueRaw = (searchParams?.due ?? 'all').trim();
  const due: TaskDueFilter = allowedDue.includes(dueRaw as any) ? (dueRaw as any) : 'all';

  const assigneeRaw = (searchParams?.assignee ?? 'any').trim();
  const assignee: TaskAssigneeFilter = allowedAssignee.includes(assigneeRaw as any) ? (assigneeRaw as any) : 'any';

  const page = Math.max(1, Number(searchParams?.page ?? '1') || 1);
  const error = searchParams?.error ? safeDecode(searchParams.error) : '';
  const autoOpenCreate = (searchParams?.new ?? '').trim() === '1';

  let tasksResult: Awaited<ReturnType<typeof listTasks>>;
  let mattersResult: Awaited<ReturnType<typeof listMatters>>;
  let user: Awaited<ReturnType<typeof getCurrentAuthUser>>;

  try {
    [tasksResult, mattersResult, user] = await Promise.all([
      listTasks({
        q,
        status,
        priority,
        due,
        assignee,
        page,
        limit: 10,
      }),
      listMatters({
        status: 'all',
        page: 1,
        limit: 50,
      }),
      getCurrentAuthUser(),
    ]);
  } catch (fetchError) {
    const message =
      fetchError instanceof Error && fetchError.message ? fetchError.message : 'تعذر تحميل المهام.';

    return (
      <Card className="p-6">
        <h1 className="text-xl font-bold text-brand-navy dark:text-slate-100">المهام</h1>
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          {message}
        </p>
        <div className="mt-4">
          <Link href="/app" className={buttonVariants('outline', 'sm')}>
            العودة للوحة التحكم
          </Link>
        </div>
      </Card>
    );
  }

  if (!user) {
    return (
      <Card className="p-6">
        <EmptyState title="المهام" message="يرجى تسجيل الدخول للمتابعة." backHref="/signin" backLabel="تسجيل الدخول" />
      </Card>
    );
  }

  const totalPages = Math.max(1, Math.ceil(tasksResult.total / tasksResult.limit));
  const hasPrevious = tasksResult.page > 1;
  const hasNext = tasksResult.page < totalPages;

  const matters = mattersResult.data.map((matter) => ({ id: matter.id, title: matter.title }));
  const tasks = tasksResult.data.map((task) => ({
    id: task.id,
    title: task.title,
    description: task.description,
    matter_id: task.matter_id,
    assignee_id: task.assignee_id,
    due_at: task.due_at,
    priority: task.priority,
    status: task.status,
    updated_at: task.updated_at,
    matter: task.matter ? { id: task.matter.id, title: task.matter.title } : null,
  }));

  const previousQuery = buildQuery({
    q,
    status,
    priority,
    due,
    assignee,
    page: Math.max(1, tasksResult.page - 1),
  });

  const nextQuery = buildQuery({
    q,
    status,
    priority,
    due,
    assignee,
    page: Math.min(totalPages, tasksResult.page + 1),
  });

  return (
    <Card className="p-6">
      <div>
        <h1 className="text-xl font-bold text-brand-navy dark:text-slate-100">المهام</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          قائمة المهام مع فلاتر بسيطة حسب الحالة والأولوية والاستحقاق.
        </p>
      </div>

      {error ? (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </p>
      ) : null}

      <form className="mt-5 grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-[1fr_150px_150px_150px_150px_auto]">
        <label className="block">
          <span className="sr-only">بحث</span>
          <input
            name="q"
            defaultValue={q}
            placeholder="ابحث بعنوان المهمة أو الوصف..."
            className="h-11 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
          />
        </label>

        <label className="block">
          <span className="sr-only">الحالة</span>
          <select
            name="status"
            defaultValue={status}
            className="h-11 w-full rounded-lg border border-brand-border bg-white px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="all">كل الحالات</option>
            <option value="todo">للإنجاز</option>
            <option value="doing">قيد التنفيذ</option>
            <option value="done">تم</option>
            <option value="canceled">ملغي</option>
          </select>
        </label>

        <label className="block">
          <span className="sr-only">الأولوية</span>
          <select
            name="priority"
            defaultValue={priority}
            className="h-11 w-full rounded-lg border border-brand-border bg-white px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="all">كل الأولويات</option>
            <option value="low">منخفضة</option>
            <option value="medium">متوسطة</option>
            <option value="high">عالية</option>
          </select>
        </label>

        <label className="block">
          <span className="sr-only">الاستحقاق</span>
          <select
            name="due"
            defaultValue={due}
            className="h-11 w-full rounded-lg border border-brand-border bg-white px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="all">كل الاستحقاقات</option>
            <option value="overdue">متأخرة</option>
            <option value="today">اليوم</option>
            <option value="week">7 أيام</option>
          </select>
        </label>

        <label className="block">
          <span className="sr-only">المسند إليه</span>
          <select
            name="assignee"
            defaultValue={assignee}
            className="h-11 w-full rounded-lg border border-brand-border bg-white px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="any">الكل</option>
            <option value="me">لي</option>
            <option value="unassigned">غير مسند</option>
          </select>
        </label>

        <button type="submit" className={buttonVariants('outline', 'sm')}>
          فلترة
        </button>
      </form>

      <div className="mt-6">
        <TasksTableClient
          tasks={tasks}
          matters={matters}
          currentUserId={user.id}
          autoOpenCreate={autoOpenCreate}
        />
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600 dark:text-slate-300">
        <p>
          الصفحة {tasksResult.page} من {totalPages} ({tasksResult.total} مهمة)
        </p>
        <div className="flex items-center gap-2">
          <Link
            aria-disabled={!hasPrevious}
            href={{ pathname: '/app/tasks', query: previousQuery }}
            className={`${buttonVariants('outline', 'sm')} ${!hasPrevious ? 'pointer-events-none opacity-50' : ''}`}
          >
            السابق
          </Link>
          <Link
            aria-disabled={!hasNext}
            href={{ pathname: '/app/tasks', query: nextQuery }}
            className={`${buttonVariants('outline', 'sm')} ${!hasNext ? 'pointer-events-none opacity-50' : ''}`}
          >
            التالي
          </Link>
        </div>
      </div>
    </Card>
  );
}

function buildQuery(params: {
  q: string;
  status: TaskStatus | 'all';
  priority: TaskPriority | 'all';
  due: TaskDueFilter;
  assignee: TaskAssigneeFilter;
  page: number;
}) {
  const query: Record<string, string> = { page: String(params.page) };

  if (params.q) query.q = params.q;
  if (params.status !== 'all') query.status = params.status;
  if (params.priority !== 'all') query.priority = params.priority;
  if (params.due !== 'all') query.due = params.due;
  if (params.assignee !== 'any') query.assignee = params.assignee;

  return query;
}

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
