import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { DocumentShareButton } from '@/components/documents/document-share-button';
import { DocumentVersionActions } from '@/components/documents/document-version-actions';
import { getDocumentById, listDocumentVersions } from '@/lib/documents';
import { getCurrentAuthUser } from '@/lib/supabase/auth-session';

type DocumentDetailsPageProps = {
  params: { id: string };
  searchParams?: { success?: string; success2?: string; error?: string };
};

export default async function DocumentDetailsPage({ params, searchParams }: DocumentDetailsPageProps) {
  const [document, versions, currentUser] = await Promise.all([
    getDocumentById(params.id),
    listDocumentVersions(params.id).catch(() => []),
    getCurrentAuthUser(),
  ]);

  if (!document) {
    return (
      <Card className="p-6">
        <h1 className="text-xl font-bold text-brand-navy dark:text-slate-100">المستند</h1>
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          المستند غير موجود أو لا تملك صلاحية الوصول.
        </p>
        <div className="mt-4">
          <Link href="/app/documents" className={buttonVariants('outline', 'sm')}>
            العودة إلى المستندات
          </Link>
        </div>
      </Card>
    );
  }

  const success = searchParams?.success ? safeDecode(searchParams.success) : '';
  const success2 = searchParams?.success2 ? safeDecode(searchParams.success2) : '';
  const error = searchParams?.error ? safeDecode(searchParams.error) : '';

  const latest = versions[0] ?? null;

  return (
    <Card className="space-y-5 p-6">
      <Breadcrumbs
        className="mb-1"
        items={[
          { label: 'لوحة التحكم', href: '/app' },
          { label: 'المستندات', href: '/app/documents' },
          { label: document.title },
        ]}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-brand-navy dark:text-slate-100">{document.title}</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            {document.matter ? `مرتبط بالقضية: ${document.matter.title}` : 'غير مرتبط بقضية'}{' '}
            {document.client ? `· الموكل: ${document.client.name}` : ''}
          </p>
        </div>
        <Link href="/app/documents" className={buttonVariants('outline', 'sm')}>
          رجوع
        </Link>
      </div>

      {success ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200">
          {success}
        </p>
      ) : null}
      {success2 ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200">
          {success2}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <DocumentShareButton documentId={document.id} label="مشاركة" />
        <Badge variant="default">عدد النسخ: {versions.length}</Badge>
      </div>

      <section className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-lg border border-brand-border p-4 dark:border-slate-700">
          <h2 className="font-semibold text-brand-navy dark:text-slate-100">إجراءات</h2>
          <div className="mt-4">
            <DocumentVersionActions documentId={document.id} latestStoragePath={latest?.storage_path ?? null} />
          </div>
        </div>

        <div className="rounded-lg border border-brand-border p-4 dark:border-slate-700">
          <h2 className="font-semibold text-brand-navy dark:text-slate-100">النسخ</h2>
          {!versions.length ? (
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">لا توجد نسخ بعد.</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b border-brand-border text-slate-600 dark:border-slate-700 dark:text-slate-300">
                  <tr>
                    <th className="py-2 text-start font-medium">الإصدار</th>
                    <th className="py-2 text-start font-medium">الملف</th>
                    <th className="py-2 text-start font-medium">الحجم</th>
                    <th className="py-2 text-start font-medium">تاريخ الرفع</th>
                    <th className="py-2 text-start font-medium">الرافع</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-border dark:divide-slate-800">
                  {versions.map((v) => (
                    <tr key={v.id}>
                      <td className="py-2 text-slate-700 dark:text-slate-200">v{v.version_no}</td>
                      <td className="py-2 text-slate-700 dark:text-slate-200">{v.file_name}</td>
                      <td className="py-2 text-slate-700 dark:text-slate-200">{formatBytes(v.file_size)}</td>
                      <td className="py-2 text-slate-700 dark:text-slate-200">
                        {new Date(v.created_at).toLocaleString('ar-SA')}
                      </td>
                      <td className="py-2 text-slate-700 dark:text-slate-200">
                        {currentUser?.id && v.uploaded_by === currentUser.id ? 'أنت' : v.uploaded_by}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </Card>
  );
}

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = value;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}
