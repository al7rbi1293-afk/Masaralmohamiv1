import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { DocumentShareButton } from '@/components/documents/document-share-button';
import { DocumentDownloadButton } from '@/components/documents/document-download-button';
import { listDocuments } from '@/lib/documents';
import { listMatters } from '@/lib/matters';

type DocumentsPageProps = {
  searchParams?: {
    q?: string;
    matter?: string;
    page?: string;
    success?: string;
    error?: string;
  };
};

export default async function DocumentsPage({ searchParams }: DocumentsPageProps) {
  const q = (searchParams?.q ?? '').trim();
  const matterId = (searchParams?.matter ?? '').trim();
  const page = Math.max(1, Number(searchParams?.page ?? '1') || 1);
  const success = searchParams?.success ? safeDecode(searchParams.success) : '';
  const error = searchParams?.error ? safeDecode(searchParams.error) : '';

  const [documentsResult, mattersResult] = await Promise.all([
    listDocuments({
      q,
      matterId: matterId || undefined,
      page,
      limit: 10,
    }),
    listMatters({ status: 'all', page: 1, limit: 50 }),
  ]);

  const totalPages = Math.max(1, Math.ceil(documentsResult.total / documentsResult.limit));
  const hasPrevious = documentsResult.page > 1;
  const hasNext = documentsResult.page < totalPages;
  const previousQuery = buildQuery({ q, matter: matterId, page: Math.max(1, documentsResult.page - 1) });
  const nextQuery = buildQuery({ q, matter: matterId, page: Math.min(totalPages, documentsResult.page + 1) });

  return (
    <Card className="p-6">
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

      <form className="mt-5 grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1fr_260px_auto]">
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
          <div className="mt-6 overflow-x-auto">
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
                    <td className="py-3 font-medium text-brand-navy dark:text-slate-100">{doc.title}</td>
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

function buildQuery(params: { q: string; matter: string; page: number }) {
  const query: Record<string, string> = {
    page: String(params.page),
  };

  if (params.q) query.q = params.q;
  if (params.matter) query.matter = params.matter;

  return query;
}

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

