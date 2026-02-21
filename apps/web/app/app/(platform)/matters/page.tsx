import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { listClients } from '@/lib/clients';
import { listMatters, type MatterStatus } from '@/lib/matters';
import { getCurrentAuthUser } from '@/lib/supabase/auth-session';

type MattersPageProps = {
  searchParams?: {
    q?: string;
    status?: string;
    client?: string;
    page?: string;
    success?: string;
    error?: string;
  };
};

const statusLabel: Record<MatterStatus, string> = {
  new: 'جديدة',
  in_progress: 'قيد العمل',
  on_hold: 'معلّقة',
  closed: 'مغلقة',
  archived: 'مؤرشفة',
};

const statusVariant: Record<MatterStatus, 'default' | 'success' | 'warning' | 'danger'> = {
  new: 'default',
  in_progress: 'success',
  on_hold: 'warning',
  closed: 'default',
  archived: 'danger',
};

export default async function MattersPage({ searchParams }: MattersPageProps) {
  const q = (searchParams?.q ?? '').trim();
  const statusRaw = (searchParams?.status ?? 'all').trim();
  const status: MatterStatus | 'all' =
    statusRaw === 'all' ||
      statusRaw === 'new' ||
      statusRaw === 'in_progress' ||
      statusRaw === 'on_hold' ||
      statusRaw === 'closed' ||
      statusRaw === 'archived'
      ? statusRaw
      : 'all';
  const clientId = (searchParams?.client ?? '').trim();
  const page = Math.max(1, Number(searchParams?.page ?? '1') || 1);

  const success = searchParams?.success ? safeDecode(searchParams.success) : '';
  const error = searchParams?.error ? safeDecode(searchParams.error) : '';

  const [mattersResult, clientsResult, currentUser] = await Promise.all([
    listMatters({
      q,
      status,
      clientId: clientId || undefined,
      page,
      limit: 10,
    }),
    listClients({
      status: 'active',
      page: 1,
      limit: 50,
    }),
    getCurrentAuthUser(),
  ]);

  const totalPages = Math.max(1, Math.ceil(mattersResult.total / mattersResult.limit));
  const hasPrevious = mattersResult.page > 1;
  const hasNext = mattersResult.page < totalPages;

  const previousQuery = buildQuery({
    q,
    status,
    client: clientId,
    page: Math.max(1, mattersResult.page - 1),
  });
  const nextQuery = buildQuery({
    q,
    status,
    client: clientId,
    page: Math.min(totalPages, mattersResult.page + 1),
  });

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-brand-navy dark:text-slate-100">القضايا</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            متابعة القضايا مع دعم الخصوصية للأعضاء المصرّح لهم.
          </p>
        </div>
        <Link href="/app/matters/new" className={buttonVariants('primary', 'sm')}>
          + قضية جديدة
        </Link>
      </div>

      {success ? (
        <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200">
          {success}
        </p>
      ) : null}

      {error ? (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </p>
      ) : null}

      <form className="mt-5 grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-[1fr_190px_220px_auto]">
        <label className="block">
          <span className="sr-only">بحث</span>
          <input
            name="q"
            defaultValue={q}
            placeholder="ابحث بعنوان القضية أو الملخص..."
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
            <option value="new">جديدة</option>
            <option value="in_progress">قيد العمل</option>
            <option value="on_hold">معلّقة</option>
            <option value="closed">مغلقة</option>
            <option value="archived">مؤرشفة</option>
          </select>
        </label>

        <label className="block">
          <span className="sr-only">الموكل</span>
          <select
            name="client"
            defaultValue={clientId}
            className="h-11 w-full rounded-lg border border-brand-border bg-white px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="">كل الموكلين</option>
            {clientsResult.data.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
        </label>

        <button type="submit" className={buttonVariants('outline', 'sm')}>
          بحث
        </button>
      </form>

      {!mattersResult.data.length ? (
        <div className="mt-8">
          <EmptyState
            title="القضايا"
            message="ما عندك قضايا حالياً."
            backHref="/app/matters/new"
            backLabel="إنشاء قضية"
          />
        </div>
      ) : (
        <>
          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-brand-border text-slate-600 dark:border-slate-700 dark:text-slate-300">
                <tr>
                  <th className="py-3 text-start font-medium">العنوان</th>
                  <th className="py-3 text-start font-medium">الموكل</th>
                  <th className="py-3 text-start font-medium">الحالة</th>
                  <th className="py-3 text-start font-medium">خاص؟</th>
                  <th className="py-3 text-start font-medium">المسؤول</th>
                  <th className="py-3 text-start font-medium">آخر تحديث</th>
                  <th className="py-3 text-start font-medium">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border dark:divide-slate-800">
                {mattersResult.data.map((matter) => (
                  <tr key={matter.id} className="hover:bg-brand-background/60 dark:hover:bg-slate-800/60">
                    <td className="py-3 font-medium text-brand-navy dark:text-slate-100">{matter.title}</td>
                    <td className="py-3 text-slate-700 dark:text-slate-200">{matter.client?.name ?? '—'}</td>
                    <td className="py-3">
                      <Badge variant={statusVariant[matter.status]}>{statusLabel[matter.status]}</Badge>
                    </td>
                    <td className="py-3">
                      <Badge variant={matter.is_private ? 'warning' : 'default'}>
                        {matter.is_private ? 'خاصة' : 'عامة'}
                      </Badge>
                    </td>
                    <td className="py-3 text-slate-700 dark:text-slate-200">
                      {renderAssignee(matter.assigned_user_id, currentUser?.id)}
                    </td>
                    <td className="py-3 text-slate-700 dark:text-slate-200">
                      {new Date(matter.updated_at).toLocaleDateString('ar-SA')}
                    </td>
                    <td className="py-3">
                      <Link href={`/app/matters/${matter.id}`} className={buttonVariants('ghost', 'sm')}>
                        عرض
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600 dark:text-slate-300">
            <p>
              الصفحة {mattersResult.page} من {totalPages} ({mattersResult.total} قضية)
            </p>
            <div className="flex items-center gap-2">
              <Link
                aria-disabled={!hasPrevious}
                href={{ pathname: '/app/matters', query: previousQuery }}
                className={`${buttonVariants('outline', 'sm')} ${!hasPrevious ? 'pointer-events-none opacity-50' : ''}`}
              >
                السابق
              </Link>
              <Link
                aria-disabled={!hasNext}
                href={{ pathname: '/app/matters', query: nextQuery }}
                className={`${buttonVariants('outline', 'sm')} ${!hasNext ? 'pointer-events-none opacity-50' : ''}`}
              >
                التالي
              </Link>
            </div>
          </div>
        </>
      )}
    </Card>
  );
}

function renderAssignee(assignedUserId: string | null, currentUserId?: string) {
  if (!assignedUserId) return '—';
  if (currentUserId && assignedUserId === currentUserId) return 'أنا';
  return 'عضو الفريق';
}

function buildQuery(params: {
  q: string;
  status: MatterStatus | 'all';
  client: string;
  page: number;
}) {
  const query: Record<string, string> = {
    page: String(params.page),
  };

  if (params.q) query.q = params.q;
  if (params.status && params.status !== 'all') query.status = params.status;
  if (params.client) query.client = params.client;

  return query;
}

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
