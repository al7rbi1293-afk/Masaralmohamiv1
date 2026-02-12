import Link from 'next/link';
import { createSupabaseServerRlsClient } from '@/lib/supabase/server';
import { getCurrentOrgIdForUser } from '@/lib/org';
import { buttonVariants } from '@/components/ui/button';

const PAGE_SIZE = 20;

type MattersPageProps = {
  searchParams?: {
    q?: string;
    status?: string;
    page?: string;
  };
};

type MatterRow = {
  id: string;
  title: string;
  status: 'new' | 'in_progress' | 'on_hold' | 'closed' | 'archived';
  is_private: boolean;
  created_at: string;
  client?: { name: string } | null;
};

const statusLabels: Record<MatterRow['status'], string> = {
  new: 'جديدة',
  in_progress: 'قيد العمل',
  on_hold: 'معلقة',
  closed: 'مغلقة',
  archived: 'مؤرشفة',
};

export default async function MattersPage({ searchParams }: MattersPageProps) {
  const orgId = await getCurrentOrgIdForUser();
  if (!orgId) {
    return (
      <section className="rounded-lg border border-brand-border bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
        <h1 className="text-xl font-bold text-brand-navy dark:text-slate-100">القضايا</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          لا يوجد مكتب مفعّل لهذا الحساب بعد.
        </p>
      </section>
    );
  }

  const q = (searchParams?.q ?? '').trim();
  const status = (searchParams?.status ?? '').trim();
  const page = Math.max(1, Number(searchParams?.page ?? '1') || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = createSupabaseServerRlsClient();
  let query = supabase
    .from('matters')
    .select('id, title, status, is_private, created_at, client:clients(name)', { count: 'exact' })
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (q) {
    query = query.ilike('title', `%${q}%`);
  }

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error, count } = await query;

  const rows = (data as MatterRow[] | null) ?? [];
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <section className="rounded-lg border border-brand-border bg-white p-6 shadow-panel dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-brand-navy dark:text-slate-100">القضايا</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            قائمة القضايا مع حالة كل ملف وسريته.
          </p>
        </div>
        <Link href="/app/matters/new" className={buttonVariants('primary', 'sm')}>
          قضية جديدة
        </Link>
      </div>

      <form className="mt-5 grid gap-3 sm:grid-cols-[1fr_220px_auto]">
        <label className="block">
          <span className="sr-only">بحث</span>
          <input
            name="q"
            defaultValue={q}
            placeholder="ابحث بعنوان القضية..."
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
            <option value="">كل الحالات</option>
            <option value="new">جديدة</option>
            <option value="in_progress">قيد العمل</option>
            <option value="on_hold">معلقة</option>
            <option value="closed">مغلقة</option>
            <option value="archived">مؤرشفة</option>
          </select>
        </label>

        <button type="submit" className={buttonVariants('outline', 'sm')}>
          تطبيق
        </button>
      </form>

      {error ? (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          تعذر تحميل القضايا. {error.message}
        </p>
      ) : null}

      <div className="mt-5 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="border-b border-brand-border text-slate-600 dark:border-slate-700 dark:text-slate-300">
            <tr>
              <th className="py-3 text-start font-medium">العنوان</th>
              <th className="py-3 text-start font-medium">العميل</th>
              <th className="py-3 text-start font-medium">الحالة</th>
              <th className="py-3 text-start font-medium">الخصوصية</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-border dark:divide-slate-800">
            {rows.length ? (
              rows.map((row) => (
                <tr key={row.id} className="hover:bg-brand-background/60 dark:hover:bg-slate-800/60">
                  <td className="py-3">
                    <Link
                      href={`/app/matters/${row.id}`}
                      className="font-medium text-brand-navy hover:underline dark:text-slate-100"
                    >
                      {row.title}
                    </Link>
                  </td>
                  <td className="py-3 text-slate-700 dark:text-slate-200">
                    {row.client?.name ?? '—'}
                  </td>
                  <td className="py-3 text-slate-700 dark:text-slate-200">
                    {statusLabels[row.status]}
                  </td>
                  <td className="py-3 text-slate-700 dark:text-slate-200">
                    {row.is_private ? 'خاص' : 'عام'}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="py-6 text-center text-slate-500 dark:text-slate-400">
                  لا توجد نتائج.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600 dark:text-slate-300">
        <p>
          صفحة {page} من {totalPages} ({total} عنصر)
        </p>
        <div className="flex items-center gap-2">
          <Link
            aria-disabled={page <= 1}
            href={{
              pathname: '/app/matters',
              query: { q, status, page: String(Math.max(1, page - 1)) },
            }}
            className={buttonVariants('outline', 'sm')}
          >
            السابق
          </Link>
          <Link
            aria-disabled={page >= totalPages}
            href={{
              pathname: '/app/matters',
              query: { q, status, page: String(Math.min(totalPages, page + 1)) },
            }}
            className={buttonVariants('outline', 'sm')}
          >
            التالي
          </Link>
        </div>
      </div>
    </section>
  );
}

