import { redirect } from 'next/navigation';
import { createSupabaseServerRlsClient } from '@/lib/supabase/server';
import { getCurrentOrgContextForUser } from '@/lib/org';
import { buttonVariants } from '@/components/ui/button';

type AuditPageProps = {
  searchParams?: {
    from?: string;
    to?: string;
    entity?: string;
  };
};

type AuditRow = {
  id: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  user_id: string | null;
  meta: Record<string, unknown>;
  created_at: string;
};

export default async function AuditPage({ searchParams }: AuditPageProps) {
  const org = await getCurrentOrgContextForUser();
  if (!org.orgId) {
    redirect('/app');
  }

  if (org.role !== 'owner') {
    redirect('/app');
  }

  const from = (searchParams?.from ?? '').trim();
  const to = (searchParams?.to ?? '').trim();
  const entity = (searchParams?.entity ?? '').trim();

  const supabase = createSupabaseServerRlsClient();
  let query = supabase
    .from('audit_logs')
    .select('id, action, entity_type, entity_id, user_id, meta, created_at')
    .eq('org_id', org.orgId)
    .order('created_at', { ascending: false })
    .limit(200);

  if (from) {
    query = query.gte('created_at', new Date(from).toISOString());
  }

  if (to) {
    query = query.lte('created_at', new Date(to).toISOString());
  }

  if (entity) {
    query = query.eq('entity_type', entity);
  }

  const { data, error } = await query;
  const rows = (data as AuditRow[] | null) ?? [];

  return (
    <section className="rounded-lg border border-brand-border bg-white p-6 shadow-panel dark:border-slate-700 dark:bg-slate-900">
      <h1 className="text-xl font-bold text-brand-navy dark:text-slate-100">سجل التدقيق</h1>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
        يظهر للمالك فقط. آخر 200 حدث.
      </p>

      <form className="mt-6 grid gap-3 sm:grid-cols-[1fr_1fr_220px_auto]">
        <label className="block space-y-1 text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-200">من</span>
          <input
            name="from"
            type="date"
            defaultValue={from}
            className="h-11 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
          />
        </label>

        <label className="block space-y-1 text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-200">إلى</span>
          <input
            name="to"
            type="date"
            defaultValue={to}
            className="h-11 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
          />
        </label>

        <label className="block space-y-1 text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-200">الكيان</span>
          <select
            name="entity"
            defaultValue={entity}
            className="h-11 w-full rounded-lg border border-brand-border bg-white px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="">الكل</option>
            <option value="client">عميل</option>
            <option value="matter">قضية</option>
            <option value="document">مستند</option>
            <option value="task">مهمة</option>
            <option value="quote">عرض سعر</option>
            <option value="invoice">فاتورة</option>
          </select>
        </label>

        <button type="submit" className={buttonVariants('outline', 'sm')}>
          تطبيق
        </button>
      </form>

      {error ? (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          تعذر تحميل السجل. {error.message}
        </p>
      ) : null}

      <div className="mt-5 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="border-b border-brand-border text-slate-600 dark:border-slate-700 dark:text-slate-300">
            <tr>
              <th className="py-3 text-start font-medium">الوقت</th>
              <th className="py-3 text-start font-medium">الحدث</th>
              <th className="py-3 text-start font-medium">الكيان</th>
              <th className="py-3 text-start font-medium">المستخدم</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-border dark:divide-slate-800">
            {rows.length ? (
              rows.map((row) => (
                <tr key={row.id} className="hover:bg-brand-background/60 dark:hover:bg-slate-800/60">
                  <td className="py-3 text-slate-700 dark:text-slate-200">
                    {new Date(row.created_at).toLocaleString('ar-SA')}
                  </td>
                  <td className="py-3 text-slate-700 dark:text-slate-200">{row.action}</td>
                  <td className="py-3 text-slate-700 dark:text-slate-200">
                    {row.entity_type ?? '—'}
                    {row.entity_id ? (
                      <span dir="ltr" className="ms-2 text-xs text-slate-500 dark:text-slate-400">
                        {row.entity_id}
                      </span>
                    ) : null}
                  </td>
                  <td className="py-3 text-slate-700 dark:text-slate-200">
                    {row.user_id ? (
                      <span dir="ltr" className="text-xs">
                        {row.user_id}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="py-6 text-center text-slate-500 dark:text-slate-400">
                  لا توجد أحداث بعد.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

