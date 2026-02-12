import Link from 'next/link';
import { createSupabaseServerRlsClient } from '@/lib/supabase/server';
import { getCurrentOrgIdForUser } from '@/lib/org';
import { buttonVariants } from '@/components/ui/button';
import { createTaskAction, updateTaskStatusAction } from './actions';

type TasksPageProps = {
  searchParams?: {
    status?: string;
    matter?: string;
    error?: string;
    success?: string;
  };
};

type TaskRow = {
  id: string;
  title: string;
  status: 'todo' | 'doing' | 'done' | 'canceled';
  priority: 'low' | 'medium' | 'high';
  due_at: string | null;
  matter_id: string | null;
  created_at: string;
  matter?: Array<{ title: string }> | null;
};

type MatterOption = { id: string; title: string };

const statusLabels: Record<TaskRow['status'], string> = {
  todo: 'قائمة',
  doing: 'قيد التنفيذ',
  done: 'منجزة',
  canceled: 'ملغاة',
};

const priorityLabels: Record<TaskRow['priority'], string> = {
  low: 'منخفضة',
  medium: 'متوسطة',
  high: 'عالية',
};

export default async function TasksPage({ searchParams }: TasksPageProps) {
  const orgId = await getCurrentOrgIdForUser();
  if (!orgId) {
    return (
      <section className="rounded-lg border border-brand-border bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
        <h1 className="text-xl font-bold text-brand-navy dark:text-slate-100">المهام</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          لا يوجد مكتب مفعّل لهذا الحساب بعد.
        </p>
      </section>
    );
  }

  const status = (searchParams?.status ?? '').trim();
  const matterFilter = (searchParams?.matter ?? '').trim();
  const bannerError = searchParams?.error ? safeDecode(searchParams.error) : null;
  const success = searchParams?.success ? true : false;

  const supabase = createSupabaseServerRlsClient();
  const { data: mattersData } = await supabase
    .from('matters')
    .select('id, title')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(200);

  const matters = (mattersData as MatterOption[] | null) ?? [];

  let query = supabase
    .from('tasks')
    .select('id, title, status, priority, due_at, matter_id, created_at, matter:matters(title)')
    .eq('org_id', orgId)
    .order('due_at', { ascending: true })
    .order('created_at', { ascending: false })
    .limit(100);

  if (status) {
    query = query.eq('status', status);
  }

  if (matterFilter) {
    query = query.eq('matter_id', matterFilter);
  }

  const { data, error } = await query;
  const tasks = (data as TaskRow[] | null) ?? [];

  return (
    <section className="rounded-lg border border-brand-border bg-white p-6 shadow-panel dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-brand-navy dark:text-slate-100">المهام</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            أنشئ مهام وربطها بقضية مع تواريخ استحقاق.
          </p>
        </div>
      </div>

      {bannerError ? (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          {bannerError}
        </p>
      ) : null}

      {success ? (
        <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200">
          تم حفظ التغييرات.
        </p>
      ) : null}

      <form
        action={createTaskAction}
        className="mt-6 grid gap-3 rounded-lg border border-brand-border bg-brand-background p-4 dark:border-slate-700 dark:bg-slate-800 sm:grid-cols-2"
      >
        <label className="block space-y-1 text-sm sm:col-span-2">
          <span className="font-medium text-slate-700 dark:text-slate-200">عنوان المهمة</span>
          <input
            required
            name="title"
            className="h-11 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
          />
        </label>

        <label className="block space-y-1 text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-200">القضية (اختياري)</span>
          <select
            name="matter_id"
            defaultValue={matterFilter}
            className="h-11 w-full rounded-lg border border-brand-border bg-white px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="">بدون ربط</option>
            {matters.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-1 text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-200">تاريخ الاستحقاق</span>
          <input
            name="due_at"
            type="datetime-local"
            className="h-11 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
          />
        </label>

        <label className="block space-y-1 text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-200">الأولوية</span>
          <select
            name="priority"
            defaultValue="medium"
            className="h-11 w-full rounded-lg border border-brand-border bg-white px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="low">منخفضة</option>
            <option value="medium">متوسطة</option>
            <option value="high">عالية</option>
          </select>
        </label>

        <label className="block space-y-1 text-sm sm:col-span-2">
          <span className="font-medium text-slate-700 dark:text-slate-200">وصف (اختياري)</span>
          <textarea
            name="description"
            rows={3}
            className="w-full rounded-lg border border-brand-border px-3 py-2 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
          />
        </label>

        <button type="submit" className={buttonVariants('primary', 'sm')}>
          إضافة مهمة
        </button>
      </form>

      <form className="mt-5 grid gap-3 sm:grid-cols-[220px_1fr_auto]">
        <label className="block">
          <span className="sr-only">الحالة</span>
          <select
            name="status"
            defaultValue={status}
            className="h-11 w-full rounded-lg border border-brand-border bg-white px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="">كل الحالات</option>
            <option value="todo">قائمة</option>
            <option value="doing">قيد التنفيذ</option>
            <option value="done">منجزة</option>
            <option value="canceled">ملغاة</option>
          </select>
        </label>

        <label className="block">
          <span className="sr-only">القضية</span>
          <select
            name="matter"
            defaultValue={matterFilter}
            className="h-11 w-full rounded-lg border border-brand-border bg-white px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="">كل القضايا</option>
            {matters.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title}
              </option>
            ))}
          </select>
        </label>

        <button type="submit" className={buttonVariants('outline', 'sm')}>
          تطبيق
        </button>
      </form>

      {error ? (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          تعذر تحميل المهام. {error.message}
        </p>
      ) : null}

      <div className="mt-5 space-y-3">
        {tasks.length ? (
          tasks.map((task) => (
            <article key={task.id} className="rounded-lg border border-brand-border p-4 text-sm dark:border-slate-700">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-brand-navy dark:text-slate-100">{task.title}</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {priorityLabels[task.priority]} • {statusLabels[task.status]}
                    {task.matter?.[0]?.title ? ` • ${task.matter[0].title}` : ''}
                  </p>
                  {task.due_at ? (
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      الاستحقاق: {new Date(task.due_at).toLocaleString('ar-SA')}
                    </p>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-2">
                  {task.status !== 'done' ? (
                    <form action={async () => updateTaskStatusAction(task.id, 'done')}>
                      <button type="submit" className={buttonVariants('primary', 'sm')}>
                        تم
                      </button>
                    </form>
                  ) : (
                    <form action={async () => updateTaskStatusAction(task.id, 'todo')}>
                      <button type="submit" className={buttonVariants('outline', 'sm')}>
                        إعادة فتح
                      </button>
                    </form>
                  )}

                  {task.status !== 'canceled' ? (
                    <form action={async () => updateTaskStatusAction(task.id, 'canceled')}>
                      <button type="submit" className={buttonVariants('outline', 'sm')}>
                        إلغاء
                      </button>
                    </form>
                  ) : null}

                  {task.matter_id ? (
                    <Link href={`/app/matters/${task.matter_id}?tab=tasks`} className={buttonVariants('outline', 'sm')}>
                      فتح القضية
                    </Link>
                  ) : null}
                </div>
              </div>
            </article>
          ))
        ) : (
          <p className="text-sm text-slate-600 dark:text-slate-300">لا توجد مهام بعد.</p>
        )}
      </div>
    </section>
  );
}

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
