import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { EmptyState } from '@/components/ui/empty-state';
import { listClients } from '@/lib/clients';
import { listQuotes, type QuoteStatus } from '@/lib/billing';

type QuotesPageProps = {
  searchParams?: {
    status?: string;
    client?: string;
    page?: string;
    success?: string;
    error?: string;
  };
};

const statusLabel: Record<QuoteStatus, string> = {
  draft: 'مسودة',
  sent: 'مرسل',
  accepted: 'مقبول',
  rejected: 'مرفوض',
};

const statusVariant: Record<QuoteStatus, 'default' | 'success' | 'warning' | 'danger'> = {
  draft: 'default',
  sent: 'warning',
  accepted: 'success',
  rejected: 'danger',
};

export default async function QuotesPage({ searchParams }: QuotesPageProps) {
  const statusRaw = (searchParams?.status ?? 'all').trim();
  const status: QuoteStatus | 'all' =
    statusRaw === 'all' || statusRaw === 'draft' || statusRaw === 'sent' || statusRaw === 'accepted' || statusRaw === 'rejected'
      ? statusRaw
      : 'all';

  const clientId = (searchParams?.client ?? '').trim();
  const page = Math.max(1, Number(searchParams?.page ?? '1') || 1);

  const success = searchParams?.success ? safeDecode(searchParams.success) : '';
  const error = searchParams?.error ? safeDecode(searchParams.error) : '';

  let result: Awaited<ReturnType<typeof listQuotes>>;
  let clients: Awaited<ReturnType<typeof listClients>>;

  try {
    [result, clients] = await Promise.all([
      listQuotes({
        status,
        clientId: clientId || undefined,
        page,
        limit: 10,
      }),
      listClients({ status: 'active', page: 1, limit: 50 }),
    ]);
  } catch (fetchError) {
    const message = fetchError instanceof Error ? fetchError.message : 'تعذر تحميل عروض الأسعار.';
    return (
      <Card className="p-6">
        <h2 className="text-lg font-bold text-brand-navy dark:text-slate-100">عروض الأسعار</h2>
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          {message}
        </p>
        <div className="mt-4">
          <Link href="/app" className={buttonVariants('outline', 'sm')}>
            العودة للوحة التحكم
          </Link>
        </div>
      </Card>
    );
  }

  const totalPages = Math.max(1, Math.ceil(result.total / result.limit));
  const hasPrevious = result.page > 1;
  const hasNext = result.page < totalPages;

  const previousQuery = buildQuery({ status, client: clientId, page: Math.max(1, result.page - 1) });
  const nextQuery = buildQuery({ status, client: clientId, page: Math.min(totalPages, result.page + 1) });

  return (
    <Card className="p-6">
      <Breadcrumbs
        className="mb-4"
        items={[
          { label: 'لوحة التحكم', href: '/app' },
          { label: 'الفوترة', href: '/app/billing/invoices' },
          { label: 'عروض الأسعار' },
        ]}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-brand-navy dark:text-slate-100">عروض الأسعار</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            أنشئ عروض أسعار بسيطة مع بنود وإجمالي.
          </p>
        </div>
        <Link href="/app/billing/quotes/new" className={buttonVariants('primary', 'sm')}>
          + عرض سعر جديد
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

      <form className="mt-5 grid gap-3 sm:grid-cols-[220px_1fr_auto]">
        <label className="block">
          <span className="sr-only">الحالة</span>
          <select
            name="status"
            defaultValue={status}
            className="h-11 w-full rounded-lg border border-brand-border bg-white px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="all">كل الحالات</option>
            <option value="draft">مسودة</option>
            <option value="sent">مرسل</option>
            <option value="accepted">مقبول</option>
            <option value="rejected">مرفوض</option>
          </select>
        </label>

        <label className="block">
          <span className="sr-only">العميل</span>
          <select
            name="client"
            defaultValue={clientId}
            className="h-11 w-full rounded-lg border border-brand-border bg-white px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="">كل العملاء</option>
            {clients.data.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
        </label>

        <button type="submit" className={buttonVariants('outline', 'sm')}>
          فلترة
        </button>
      </form>

      {!result.data.length ? (
        <div className="mt-8">
          <EmptyState
            title="عروض الأسعار"
            message="لا توجد عروض أسعار بعد."
            backHref="/app/billing/quotes/new"
            backLabel="إنشاء عرض سعر"
          />
        </div>
      ) : (
        <>
          <div className="mt-6 overflow-x-auto rounded-lg border border-brand-border dark:border-slate-700">
            <table className="min-w-full text-sm">
              <thead className="border-b border-brand-border text-slate-600 dark:border-slate-700 dark:text-slate-300">
                <tr>
                  <th className="px-3 py-3 text-start font-medium">الرقم</th>
                  <th className="px-3 py-3 text-start font-medium">العميل</th>
                  <th className="px-3 py-3 text-start font-medium">الإجمالي</th>
                  <th className="px-3 py-3 text-start font-medium">الحالة</th>
                  <th className="px-3 py-3 text-start font-medium">التاريخ</th>
                  <th className="px-3 py-3 text-start font-medium">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border dark:divide-slate-800">
                {result.data.map((quote) => (
                  <tr key={quote.id} className="hover:bg-brand-background/60 dark:hover:bg-slate-800/60">
                    <td className="px-3 py-3 font-medium text-brand-navy dark:text-slate-100">{quote.number}</td>
                    <td className="px-3 py-3 text-slate-700 dark:text-slate-200">
                      {quote.client?.name ?? '—'}
                    </td>
                    <td className="px-3 py-3 text-slate-700 dark:text-slate-200">
                      {formatMoney(quote.total)} SAR
                    </td>
                    <td className="px-3 py-3">
                      <Badge variant={statusVariant[quote.status]}>{statusLabel[quote.status]}</Badge>
                    </td>
                    <td className="px-3 py-3 text-slate-700 dark:text-slate-200">
                      {new Date(quote.created_at).toLocaleDateString('ar-SA')}
                    </td>
                    <td className="px-3 py-3">
                      <Link href={`/app/billing/quotes/${quote.id}`} className={buttonVariants('ghost', 'sm')}>
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
              الصفحة {result.page} من {totalPages} ({result.total} عرض)
            </p>
            <div className="flex items-center gap-2">
              <Link
                aria-disabled={!hasPrevious}
                href={{ pathname: '/app/billing/quotes', query: previousQuery }}
                className={`${buttonVariants('outline', 'sm')} ${!hasPrevious ? 'pointer-events-none opacity-50' : ''}`}
              >
                السابق
              </Link>
              <Link
                aria-disabled={!hasNext}
                href={{ pathname: '/app/billing/quotes', query: nextQuery }}
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

function buildQuery(params: { status: QuoteStatus | 'all'; client: string; page: number }) {
  const query: Record<string, string> = { page: String(params.page) };
  if (params.status !== 'all') query.status = params.status;
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

function formatMoney(value: string | number) {
  const numberValue = typeof value === 'number' ? value : Number(value);
  const safe = Number.isFinite(numberValue) ? numberValue : 0;
  return safe.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
