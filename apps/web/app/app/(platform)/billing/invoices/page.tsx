import Link from 'next/link';
import { createSupabaseServerRlsClient } from '@/lib/supabase/server';
import { getCurrentOrgIdForUser } from '@/lib/org';
import { buttonVariants } from '@/components/ui/button';

type InvoicesPageProps = {
  searchParams?: { status?: string; matter?: string; error?: string; success?: string };
};

type InvoiceRow = {
  id: string;
  number: string;
  status: 'unpaid' | 'partial' | 'paid' | 'void';
  total: string;
  currency: string;
  issued_at: string;
  client?: Array<{ name: string }> | null;
  matter_id: string | null;
};

const statusLabels: Record<InvoiceRow['status'], string> = {
  unpaid: 'غير مدفوعة',
  partial: 'مدفوعة جزئيًا',
  paid: 'مدفوعة',
  void: 'ملغاة',
};

export default async function InvoicesPage({ searchParams }: InvoicesPageProps) {
  const orgId = await getCurrentOrgIdForUser();
  if (!orgId) {
    return (
      <section className="rounded-lg border border-brand-border bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
        <h1 className="text-xl font-bold text-brand-navy dark:text-slate-100">الفواتير</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">لا يوجد مكتب مفعّل لهذا الحساب بعد.</p>
      </section>
    );
  }

  const status = (searchParams?.status ?? '').trim();
  const matter = (searchParams?.matter ?? '').trim();
  const bannerError = searchParams?.error ? safeDecode(searchParams.error) : null;
  const success = searchParams?.success ? true : false;

  const supabase = createSupabaseServerRlsClient();
  let query = supabase
    .from('invoices')
    .select('id, number, status, total, currency, issued_at, matter_id, client:clients(name)')
    .eq('org_id', orgId)
    .order('issued_at', { ascending: false })
    .limit(100);

  if (status) {
    query = query.eq('status', status);
  }

  if (matter) {
    query = query.eq('matter_id', matter);
  }

  const { data, error } = await query;
  const invoices = (data as InvoiceRow[] | null) ?? [];

  return (
    <section className="rounded-lg border border-brand-border bg-white p-6 shadow-panel dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-brand-navy dark:text-slate-100">الفواتير</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">إنشاء فواتير وتصدير PDF.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/app/billing" className={buttonVariants('outline', 'sm')}>
            رجوع
          </Link>
          <Link
            href={{ pathname: '/app/billing/invoices/new', query: matter ? { matter } : {} }}
            className={buttonVariants('primary', 'sm')}
          >
            فاتورة جديدة
          </Link>
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

      <form className="mt-5 flex flex-wrap items-center gap-2">
        <label className="text-sm text-slate-700 dark:text-slate-200">
          الحالة:
          <select
            name="status"
            defaultValue={status}
            className="ms-2 h-10 rounded-lg border border-brand-border bg-white px-2 dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="">كل الحالات</option>
            <option value="unpaid">غير مدفوعة</option>
            <option value="partial">جزئية</option>
            <option value="paid">مدفوعة</option>
            <option value="void">ملغاة</option>
          </select>
        </label>
        {matter ? <input type="hidden" name="matter" value={matter} /> : null}
        <button type="submit" className={buttonVariants('outline', 'sm')}>
          تطبيق
        </button>
      </form>

      {error ? (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          تعذر تحميل الفواتير. {error.message}
        </p>
      ) : null}

      <div className="mt-5 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="border-b border-brand-border text-slate-600 dark:border-slate-700 dark:text-slate-300">
            <tr>
              <th className="py-3 text-start font-medium">الرقم</th>
              <th className="py-3 text-start font-medium">العميل</th>
              <th className="py-3 text-start font-medium">الإجمالي</th>
              <th className="py-3 text-start font-medium">الحالة</th>
              <th className="py-3 text-start font-medium">التاريخ</th>
              <th className="py-3 text-start font-medium">PDF</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-border dark:divide-slate-800">
            {invoices.length ? (
              invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-brand-background/60 dark:hover:bg-slate-800/60">
                  <td className="py-3">
                    <Link href={`/app/billing/invoices/${inv.id}`} className="font-medium text-brand-navy hover:underline dark:text-slate-100">
                      {inv.number}
                    </Link>
                  </td>
                  <td className="py-3 text-slate-700 dark:text-slate-200">{inv.client?.[0]?.name ?? '—'}</td>
                  <td className="py-3 text-slate-700 dark:text-slate-200">
                    {inv.total} {inv.currency}
                  </td>
                  <td className="py-3 text-slate-700 dark:text-slate-200">{statusLabels[inv.status]}</td>
                  <td className="py-3 text-slate-700 dark:text-slate-200">
                    {new Date(inv.issued_at).toLocaleDateString('ar-SA')}
                  </td>
                  <td className="py-3">
                    <a
                      href={`/app/api/invoices/${inv.id}/pdf`}
                      className={buttonVariants('outline', 'sm')}
                    >
                      تنزيل
                    </a>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="py-6 text-center text-slate-500 dark:text-slate-400">
                  لا توجد فواتير بعد.
                </td>
              </tr>
            )}
          </tbody>
        </table>
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
