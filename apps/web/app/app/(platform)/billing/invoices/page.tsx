import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { ConfirmActionForm } from '@/components/ui/confirm-action-form';
import { EmptyState } from '@/components/ui/empty-state';
import { listClients } from '@/lib/clients';
import { listInvoices, type InvoiceArchiveFilter, type InvoiceStatus } from '@/lib/billing';
import { archiveInvoiceAction, deleteInvoiceAction, restoreInvoiceAction } from '../actions';

type InvoicesPageProps = {
  searchParams?: {
    status?: string;
    client?: string;
    archived?: string;
    page?: string;
    success?: string;
    error?: string;
  };
};

const statusLabel: Record<InvoiceStatus, string> = {
  unpaid: 'غير مسددة',
  partial: 'جزئية',
  paid: 'مدفوعة',
  void: 'ملغاة',
};

const statusVariant: Record<InvoiceStatus, 'default' | 'success' | 'warning' | 'danger'> = {
  unpaid: 'warning',
  partial: 'warning',
  paid: 'success',
  void: 'danger',
};

export default async function InvoicesPage({ searchParams }: InvoicesPageProps) {
  const statusRaw = (searchParams?.status ?? 'all').trim();
  const status: InvoiceStatus | 'all' =
    statusRaw === 'all' || statusRaw === 'unpaid' || statusRaw === 'partial' || statusRaw === 'paid' || statusRaw === 'void'
      ? statusRaw
      : 'all';

  const clientId = (searchParams?.client ?? '').trim();
  const archivedRaw = (searchParams?.archived ?? 'active').trim();
  const archived: InvoiceArchiveFilter =
    archivedRaw === 'all' || archivedRaw === 'archived' || archivedRaw === 'active'
      ? archivedRaw
      : 'active';
  const page = Math.max(1, Number(searchParams?.page ?? '1') || 1);

  const success = searchParams?.success ? safeDecode(searchParams.success) : '';
  const error = searchParams?.error ? safeDecode(searchParams.error) : '';

  let result: Awaited<ReturnType<typeof listInvoices>>;
  let clients: Awaited<ReturnType<typeof listClients>>;

  try {
    [result, clients] = await Promise.all([
      listInvoices({
        status,
        clientId: clientId || undefined,
        archived,
        page,
        limit: 10,
      }),
      listClients({ status: 'active', page: 1, limit: 50 }),
    ]);
  } catch (fetchError) {
    const message = fetchError instanceof Error ? fetchError.message : 'تعذر تحميل الفواتير.';
    return (
      <Card className="p-6">
        <h2 className="text-lg font-bold text-brand-navy dark:text-slate-100">الفواتير</h2>
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

  const previousQuery = buildQuery({ status, client: clientId, archived, page: Math.max(1, result.page - 1) });
  const nextQuery = buildQuery({ status, client: clientId, archived, page: Math.min(totalPages, result.page + 1) });

  return (
    <Card className="p-4 sm:p-6">
      <Breadcrumbs
        className="mb-4"
        items={[
          { label: 'لوحة التحكم', href: '/app' },
          { label: 'الفوترة', href: '/app/billing/invoices' },
          { label: 'الفواتير' },
        ]}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-brand-navy dark:text-slate-100">الفواتير</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            فواتير بسيطة مع دفعات يدوية وتصدير PDF.
          </p>
        </div>
        <Link href="/app/billing/invoices/new" className={buttonVariants('primary', 'sm')}>
          + فاتورة جديدة
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

      <form className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-[220px_1fr_180px_auto]">
        <label className="block">
          <span className="sr-only">الحالة</span>
          <select
            name="status"
            defaultValue={status}
            className="h-11 w-full rounded-lg border border-brand-border bg-white px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="all">كل الحالات</option>
            <option value="unpaid">غير مسددة</option>
            <option value="partial">جزئية</option>
            <option value="paid">مدفوعة</option>
            <option value="void">ملغاة</option>
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

        <label className="block">
          <span className="sr-only">الأرشفة</span>
          <select
            name="archived"
            defaultValue={archived}
            className="h-11 w-full rounded-lg border border-brand-border bg-white px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="active">نشطة</option>
            <option value="archived">مؤرشفة</option>
            <option value="all">الكل</option>
          </select>
        </label>

        <button type="submit" className={buttonVariants('outline', 'sm')}>
          فلترة
        </button>
      </form>

      {!result.data.length ? (
        <div className="mt-8">
          <EmptyState
            title="الفواتير"
            message="لا توجد فواتير بعد."
            backHref="/app/billing/invoices/new"
            backLabel="إنشاء فاتورة"
          />
        </div>
      ) : (
        <>
          <div className="mt-6 space-y-3 md:hidden">
            {result.data.map((invoice) => (
              <article key={invoice.id} className="rounded-lg border border-brand-border p-3 dark:border-slate-700">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-base font-semibold text-brand-navy dark:text-slate-100">{invoice.number}</h3>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant={statusVariant[invoice.status]}>{statusLabel[invoice.status]}</Badge>
                    {invoice.is_archived ? <Badge variant="warning">مؤرشفة</Badge> : null}
                  </div>
                </div>

                <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-md bg-brand-background/70 px-2 py-2 dark:bg-slate-800/70">
                    <dt className="text-xs text-slate-500 dark:text-slate-400">العميل</dt>
                    <dd className="mt-1 font-medium text-slate-700 dark:text-slate-200">{invoice.client?.name ?? '—'}</dd>
                  </div>
                  <div className="rounded-md bg-brand-background/70 px-2 py-2 dark:bg-slate-800/70">
                    <dt className="text-xs text-slate-500 dark:text-slate-400">الإجمالي</dt>
                    <dd className="mt-1 font-medium text-slate-700 dark:text-slate-200">{formatMoney(invoice.total)} SAR</dd>
                  </div>
                  <div className="col-span-2 rounded-md bg-brand-background/70 px-2 py-2 dark:bg-slate-800/70">
                    <dt className="text-xs text-slate-500 dark:text-slate-400">التاريخ</dt>
                    <dd className="mt-1 font-medium text-slate-700 dark:text-slate-200">
                      {new Date(invoice.issued_at).toLocaleDateString('ar-SA')}
                    </dd>
                  </div>
                </dl>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Link href={`/app/billing/invoices/${invoice.id}`} className={buttonVariants('ghost', 'sm')}>
                    عرض
                  </Link>
                  {invoice.is_archived ? (
                    <ConfirmActionForm
                      action={restoreInvoiceAction.bind(null, invoice.id, '/app/billing/invoices')}
                      triggerLabel="استعادة"
                      triggerVariant="outline"
                      triggerSize="sm"
                      confirmTitle="استعادة الفاتورة"
                      confirmMessage="هل تريد استعادة هذه الفاتورة؟"
                      confirmLabel="استعادة"
                      destructive={false}
                    />
                  ) : (
                    <ConfirmActionForm
                      action={archiveInvoiceAction.bind(null, invoice.id, '/app/billing/invoices')}
                      triggerLabel="أرشفة"
                      triggerVariant="outline"
                      triggerSize="sm"
                      confirmTitle="أرشفة الفاتورة"
                      confirmMessage="هل تريد أرشفة هذه الفاتورة؟ يمكنك استعادتها لاحقًا."
                      confirmLabel="أرشفة"
                      destructive
                    />
                  )}
                  <ConfirmActionForm
                    action={deleteInvoiceAction.bind(null, invoice.id, '/app/billing/invoices')}
                    triggerLabel="حذف"
                    triggerVariant="outline"
                    triggerSize="sm"
                    confirmTitle="حذف الفاتورة نهائيًا"
                    confirmMessage="سيتم حذف الفاتورة وكل الدفعات المرتبطة بها نهائيًا."
                    confirmLabel="حذف نهائي"
                    destructive
                  />
                </div>
              </article>
            ))}
          </div>

          <div className="mt-6 hidden overflow-x-auto rounded-lg border border-brand-border md:block dark:border-slate-700">
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
                {result.data.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-brand-background/60 dark:hover:bg-slate-800/60">
                    <td className="px-3 py-3 font-medium text-brand-navy dark:text-slate-100">{invoice.number}</td>
                    <td className="px-3 py-3 text-slate-700 dark:text-slate-200">
                      {invoice.client?.name ?? '—'}
                    </td>
                    <td className="px-3 py-3 text-slate-700 dark:text-slate-200">
                      {formatMoney(invoice.total)} SAR
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Badge variant={statusVariant[invoice.status]}>{statusLabel[invoice.status]}</Badge>
                        {invoice.is_archived ? <Badge variant="warning">مؤرشفة</Badge> : null}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-slate-700 dark:text-slate-200">
                      {new Date(invoice.issued_at).toLocaleDateString('ar-SA')}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Link href={`/app/billing/invoices/${invoice.id}`} className={buttonVariants('ghost', 'sm')}>
                          عرض
                        </Link>
                        {invoice.is_archived ? (
                          <ConfirmActionForm
                            action={restoreInvoiceAction.bind(null, invoice.id, '/app/billing/invoices')}
                            triggerLabel="استعادة"
                            triggerVariant="outline"
                            triggerSize="sm"
                            confirmTitle="استعادة الفاتورة"
                            confirmMessage="هل تريد استعادة هذه الفاتورة؟"
                            confirmLabel="استعادة"
                            destructive={false}
                          />
                        ) : (
                          <ConfirmActionForm
                            action={archiveInvoiceAction.bind(null, invoice.id, '/app/billing/invoices')}
                            triggerLabel="أرشفة"
                            triggerVariant="outline"
                            triggerSize="sm"
                            confirmTitle="أرشفة الفاتورة"
                            confirmMessage="هل تريد أرشفة هذه الفاتورة؟ يمكنك استعادتها لاحقًا."
                            confirmLabel="أرشفة"
                            destructive
                          />
                        )}
                        <ConfirmActionForm
                          action={deleteInvoiceAction.bind(null, invoice.id, '/app/billing/invoices')}
                          triggerLabel="حذف"
                          triggerVariant="outline"
                          triggerSize="sm"
                          confirmTitle="حذف الفاتورة نهائيًا"
                          confirmMessage="سيتم حذف الفاتورة وكل الدفعات المرتبطة بها نهائيًا."
                          confirmLabel="حذف نهائي"
                          destructive
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600 dark:text-slate-300">
            <p>
              الصفحة {result.page} من {totalPages} ({result.total} فاتورة)
            </p>
            <div className="flex items-center gap-2">
              <Link
                aria-disabled={!hasPrevious}
                href={{ pathname: '/app/billing/invoices', query: previousQuery }}
                className={`${buttonVariants('outline', 'sm')} ${!hasPrevious ? 'pointer-events-none opacity-50' : ''}`}
              >
                السابق
              </Link>
              <Link
                aria-disabled={!hasNext}
                href={{ pathname: '/app/billing/invoices', query: nextQuery }}
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

function buildQuery(params: { status: InvoiceStatus | 'all'; client: string; archived: InvoiceArchiveFilter; page: number }) {
  const query: Record<string, string> = { page: String(params.page) };
  if (params.status !== 'all') query.status = params.status;
  if (params.client) query.client = params.client;
  if (params.archived !== 'active') query.archived = params.archived;
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
