import Link from 'next/link';
import { createSupabaseServerRlsClient } from '@/lib/supabase/server';
import { getCurrentOrgIdForUser } from '@/lib/org';
import { buttonVariants } from '@/components/ui/button';

type QuotesPageProps = {
  searchParams?: { error?: string; success?: string };
};

type QuoteRow = {
  id: string;
  number: string;
  status: 'draft' | 'sent' | 'accepted' | 'rejected';
  total: string;
  currency: string;
  created_at: string;
  client?: Array<{ name: string }> | null;
};

const statusLabels: Record<QuoteRow['status'], string> = {
  draft: 'مسودة',
  sent: 'مرسل',
  accepted: 'مقبول',
  rejected: 'مرفوض',
};

export default async function QuotesPage({ searchParams }: QuotesPageProps) {
  const orgId = await getCurrentOrgIdForUser();
  if (!orgId) {
    return (
      <section className="rounded-lg border border-brand-border bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
        <h1 className="text-xl font-bold text-brand-navy dark:text-slate-100">عروض الأسعار</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">لا يوجد مكتب مفعّل لهذا الحساب بعد.</p>
      </section>
    );
  }

  const supabase = createSupabaseServerRlsClient();
  const { data, error } = await supabase
    .from('quotes')
    .select('id, number, status, total, currency, created_at, client:clients(name)')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(100);

  const quotes = (data as QuoteRow[] | null) ?? [];
  const bannerError = searchParams?.error ? safeDecode(searchParams.error) : null;
  const success = searchParams?.success ? true : false;

  return (
    <section className="rounded-lg border border-brand-border bg-white p-6 shadow-panel dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-brand-navy dark:text-slate-100">عروض الأسعار</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">إنشاء عروض أسعار للعميل.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/app/billing" className={buttonVariants('outline', 'sm')}>
            رجوع
          </Link>
          <Link href="/app/billing/quotes/new" className={buttonVariants('primary', 'sm')}>
            عرض سعر جديد
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

      {error ? (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          تعذر تحميل عروض الأسعار. {error.message}
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
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-border dark:divide-slate-800">
            {quotes.length ? (
              quotes.map((quote) => (
                <tr key={quote.id} className="hover:bg-brand-background/60 dark:hover:bg-slate-800/60">
                  <td className="py-3">
                    <Link href={`/app/billing/quotes/${quote.id}`} className="font-medium text-brand-navy hover:underline dark:text-slate-100">
                      {quote.number}
                    </Link>
                  </td>
                  <td className="py-3 text-slate-700 dark:text-slate-200">{quote.client?.[0]?.name ?? '—'}</td>
                  <td className="py-3 text-slate-700 dark:text-slate-200">
                    {quote.total} {quote.currency}
                  </td>
                  <td className="py-3 text-slate-700 dark:text-slate-200">{statusLabels[quote.status]}</td>
                  <td className="py-3 text-slate-700 dark:text-slate-200">
                    {new Date(quote.created_at).toLocaleDateString('ar-SA')}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="py-6 text-center text-slate-500 dark:text-slate-400">
                  لا توجد عروض أسعار بعد.
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
