import Link from 'next/link';
import { notFound } from 'next/navigation';
import { buttonVariants } from '@/components/ui/button';
import { createSupabaseServerRlsClient } from '@/lib/supabase/server';
import { getCurrentOrgIdForUser } from '@/lib/org';
import {
  addMatterEventAction,
  addMatterTaskAction,
  updateMatterAction,
} from '../actions';

type MatterDetailsPageProps = {
  params: { id: string };
  searchParams?: { tab?: string; error?: string; success?: string };
};

type MatterRow = {
  id: string;
  title: string;
  status: 'new' | 'in_progress' | 'on_hold' | 'closed' | 'archived';
  summary: string | null;
  is_private: boolean;
  client_id: string;
  created_at: string;
  updated_at: string;
};

type ClientOption = { id: string; name: string };
type EventRow = { id: string; type: string; note: string | null; event_date: string | null; created_at: string };
type TaskRow = { id: string; title: string; status: string; due_at: string | null; priority: string; created_at: string };
type DocRow = { id: string; title: string; folder: string; created_at: string };
type InvoiceRow = { id: string; number: string; status: string; total: string; issued_at: string };

const statusLabels: Record<MatterRow['status'], string> = {
  new: 'جديدة',
  in_progress: 'قيد العمل',
  on_hold: 'معلقة',
  closed: 'مغلقة',
  archived: 'مؤرشفة',
};

const eventTypeLabels: Record<string, string> = {
  hearing: 'جلسة',
  call: 'اتصال',
  note: 'ملاحظة',
  email: 'بريد',
  meeting: 'اجتماع',
  other: 'أخرى',
};

export default async function MatterDetailsPage({ params, searchParams }: MatterDetailsPageProps) {
  const orgId = await getCurrentOrgIdForUser();
  if (!orgId) {
    notFound();
  }

  const tab = (searchParams?.tab ?? 'summary').toLowerCase();
  const bannerError = searchParams?.error ? safeDecode(searchParams.error) : null;
  const success = searchParams?.success ? true : false;

  const supabase = createSupabaseServerRlsClient();
  const { data: matterData, error: matterError } = await supabase
    .from('matters')
    .select('id, title, status, summary, is_private, client_id, created_at, updated_at')
    .eq('org_id', orgId)
    .eq('id', params.id)
    .maybeSingle();

  if (matterError || !matterData) {
    notFound();
  }

  const matter = matterData as MatterRow;

  const { data: clientData } = await supabase
    .from('clients')
    .select('id, name')
    .eq('org_id', orgId)
    .eq('id', matter.client_id)
    .maybeSingle();

  const client = (clientData as ClientOption | null) ?? null;

  const { data: clientsData } = await supabase
    .from('clients')
    .select('id, name')
    .eq('org_id', orgId)
    .eq('status', 'active')
    .order('name', { ascending: true })
    .limit(200);

  const clients = (clientsData as ClientOption[] | null) ?? [];

  const [events, tasks, documents, invoices] = await Promise.all([
    tab === 'timeline'
      ? supabase
          .from('matter_events')
          .select('id, type, note, event_date, created_at')
          .eq('org_id', orgId)
          .eq('matter_id', matter.id)
          .order('created_at', { ascending: false })
          .limit(50)
          .then((r) => (r.data as EventRow[] | null) ?? [])
      : Promise.resolve([] as EventRow[]),
    tab === 'tasks'
      ? supabase
          .from('tasks')
          .select('id, title, status, due_at, priority, created_at')
          .eq('org_id', orgId)
          .eq('matter_id', matter.id)
          .order('created_at', { ascending: false })
          .limit(50)
          .then((r) => (r.data as TaskRow[] | null) ?? [])
      : Promise.resolve([] as TaskRow[]),
    tab === 'documents'
      ? supabase
          .from('documents')
          .select('id, title, folder, created_at')
          .eq('org_id', orgId)
          .eq('matter_id', matter.id)
          .order('created_at', { ascending: false })
          .limit(50)
          .then((r) => (r.data as DocRow[] | null) ?? [])
      : Promise.resolve([] as DocRow[]),
    tab === 'billing'
      ? supabase
          .from('invoices')
          .select('id, number, status, total, issued_at')
          .eq('org_id', orgId)
          .eq('matter_id', matter.id)
          .order('issued_at', { ascending: false })
          .limit(50)
          .then((r) => (r.data as InvoiceRow[] | null) ?? [])
      : Promise.resolve([] as InvoiceRow[]),
  ]);

  const tabs = [
    { key: 'summary', label: 'الملخص' },
    { key: 'timeline', label: 'التسلسل الزمني' },
    { key: 'tasks', label: 'المهام' },
    { key: 'documents', label: 'المستندات' },
    { key: 'billing', label: 'الفوترة' },
  ];

  return (
    <section className="rounded-lg border border-brand-border bg-white p-6 shadow-panel dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-brand-navy dark:text-slate-100">{matter.title}</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            {client?.name ?? '—'} • {statusLabels[matter.status]} • {matter.is_private ? 'خاص' : 'عام'}
          </p>
        </div>
        <Link href="/app/matters" className={buttonVariants('outline', 'sm')}>
          رجوع
        </Link>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={{ pathname: `/app/matters/${matter.id}`, query: { tab: t.key } }}
            className={
              tab === t.key
                ? buttonVariants('primary', 'sm')
                : buttonVariants('outline', 'sm')
            }
          >
            {t.label}
          </Link>
        ))}
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

      {tab === 'summary' ? (
        <form
          action={async (formData) => updateMatterAction(matter.id, formData)}
          className="mt-6 grid gap-4 sm:grid-cols-2"
        >
          <label className="block space-y-1 text-sm sm:col-span-2">
            <span className="font-medium text-slate-700 dark:text-slate-200">العميل</span>
            <select
              required
              name="client_id"
              defaultValue={matter.client_id}
              className="h-11 w-full rounded-lg border border-brand-border bg-white px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
            >
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1 text-sm sm:col-span-2">
            <span className="font-medium text-slate-700 dark:text-slate-200">العنوان</span>
            <input
              required
              name="title"
              defaultValue={matter.title}
              className="h-11 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
            />
          </label>

          <label className="block space-y-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">الحالة</span>
            <select
              name="status"
              defaultValue={matter.status}
              className="h-11 w-full rounded-lg border border-brand-border bg-white px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
            >
              <option value="new">جديدة</option>
              <option value="in_progress">قيد العمل</option>
              <option value="on_hold">معلقة</option>
              <option value="closed">مغلقة</option>
              <option value="archived">مؤرشفة</option>
            </select>
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="is_private"
              defaultChecked={matter.is_private}
              className="h-4 w-4 rounded border-brand-border text-brand-emerald focus:ring-brand-emerald"
            />
            <span className="text-slate-700 dark:text-slate-200">قضية خاصة</span>
          </label>

          <label className="block space-y-1 text-sm sm:col-span-2">
            <span className="font-medium text-slate-700 dark:text-slate-200">ملخص</span>
            <textarea
              name="summary"
              rows={6}
              defaultValue={matter.summary ?? ''}
              className="w-full rounded-lg border border-brand-border px-3 py-2 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
            />
          </label>

          <div className="flex flex-wrap gap-3 sm:col-span-2">
            <button type="submit" className={buttonVariants('primary', 'md')}>
              حفظ
            </button>
            <Link href={{ pathname: `/app/matters/${matter.id}`, query: { tab: 'timeline' } }} className={buttonVariants('outline', 'md')}>
              عرض التسلسل الزمني
            </Link>
          </div>
        </form>
      ) : null}

      {tab === 'timeline' ? (
        <div className="mt-6 space-y-5">
          <form
            action={async (formData) => addMatterEventAction(matter.id, formData)}
            className="grid gap-3 rounded-lg border border-brand-border bg-brand-background p-4 dark:border-slate-700 dark:bg-slate-800"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1 text-sm">
                <span className="font-medium text-slate-700 dark:text-slate-200">نوع الحدث</span>
                <select
                  name="type"
                  defaultValue="note"
                  className="h-11 w-full rounded-lg border border-brand-border bg-white px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
                >
                  <option value="note">ملاحظة</option>
                  <option value="hearing">جلسة</option>
                  <option value="call">اتصال</option>
                  <option value="email">بريد</option>
                  <option value="meeting">اجتماع</option>
                  <option value="other">أخرى</option>
                </select>
              </label>

              <label className="block space-y-1 text-sm">
                <span className="font-medium text-slate-700 dark:text-slate-200">تاريخ (اختياري)</span>
                <input
                  name="event_date"
                  type="datetime-local"
                  className="h-11 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
                />
              </label>
            </div>

            <label className="block space-y-1 text-sm">
              <span className="font-medium text-slate-700 dark:text-slate-200">ملاحظة</span>
              <textarea
                name="note"
                rows={4}
                className="w-full rounded-lg border border-brand-border px-3 py-2 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
              />
            </label>

            <button type="submit" className={buttonVariants('primary', 'sm')}>
              إضافة حدث
            </button>
          </form>

          <div className="space-y-3">
            {events.length ? (
              events.map((event) => (
                <article
                  key={event.id}
                  className="rounded-lg border border-brand-border p-4 text-sm dark:border-slate-700"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium text-brand-navy dark:text-slate-100">
                      {eventTypeLabels[event.type] ?? event.type}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {new Date(event.created_at).toLocaleString('ar-SA')}
                    </p>
                  </div>
                  {event.note ? (
                    <p className="mt-2 whitespace-pre-wrap text-slate-700 dark:text-slate-200">{event.note}</p>
                  ) : null}
                  {event.event_date ? (
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                      التاريخ: {new Date(event.event_date).toLocaleString('ar-SA')}
                    </p>
                  ) : null}
                </article>
              ))
            ) : (
              <p className="text-sm text-slate-600 dark:text-slate-300">لا توجد أحداث بعد.</p>
            )}
          </div>
        </div>
      ) : null}

      {tab === 'tasks' ? (
        <div className="mt-6 space-y-5">
          <form
            action={async (formData) => addMatterTaskAction(matter.id, formData)}
            className="grid gap-3 rounded-lg border border-brand-border bg-brand-background p-4 dark:border-slate-700 dark:bg-slate-800"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1 text-sm sm:col-span-2">
                <span className="font-medium text-slate-700 dark:text-slate-200">عنوان المهمة</span>
                <input
                  name="title"
                  required
                  className="h-11 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
                />
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
            </div>
            <button type="submit" className={buttonVariants('primary', 'sm')}>
              إضافة مهمة
            </button>
          </form>

          <div className="space-y-3">
            {tasks.length ? (
              tasks.map((task) => (
                <article key={task.id} className="rounded-lg border border-brand-border p-4 text-sm dark:border-slate-700">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium text-brand-navy dark:text-slate-100">{task.title}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {task.status} • {task.priority}
                    </p>
                  </div>
                  {task.due_at ? (
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                      الاستحقاق: {new Date(task.due_at).toLocaleString('ar-SA')}
                    </p>
                  ) : null}
                </article>
              ))
            ) : (
              <p className="text-sm text-slate-600 dark:text-slate-300">لا توجد مهام مرتبطة بعد.</p>
            )}
          </div>

          <Link href={{ pathname: '/app/tasks', query: { matter: matter.id } }} className={buttonVariants('outline', 'sm')}>
            فتح صفحة المهام
          </Link>
        </div>
      ) : null}

      {tab === 'documents' ? (
        <div className="mt-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              مستندات مرتبطة بهذه القضية.
            </p>
            <Link
              href={{ pathname: '/app/documents', query: { matter: matter.id } }}
              className={buttonVariants('primary', 'sm')}
            >
              إضافة/رفع مستند
            </Link>
          </div>

          <div className="space-y-3">
            {documents.length ? (
              documents.map((doc) => (
                <article key={doc.id} className="rounded-lg border border-brand-border p-4 text-sm dark:border-slate-700">
                  <p className="font-medium text-brand-navy dark:text-slate-100">{doc.title}</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {doc.folder} • {new Date(doc.created_at).toLocaleDateString('ar-SA')}
                  </p>
                </article>
              ))
            ) : (
              <p className="text-sm text-slate-600 dark:text-slate-300">لا توجد مستندات بعد.</p>
            )}
          </div>
        </div>
      ) : null}

      {tab === 'billing' ? (
        <div className="mt-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              فواتير مرتبطة بهذه القضية.
            </p>
            <Link
              href={{ pathname: '/app/billing/invoices', query: { matter: matter.id } }}
              className={buttonVariants('primary', 'sm')}
            >
              إنشاء فاتورة
            </Link>
          </div>

          <div className="space-y-3">
            {invoices.length ? (
              invoices.map((inv) => (
                <article key={inv.id} className="rounded-lg border border-brand-border p-4 text-sm dark:border-slate-700">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium text-brand-navy dark:text-slate-100">{inv.number}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{inv.status}</p>
                  </div>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    الإجمالي: {inv.total} SAR • {new Date(inv.issued_at).toLocaleDateString('ar-SA')}
                  </p>
                </article>
              ))
            ) : (
              <p className="text-sm text-slate-600 dark:text-slate-300">لا توجد فواتير بعد.</p>
            )}
          </div>

          <Link href="/app/billing/invoices" className={buttonVariants('outline', 'sm')}>
            فتح صفحة الفواتير
          </Link>
        </div>
      ) : null}
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

