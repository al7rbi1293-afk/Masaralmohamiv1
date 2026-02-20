import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConfirmActionForm } from '@/components/ui/confirm-action-form';
import { EmptyState } from '@/components/ui/empty-state';
import { listClients, type ClientStatus, type ClientType } from '@/lib/clients';
import { archiveClientAction, restoreClientAction, deleteClientAction } from './actions';

type ClientsPageProps = {
  searchParams?: {
    q?: string;
    status?: string;
    page?: string;
    success?: string;
    error?: string;
  };
};

const typeLabel: Record<ClientType, string> = {
  person: 'فرد',
  company: 'شركة',
};

export default async function ClientsPage({ searchParams }: ClientsPageProps) {
  const q = (searchParams?.q ?? '').trim();
  const statusRaw = (searchParams?.status ?? 'active').trim();
  const status: ClientStatus | 'all' =
    statusRaw === 'all' || statusRaw === 'archived' || statusRaw === 'active'
      ? statusRaw
      : 'active';
  const page = Math.max(1, Number(searchParams?.page ?? '1') || 1);

  const success = searchParams?.success ? safeDecode(searchParams.success) : '';
  const error = searchParams?.error ? safeDecode(searchParams.error) : '';

  let result: Awaited<ReturnType<typeof listClients>>;
  try {
    result = await listClients({ q, status, page, limit: 10 });
  } catch (fetchError) {
    const message =
      fetchError instanceof Error && fetchError.message
        ? fetchError.message
        : 'تعذر تحميل العملاء.';

    return (
      <Card className="p-6">
        <h1 className="text-xl font-bold text-brand-navy dark:text-slate-100">العملاء</h1>
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

  const previousQuery = buildQuery({ q, status, page: Math.max(1, result.page - 1) });
  const nextQuery = buildQuery({ q, status, page: Math.min(totalPages, result.page + 1) });

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-brand-navy dark:text-slate-100">العملاء</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            إدارة بيانات العملاء مع الأرشفة والاستعادة.
          </p>
        </div>
        <Link href="/app/clients/new" className={buttonVariants('primary', 'sm')}>
          + عميل جديد
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

      <form className="mt-5 grid gap-3 sm:grid-cols-[1fr_180px_auto]">
        <label className="block">
          <span className="sr-only">بحث</span>
          <input
            name="q"
            defaultValue={q}
            placeholder="ابحث بالاسم أو البريد أو الجوال..."
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
            <option value="active">نشط</option>
            <option value="archived">مؤرشف</option>
            <option value="all">الكل</option>
          </select>
        </label>

        <button type="submit" className={buttonVariants('outline', 'sm')}>
          بحث
        </button>
      </form>

      {!result.data.length ? (
        <div className="mt-8">
          <EmptyState title="العملاء" message="ما عندك عملاء حالياً." backHref="/app/clients/new" backLabel="أضف أول عميل" />
        </div>
      ) : (
        <>
          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-brand-border text-slate-600 dark:border-slate-700 dark:text-slate-300">
                <tr>
                  <th className="py-3 text-start font-medium">الاسم</th>
                  <th className="py-3 text-start font-medium">النوع</th>
                  <th className="py-3 text-start font-medium">الجوال</th>
                  <th className="py-3 text-start font-medium">البريد</th>
                  <th className="py-3 text-start font-medium">الحالة</th>
                  <th className="py-3 text-start font-medium">آخر تحديث</th>
                  <th className="py-3 text-start font-medium">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border dark:divide-slate-800">
                {result.data.map((client) => (
                  <tr key={client.id} className="hover:bg-brand-background/60 dark:hover:bg-slate-800/60">
                    <td className="py-3 font-medium text-brand-navy dark:text-slate-100">{client.name}</td>
                    <td className="py-3 text-slate-700 dark:text-slate-200">{typeLabel[client.type]}</td>
                    <td className="py-3 text-slate-700 dark:text-slate-200">{client.phone ?? '—'}</td>
                    <td className="py-3 text-slate-700 dark:text-slate-200">{client.email ?? '—'}</td>
                    <td className="py-3">
                      <Badge variant={client.status === 'active' ? 'success' : 'warning'}>
                        {client.status === 'active' ? 'نشط' : 'مؤرشف'}
                      </Badge>
                    </td>
                    <td className="py-3 text-slate-700 dark:text-slate-200">
                      {new Date(client.updated_at).toLocaleDateString('ar-SA')}
                    </td>
                    <td className="py-3">
                      <div className="flex flex-wrap gap-2">
                        <Link href={`/app/clients/${client.id}`} className={buttonVariants('ghost', 'sm')}>
                          عرض
                        </Link>
                        {client.status === 'active' ? (
                          <ConfirmActionForm
                            action={archiveClientAction.bind(null, client.id, '/app/clients')}
                            triggerLabel="أرشفة"
                            triggerVariant="outline"
                            triggerSize="sm"
                            confirmTitle="أرشفة العميل"
                            confirmMessage="هل تريد أرشفة هذا العميل؟ يمكنك استعادته لاحقًا."
                            confirmLabel="أرشفة"
                            destructive
                          />
                        ) : (
                          <ConfirmActionForm
                            action={restoreClientAction.bind(null, client.id, '/app/clients')}
                            triggerLabel="استعادة"
                            triggerVariant="outline"
                            triggerSize="sm"
                            confirmTitle="استعادة العميل"
                            confirmMessage="هل تريد استعادة هذا العميل إلى الحالة النشطة؟"
                            confirmLabel="استعادة"
                            destructive={false}
                          />
                        )}
                        <ConfirmActionForm
                          action={deleteClientAction.bind(null, client.id, '/app/clients')}
                          triggerLabel="إزالة"
                          triggerVariant="outline"
                          triggerSize="sm"
                          confirmTitle="إزالة العميل نهائياً"
                          confirmMessage="هل أنت متأكد أنك تريد إزالة هذا العميل نهائيًا من المكتب؟ لا يمكن التراجع عن هذا الإجراء وسيتم حذف جميع البيانات المرتبطة."
                          confirmLabel="إزالة نهائية"
                          destructive={true}
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
              الصفحة {result.page} من {totalPages} ({result.total} عميل)
            </p>
            <div className="flex items-center gap-2">
              <Link
                aria-disabled={!hasPrevious}
                href={{ pathname: '/app/clients', query: previousQuery }}
                className={buttonVariants('outline', 'sm')}
              >
                السابق
              </Link>
              <Link
                aria-disabled={!hasNext}
                href={{ pathname: '/app/clients', query: nextQuery }}
                className={buttonVariants('outline', 'sm')}
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

function buildQuery(params: {
  q: string;
  status: ClientStatus | 'all';
  page: number;
}) {
  const query: Record<string, string> = {
    page: String(params.page),
  };

  if (params.q) {
    query.q = params.q;
  }
  if (params.status && params.status !== 'active') {
    query.status = params.status;
  }

  return query;
}

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
