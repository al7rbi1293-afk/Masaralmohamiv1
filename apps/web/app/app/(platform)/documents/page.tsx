import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConfirmActionForm } from '@/components/ui/confirm-action-form';
import { EmptyState } from '@/components/ui/empty-state';
import { DocumentDownloadButton } from '@/components/documents/document-download-button';
import { DocumentShareButton } from '@/components/documents/document-share-button';
import { type DocumentArchiveFilter, listDocuments } from '@/lib/documents';
import { listMatters } from '@/lib/matters';
import { archiveDocumentAction, deleteDocumentAction, restoreDocumentAction } from './actions';

type DocumentsPageProps = {
  searchParams?: {
    q?: string;
    matter?: string;
    archived?: string;
    page?: string;
    success?: string;
    error?: string;
  };
};

export default async function DocumentsPage({ searchParams }: DocumentsPageProps) {
  const q = (searchParams?.q ?? '').trim();
  const matterId = (searchParams?.matter ?? '').trim();
  const archivedRaw = (searchParams?.archived ?? 'active').trim();
  const archived: DocumentArchiveFilter =
    archivedRaw === 'all' || archivedRaw === 'archived' || archivedRaw === 'active'
      ? archivedRaw
      : 'active';
  const page = Math.max(1, Number(searchParams?.page ?? '1') || 1);
  const success = searchParams?.success ? safeDecode(searchParams.success) : '';
  const error = searchParams?.error ? safeDecode(searchParams.error) : '';

  let documentsResult: Awaited<ReturnType<typeof listDocuments>>;
  let mattersResult: Awaited<ReturnType<typeof listMatters>>;

  try {
    [documentsResult, mattersResult] = await Promise.all([
      listDocuments({
        q,
        matterId: matterId || undefined,
        archived,
        page,
        limit: 10,
      }),
      listMatters({ status: 'all', page: 1, limit: 50 }),
    ]);
  } catch (fetchError) {
    const message =
      fetchError instanceof Error && fetchError.message ? fetchError.message : 'تعذر تحميل المستندات.';

    return (
      <Card className="p-6">
        <h1 className="text-xl font-bold text-brand-navy dark:text-slate-100">المستندات</h1>
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

  const totalPages = Math.max(1, Math.ceil(documentsResult.total / documentsResult.limit));
  const hasPrevious = documentsResult.page > 1;
  const hasNext = documentsResult.page < totalPages;
  const previousQuery = buildQuery({ q, matter: matterId, archived, page: Math.max(1, documentsResult.page - 1) });
  const nextQuery = buildQuery({ q, matter: matterId, archived, page: Math.min(totalPages, documentsResult.page + 1) });

  return (
    <Card className="p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-brand-navy dark:text-slate-100">المستندات</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            رفع النسخ وإدارتها ومشاركتها بروابط مؤقتة.
          </p>
        </div>
        <Link href="/app/documents/new" className={buttonVariants('primary', 'sm')}>
          + مستند جديد
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

      <form className="mt-5 grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-[1fr_220px_180px_auto]">
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
          <span className="sr-only">مرتبط بقضية</span>
          <select
            name="matter"
            defaultValue={matterId}
            className="h-11 w-full rounded-lg border border-brand-border bg-white px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="">كل القضايا</option>
            {mattersResult.data.map((matter) => (
              <option key={matter.id} value={matter.id}>
                {matter.title}
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
          بحث
        </button>
      </form>

      {!documentsResult.data.length ? (
        <div className="mt-8">
          <EmptyState
            title="المستندات"
            message="لا توجد مستندات بعد."
            backHref="/app/documents/new"
            backLabel="إضافة مستند"
          />
        </div>
      ) : (
        <>
          <div className="mt-6 space-y-3 md:hidden">
            {documentsResult.data.map((doc) => (
              <article key={doc.id} className="rounded-lg border border-brand-border p-3 dark:border-slate-700">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-base font-semibold text-brand-navy dark:text-slate-100">{doc.title}</h2>
                  {doc.is_archived ? <Badge variant="warning">مؤرشف</Badge> : null}
                </div>

                <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-md bg-brand-background/70 px-2 py-2 dark:bg-slate-800/70">
                    <dt className="text-xs text-slate-500 dark:text-slate-400">مرتبط بقضية</dt>
                    <dd className="mt-1 font-medium text-slate-700 dark:text-slate-200">{doc.matter?.title ?? '—'}</dd>
                  </div>
                  <div className="rounded-md bg-brand-background/70 px-2 py-2 dark:bg-slate-800/70">
                    <dt className="text-xs text-slate-500 dark:text-slate-400">آخر نسخة</dt>
                    <dd className="mt-1 font-medium text-slate-700 dark:text-slate-200">
                      {doc.latestVersion ? `v${doc.latestVersion.version_no}` : '—'}
                    </dd>
                  </div>
                  <div className="col-span-2 rounded-md bg-brand-background/70 px-2 py-2 dark:bg-slate-800/70">
                    <dt className="text-xs text-slate-500 dark:text-slate-400">اسم الملف</dt>
                    <dd className="mt-1 break-all font-medium text-slate-700 dark:text-slate-200">
                      {doc.latestVersion?.file_name ?? '—'}
                    </dd>
                  </div>
                  <div className="col-span-2 rounded-md bg-brand-background/70 px-2 py-2 dark:bg-slate-800/70">
                    <dt className="text-xs text-slate-500 dark:text-slate-400">تاريخ الرفع</dt>
                    <dd className="mt-1 font-medium text-slate-700 dark:text-slate-200">
                      {doc.latestVersion ? new Date(doc.latestVersion.created_at).toLocaleDateString('ar-SA') : '—'}
                    </dd>
                  </div>
                </dl>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Link href={`/app/documents/${doc.id}`} className={buttonVariants('ghost', 'sm')}>
                    عرض
                  </Link>
                  <DocumentDownloadButton storagePath={doc.latestVersion?.storage_path} variant="ghost" size="sm" />
                  <DocumentShareButton documentId={doc.id} />
                  {doc.is_archived ? (
                    <ConfirmActionForm
                      action={restoreDocumentAction.bind(null, doc.id, '/app/documents')}
                      triggerLabel="استعادة"
                      triggerVariant="outline"
                      triggerSize="sm"
                      confirmTitle="استعادة المستند"
                      confirmMessage="هل تريد استعادة هذا المستند؟"
                      confirmLabel="استعادة"
                      destructive={false}
                    />
                  ) : (
                    <ConfirmActionForm
                      action={archiveDocumentAction.bind(null, doc.id, '/app/documents')}
                      triggerLabel="أرشفة"
                      triggerVariant="outline"
                      triggerSize="sm"
                      confirmTitle="أرشفة المستند"
                      confirmMessage="هل تريد أرشفة هذا المستند؟ يمكنك استعادته لاحقًا."
                      confirmLabel="أرشفة"
                      destructive
                    />
                  )}
                  <ConfirmActionForm
                    action={deleteDocumentAction.bind(null, doc.id, '/app/documents')}
                    triggerLabel="حذف"
                    triggerVariant="outline"
                    triggerSize="sm"
                    confirmTitle="حذف المستند نهائيًا"
                    confirmMessage="سيتم حذف المستند وكل نسخه وروابط مشاركته نهائيًا."
                    confirmLabel="حذف نهائي"
                    destructive
                  />
                </div>
              </article>
            ))}
          </div>

          <div className="mt-6 hidden overflow-x-auto md:block">
            <table className="min-w-full text-sm">
              <thead className="border-b border-brand-border text-slate-600 dark:border-slate-700 dark:text-slate-300">
                <tr>
                  <th className="py-3 text-start font-medium">العنوان</th>
                  <th className="py-3 text-start font-medium">مرتبط بقضية</th>
                  <th className="py-3 text-start font-medium">آخر نسخة</th>
                  <th className="py-3 text-start font-medium">تاريخ الرفع</th>
                  <th className="py-3 text-start font-medium">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border dark:divide-slate-800">
                {documentsResult.data.map((doc) => (
                  <tr key={doc.id} className="hover:bg-brand-background/60 dark:hover:bg-slate-800/60">
                    <td className="py-3">
                      <div className="flex flex-wrap items-center gap-2 font-medium text-brand-navy dark:text-slate-100">
                        <span>{doc.title}</span>
                        {doc.is_archived ? <Badge variant="warning">مؤرشف</Badge> : null}
                      </div>
                    </td>
                    <td className="py-3 text-slate-700 dark:text-slate-200">{doc.matter?.title ?? '—'}</td>
                    <td className="py-3">
                      {doc.latestVersion ? (
                        <Badge variant="default">
                          v{doc.latestVersion.version_no} · {doc.latestVersion.file_name}
                        </Badge>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-3 text-slate-700 dark:text-slate-200">
                      {doc.latestVersion ? new Date(doc.latestVersion.created_at).toLocaleDateString('ar-SA') : '—'}
                    </td>
                    <td className="py-3">
                      <div className="flex flex-wrap gap-2">
                        <Link href={`/app/documents/${doc.id}`} className={buttonVariants('ghost', 'sm')}>
                          عرض
                        </Link>
                        <DocumentDownloadButton storagePath={doc.latestVersion?.storage_path} variant="ghost" size="sm" />
                        <DocumentShareButton documentId={doc.id} />
                        {doc.is_archived ? (
                          <ConfirmActionForm
                            action={restoreDocumentAction.bind(null, doc.id, '/app/documents')}
                            triggerLabel="استعادة"
                            triggerVariant="outline"
                            triggerSize="sm"
                            confirmTitle="استعادة المستند"
                            confirmMessage="هل تريد استعادة هذا المستند؟"
                            confirmLabel="استعادة"
                            destructive={false}
                          />
                        ) : (
                          <ConfirmActionForm
                            action={archiveDocumentAction.bind(null, doc.id, '/app/documents')}
                            triggerLabel="أرشفة"
                            triggerVariant="outline"
                            triggerSize="sm"
                            confirmTitle="أرشفة المستند"
                            confirmMessage="هل تريد أرشفة هذا المستند؟ يمكنك استعادته لاحقًا."
                            confirmLabel="أرشفة"
                            destructive
                          />
                        )}
                        <ConfirmActionForm
                          action={deleteDocumentAction.bind(null, doc.id, '/app/documents')}
                          triggerLabel="حذف"
                          triggerVariant="outline"
                          triggerSize="sm"
                          confirmTitle="حذف المستند نهائيًا"
                          confirmMessage="سيتم حذف المستند وكل نسخه وروابط مشاركته نهائيًا."
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
              الصفحة {documentsResult.page} من {totalPages} ({documentsResult.total} مستند)
            </p>
            <div className="flex items-center gap-2">
              <Link
                aria-disabled={!hasPrevious}
                href={{ pathname: '/app/documents', query: previousQuery }}
                className={`${buttonVariants('outline', 'sm')} ${!hasPrevious ? 'pointer-events-none opacity-50' : ''}`}
              >
                السابق
              </Link>
              <Link
                aria-disabled={!hasNext}
                href={{ pathname: '/app/documents', query: nextQuery }}
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

function buildQuery(params: { q: string; matter: string; archived: DocumentArchiveFilter; page: number }) {
  const query: Record<string, string> = {
    page: String(params.page),
  };

  if (params.q) query.q = params.q;
  if (params.matter) query.matter = params.matter;
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
