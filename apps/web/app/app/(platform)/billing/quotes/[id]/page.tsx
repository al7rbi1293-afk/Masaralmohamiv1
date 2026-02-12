import Link from 'next/link';
import { notFound } from 'next/navigation';
import { buttonVariants } from '@/components/ui/button';
import { createSupabaseServerRlsClient } from '@/lib/supabase/server';
import { getCurrentOrgIdForUser } from '@/lib/org';
import { updateQuoteStatusAction } from '../actions';

type QuoteDetailsPageProps = {
  params: { id: string };
  searchParams?: { error?: string; success?: string };
};

type QuoteRow = {
  id: string;
  number: string;
  status: 'draft' | 'sent' | 'accepted' | 'rejected';
  items: Array<{ desc: string; qty: number; unit_price: number }>;
  total: string;
  currency: string;
  created_at: string;
  client_id: string;
  client?: { name: string } | null;
};

const statusLabels: Record<QuoteRow['status'], string> = {
  draft: 'مسودة',
  sent: 'مرسل',
  accepted: 'مقبول',
  rejected: 'مرفوض',
};

export default async function QuoteDetailsPage({ params, searchParams }: QuoteDetailsPageProps) {
  const orgId = await getCurrentOrgIdForUser();
  if (!orgId) {
    notFound();
  }

  const supabase = createSupabaseServerRlsClient();
  const { data, error } = await supabase
    .from('quotes')
    .select('id, number, status, items, total, currency, created_at, client_id, client:clients(name)')
    .eq('org_id', orgId)
    .eq('id', params.id)
    .maybeSingle();

  if (error || !data) {
    notFound();
  }

  const quote = data as QuoteRow;
  const bannerError = searchParams?.error ? safeDecode(searchParams.error) : null;
  const success = searchParams?.success ? true : false;

  return (
    <section className="rounded-lg border border-brand-border bg-white p-6 shadow-panel dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-brand-navy dark:text-slate-100">{quote.number}</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            {quote.client?.name ?? '—'} • {statusLabels[quote.status]}
          </p>
        </div>
        <Link href="/app/billing/quotes" className={buttonVariants('outline', 'sm')}>
          رجوع
        </Link>
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
              {quote.items.map((item, idx) => (
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

        <p className="mt-4 text-sm font-semibold text-brand-navy dark:text-slate-100">
          الإجمالي: {quote.total} {quote.currency}
        </p>
      </div>

      <div className="mt-6 rounded-lg border border-brand-border p-4 dark:border-slate-700">
        <h2 className="text-sm font-semibold text-brand-navy dark:text-slate-100">الحالة</h2>
        <form
          action={async (formData) => {
            const status = String(formData.get('status') ?? 'draft') as QuoteRow['status'];
            await updateQuoteStatusAction(quote.id, status);
          }}
          className="mt-3 flex flex-wrap items-center gap-2"
        >
          <select
            name="status"
            defaultValue={quote.status}
            className="h-11 rounded-lg border border-brand-border bg-white px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="draft">مسودة</option>
            <option value="sent">مرسل</option>
            <option value="accepted">مقبول</option>
            <option value="rejected">مرفوض</option>
          </select>
          <button type="submit" className={buttonVariants('primary', 'sm')}>
            حفظ الحالة
          </button>
        </form>
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

