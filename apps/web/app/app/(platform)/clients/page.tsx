import Link from 'next/link';
import { createSupabaseServerRlsClient } from '@/lib/supabase/server';
import { getCurrentOrgIdForUser } from '@/lib/org';
import { buttonVariants } from '@/components/ui/button';

const PAGE_SIZE = 20;

type ClientsPageProps = {
  searchParams?: {
    q?: string;
    status?: string;
    page?: string;
  };
};

type ClientRow = {
  id: string;
  type: 'person' | 'company';
  name: string;
  status: 'active' | 'archived';
  email: string | null;
  phone: string | null;
  created_at: string;
};

export default async function ClientsPage({ searchParams }: ClientsPageProps) {
  const orgId = await getCurrentOrgIdForUser();
  if (!orgId) {
    return (
      <section className="rounded-lg border border-brand-border bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
        <h1 className="text-xl font-bold text-brand-navy dark:text-slate-100">العملاء</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          لا يوجد مكتب مفعّل لهذا الحساب بعد.
        </p>
      </section>
    );
  }

  const q = (searchParams?.q ?? '').trim();
  const status = (searchParams?.status ?? 'active').trim();
  const page = Math.max(1, Number(searchParams?.page ?? '1') || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = createSupabaseServerRlsClient();
  let query = supabase
    .from('clients')
    .select('id, type, name, status, email, phone, created_at', { count: 'exact' })
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (q) {
    query = query.ilike('name', `%${q}%`);
  }

  if (status === 'archived') {
    query = query.eq('status', 'archived');
  } else {
    query = query.eq('status', 'active');
  }

  const { data, error, count } = await query;

  const rows = (data as ClientRow[] | null) ?? [];
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <section className="rounded-lg border border-brand-border bg-white p-6 shadow-panel dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-brand-navy dark:text-slate-100">العملاء</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            إدارة ملفات العملاء والأرشفة والبحث.
          </p>
        </div>

        <Link href="/app/clients/new" className={buttonVariants('primary', 'sm')}>
          عميل جديد
        </Link>
      </div>

      <form className="mt-5 grid gap-3 sm:grid-cols-[1fr_180px_auto]">
        <label className="block">
          <span className="sr-only">بحث</span>
          <input
            name="q"
            defaultValue={q}
            placeholder="ابحث بالاسم..."
            className="h-11 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
          />
        </label>

        <label className="block">
          <span className="sr-only">الحالة</span>
          <select
            name="status"
            defaultValue={status === 'archived' ? 'archived' : 'active'}
            className="h-11 w-full rounded-lg border border-brand-border bg-white px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="active">نشط</option>
            <option value="archived">مؤرشف</option>
          </select>
        </label>

        <button type="submit" className={buttonVariants('outline', 'sm')}>
          تطبيق
        </button>
      </form>

      {error ? (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          تعذر تحميل العملاء. {error.message}
        </p>
      ) : null}

      <div className="mt-5 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="border-b border-brand-border text-slate-600 dark:border-slate-700 dark:text-slate-300">
            <tr>
              <th className="py-3 text-start font-medium">الاسم</th>
              <th className="py-3 text-start font-medium">النوع</th>
              <th className="py-3 text-start font-medium">التواصل</th>
              <th className="py-3 text-start font-medium">الحالة</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-border dark:divide-slate-800">
            {rows.length ? (
              rows.map((row) => (
                <tr key={row.id} className="hover:bg-brand-background/60 dark:hover:bg-slate-800/60">
                  <td className="py-3">
                    <Link href={`/app/clients/${row.id}`} className="font-medium text-brand-navy hover:underline dark:text-slate-100">
                      {row.name}
                    </Link>
                  </td>
                  <td className="py-3 text-slate-700 dark:text-slate-200">
                    {row.type === 'company' ? 'شركة' : 'فرد'}
                  </td>
                  <td className="py-3 text-slate-700 dark:text-slate-200">
                    <div className="space-y-1">
                      <div>{row.email ?? '—'}</div>
                      <div dir="ltr" className="text-xs text-slate-500 dark:text-slate-400">
                        {row.phone ?? '—'}
                      </div>
                    </div>
                  </td>
                  <td className="py-3 text-slate-700 dark:text-slate-200">
                    {row.status === 'archived' ? 'مؤرشف' : 'نشط'}
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
              pathname: '/app/clients',
              query: { q, status, page: String(Math.max(1, page - 1)) },
            }}
            className={buttonVariants('outline', 'sm')}
          >
            السابق
          </Link>
          <Link
            aria-disabled={page >= totalPages}
            href={{
              pathname: '/app/clients',
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

