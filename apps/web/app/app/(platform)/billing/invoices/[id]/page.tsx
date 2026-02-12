import Link from 'next/link';
import { notFound } from 'next/navigation';
import { buttonVariants } from '@/components/ui/button';
import { createSupabaseServerRlsClient } from '@/lib/supabase/server';
import { getCurrentOrgIdForUser } from '@/lib/org';
import { updateInvoiceStatusAction } from '../actions';

type InvoiceDetailsPageProps = {
  params: { id: string };
  searchParams?: { error?: string; success?: string };
};

type InvoiceRow = {
  id: string;
  number: string;
  status: 'unpaid' | 'partial' | 'paid' | 'void';
  items: Array<{ desc: string; qty: number; unit_price: number }>;
  subtotal: string;
  tax: string;
  total: string;
  currency: string;
  issued_at: string;
  due_at: string | null;
  client?: { name: string } | null;
};

const statusLabels: Record<InvoiceRow['status'], string> = {
  unpaid: 'غير مدفوعة',
  partial: 'مدفوعة جزئيًا',
  paid: 'مدفوعة',
  void: 'ملغاة',
};

export default async function InvoiceDetailsPage({ params, searchParams }: InvoiceDetailsPageProps) {
  const orgId = await getCurrentOrgIdForUser();
  if (!orgId) {
    notFound();
  }

  const supabase = createSupabaseServerRlsClient();
  const { data, error } = await supabase
    .from('invoices')
    .select('id, number, status, items, subtotal, tax, total, currency, issued_at, due_at, client:clients(name)')
    .eq('org_id', orgId)
    .eq('id', params.id)
    .maybeSingle();

  if (error || !data) {
    notFound();
  }

  const invoice = data as InvoiceRow;
  const bannerError = searchParams?.error ? safeDecode(searchParams.error) : null;
  const success = searchParams?.success ? true : false;

  return (
    <section className="rounded-lg border border-brand-border bg-white p-6 shadow-panel dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-brand-navy dark:text-slate-100">{invoice.number}</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            {invoice.client?.name ?? '—'} • {statusLabels[invoice.status]}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/app/billing/invoices" className={buttonVariants('outline', 'sm')}>
            رجوع
          </Link>
          <a href={`/app/api/invoices/${invoice.id}/pdf`} className={buttonVariants('primary', 'sm')}>
            تنزيل PDF
          </a>
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

      <div className="mt-6 rounded-lg border border-brand-border p-4 dark:border-slate-700">
        <h2 className="text-sm font-semibold text-brand-navy dark:text-slate-100">البنود</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b border-brand-border text-slate-600 dark:border-slate-700 dark:text-slate-300">
              <tr>
                <th className="py-2 text-start font-medium">الوصف</th>
                <th className="py-2 text-start font-medium">الكمية</th>
                <th className="py-2 text-start font-medium">سعر الوحدة</th>
                <th className="py-2 text-start font-medium">الإجمالي</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-border dark:divide-slate-800">
              {invoice.items.map((item, idx) => (
                <tr key={idx}>
                  <td className="py-2 text-slate-700 dark:text-slate-200">{item.desc}</td>
                  <td className="py-2 text-slate-700 dark:text-slate-200">{item.qty}</td>
                  <td className="py-2 text-slate-700 dark:text-slate-200">{item.unit_price.toFixed(2)}</td>
                  <td className="py-2 text-slate-700 dark:text-slate-200">
                    {(item.qty * item.unit_price).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 grid gap-2 text-sm text-slate-700 dark:text-slate-200 sm:max-w-sm">
          <div className="flex justify-between">
            <span>الإجمالي قبل الضريبة</span>
            <span>{invoice.subtotal} {invoice.currency}</span>
          </div>
          <div className="flex justify-between">
            <span>الضريبة</span>
            <span>{invoice.tax} {invoice.currency}</span>
          </div>
          <div className="flex justify-between font-semibold text-brand-navy dark:text-slate-100">
            <span>الإجمالي</span>
            <span>{invoice.total} {invoice.currency}</span>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-lg border border-brand-border p-4 dark:border-slate-700">
        <h2 className="text-sm font-semibold text-brand-navy dark:text-slate-100">الحالة</h2>
        <form
          action={async (formData) => {
            const status = String(formData.get('status') ?? 'unpaid') as InvoiceRow['status'];
            await updateInvoiceStatusAction(invoice.id, status);
          }}
          className="mt-3 flex flex-wrap items-center gap-2"
        >
          <select
            name="status"
            defaultValue={invoice.status}
            className="h-11 rounded-lg border border-brand-border bg-white px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="unpaid">غير مدفوعة</option>
            <option value="partial">مدفوعة جزئيًا</option>
            <option value="paid">مدفوعة</option>
            <option value="void">ملغاة</option>
          </select>
          <button type="submit" className={buttonVariants('primary', 'sm')}>
            حفظ الحالة
          </button>
        </form>

        <div className="mt-4 grid gap-2 text-xs text-slate-500 dark:text-slate-400">
          <p>تاريخ الإصدار: {new Date(invoice.issued_at).toLocaleString('ar-SA')}</p>
          {invoice.due_at ? <p>تاريخ الاستحقاق: {new Date(invoice.due_at).toLocaleString('ar-SA')}</p> : null}
        </div>
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

