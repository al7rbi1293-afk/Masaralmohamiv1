import Link from 'next/link';
import { createSupabaseServerRlsClient } from '@/lib/supabase/server';
import { getCurrentOrgIdForUser } from '@/lib/org';
import { buttonVariants } from '@/components/ui/button';

const PAGE_SIZE = 20;

type DocumentsPageProps = {
  searchParams?: {
    q?: string;
    matter?: string;
    page?: string;
    success?: string;
  };
};

type DocumentRow = {
  id: string;
  title: string;
  folder: string;
  created_at: string;
  matter_id: string | null;
};

type MatterOption = {
  id: string;
  title: string;
};

export default async function DocumentsPage({ searchParams }: DocumentsPageProps) {
  const orgId = await getCurrentOrgIdForUser();
  if (!orgId) {
    return (
      <section className="rounded-lg border border-brand-border bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
        <h1 className="text-xl font-bold text-brand-navy dark:text-slate-100">المستندات</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          لا يوجد مكتب مفعّل لهذا الحساب بعد.
        </p>
      </section>
    );
  }

  const q = (searchParams?.q ?? '').trim();
  const matterFilter = (searchParams?.matter ?? '').trim();
  const page = Math.max(1, Number(searchParams?.page ?? '1') || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = createSupabaseServerRlsClient();
  const { data: mattersData } = await supabase
    .from('matters')
    .select('id, title')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(200);

  const matters = (mattersData as MatterOption[] | null) ?? [];

  let query = supabase
    .from('documents')
    .select('id, title, folder, created_at, matter_id', { count: 'exact' })
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (q) {
    query = query.ilike('title', `%${q}%`);
  }

  if (matterFilter) {
    query = query.eq('matter_id', matterFilter);
  }

  const { data, error, count } = await query;
  const rows = (data as DocumentRow[] | null) ?? [];
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const success = searchParams?.success ? true : false;

  return (
    <section className="rounded-lg border border-brand-border bg-white p-6 shadow-panel dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-brand-navy dark:text-slate-100">المستندات</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            رفع نسخ وإصدارات ومشاركة بروابط مؤقتة.
          </p>
        </div>
        <Link
          href={{ pathname: '/app/documents/new', query: matterFilter ? { matter: matterFilter } : {} }}
          className={buttonVariants('primary', 'sm')}
        >
          رفع مستند
        </Link>
      </div>

      {success ? (
        <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200">
          تم رفع المستند بنجاح.
        </p>
      ) : null}

      <form className="mt-5 grid gap-3 sm:grid-cols-[1fr_260px_auto]">
        <label className="block">
          <span className="sr-only">بحث</span>
          <input
            name="q"
            defaultValue={q}
            placeholder="ابحث بعنوان المستند..."
            className="h-11 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
          />
        </label>

        <label className="block">
          <span className="sr-only">القضية</span>
          <select
            name="matter"
            defaultValue={matterFilter}
            className="h-11 w-full rounded-lg border border-brand-border bg-white px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="">كل القضايا</option>
            {matters.map((matter) => (
              <option key={matter.id} value={matter.id}>
                {matter.title}
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
          تعذر تحميل المستندات. {error.message}
        </p>
      ) : null}

      <div className="mt-5 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="border-b border-brand-border text-slate-600 dark:border-slate-700 dark:text-slate-300">
            <tr>
              <th className="py-3 text-start font-medium">العنوان</th>
              <th className="py-3 text-start font-medium">المجلد</th>
              <th className="py-3 text-start font-medium">تاريخ الرفع</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-border dark:divide-slate-800">
            {rows.length ? (
              rows.map((row) => (
                <tr key={row.id} className="hover:bg-brand-background/60 dark:hover:bg-slate-800/60">
                  <td className="py-3">
                    <Link href={`/app/documents/${row.id}`} className="font-medium text-brand-navy hover:underline dark:text-slate-100">
                      {row.title}
                    </Link>
                  </td>
                  <td className="py-3 text-slate-700 dark:text-slate-200">{row.folder}</td>
                  <td className="py-3 text-slate-700 dark:text-slate-200">
                    {new Date(row.created_at).toLocaleDateString('ar-SA')}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={3} className="py-6 text-center text-slate-500 dark:text-slate-400">
                  لا توجد مستندات بعد.
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
              pathname: '/app/documents',
              query: { q, matter: matterFilter, page: String(Math.max(1, page - 1)) },
            }}
            className={buttonVariants('outline', 'sm')}
          >
            السابق
          </Link>
          <Link
            aria-disabled={page >= totalPages}
            href={{
              pathname: '/app/documents',
              query: { q, matter: matterFilter, page: String(Math.min(totalPages, page + 1)) },
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

