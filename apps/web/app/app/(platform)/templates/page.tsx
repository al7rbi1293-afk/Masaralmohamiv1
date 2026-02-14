import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConfirmActionForm } from '@/components/ui/confirm-action-form';
import { EmptyState } from '@/components/ui/empty-state';
import { listTemplates, listTemplateCategories, type TemplateStatus, type TemplateType } from '@/lib/templates';
import { archiveTemplateAction, restoreTemplateAction } from './actions';

type TemplatesPageProps = {
  searchParams?: {
    q?: string;
    category?: string;
    status?: string;
    page?: string;
    success?: string;
    error?: string;
  };
};

const typeLabel: Record<TemplateType, string> = {
  docx: 'DOCX',
  pdf: 'PDF',
};

export default async function TemplatesPage({ searchParams }: TemplatesPageProps) {
  const q = (searchParams?.q ?? '').trim();
  const category = (searchParams?.category ?? '').trim();
  const statusRaw = (searchParams?.status ?? 'active').trim();
  const status: TemplateStatus | 'all' =
    statusRaw === 'all' || statusRaw === 'archived' || statusRaw === 'active' ? statusRaw : 'active';
  const page = Math.max(1, Number(searchParams?.page ?? '1') || 1);

  const success = searchParams?.success ? safeDecode(searchParams.success) : '';
  const error = searchParams?.error ? safeDecode(searchParams.error) : '';

  let result: Awaited<ReturnType<typeof listTemplates>>;
  let categories: string[] = [];

  try {
    const [templates, categoriesList] = await Promise.all([
      listTemplates({ q, category: category || undefined, status, page, limit: 10 }),
      listTemplateCategories().catch(() => []),
    ]);
    result = templates;
    categories = categoriesList;
  } catch (fetchError) {
    const message =
      fetchError instanceof Error && fetchError.message ? fetchError.message : 'تعذر تحميل القوالب.';

    return (
      <Card className="p-6">
        <h1 className="text-xl font-bold text-brand-navy dark:text-slate-100">القوالب</h1>
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

  const previousQuery = buildQuery({ q, category, status, page: Math.max(1, result.page - 1) });
  const nextQuery = buildQuery({ q, category, status, page: Math.min(totalPages, result.page + 1) });

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-brand-navy dark:text-slate-100">القوالب</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            مكتبة قوالب المكتب مع النسخ والمتغيرات.
          </p>
        </div>
        <Link href="/app/templates/new" className={buttonVariants('primary', 'sm')}>
          + قالب جديد
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

      <form className="mt-5 grid gap-3 sm:grid-cols-[1fr_200px_180px_auto]">
        <label className="block">
          <span className="sr-only">بحث</span>
          <input
            name="q"
            defaultValue={q}
            placeholder="ابحث باسم القالب..."
            className="h-11 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
          />
        </label>

        <label className="block">
          <span className="sr-only">التصنيف</span>
          <select
            name="category"
            defaultValue={category}
            className="h-11 w-full rounded-lg border border-brand-border bg-white px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="">كل التصنيفات</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
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
          <EmptyState title="القوالب" message="لا توجد قوالب بعد." backHref="/app/templates/new" backLabel="إضافة قالب" />
        </div>
      ) : (
        <>
          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-brand-border text-slate-600 dark:border-slate-700 dark:text-slate-300">
                <tr>
                  <th className="py-3 text-start font-medium">الاسم</th>
                  <th className="py-3 text-start font-medium">التصنيف</th>
                  <th className="py-3 text-start font-medium">النوع</th>
                  <th className="py-3 text-start font-medium">الحالة</th>
                  <th className="py-3 text-start font-medium">آخر تحديث</th>
                  <th className="py-3 text-start font-medium">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border dark:divide-slate-800">
                {result.data.map((template) => (
                  <tr key={template.id} className="hover:bg-brand-background/60 dark:hover:bg-slate-800/60">
                    <td className="py-3 font-medium text-brand-navy dark:text-slate-100">{template.name}</td>
                    <td className="py-3 text-slate-700 dark:text-slate-200">{template.category}</td>
                    <td className="py-3 text-slate-700 dark:text-slate-200">{typeLabel[template.template_type]}</td>
                    <td className="py-3">
                      <Badge variant={template.status === 'active' ? 'success' : 'warning'}>
                        {template.status === 'active' ? 'نشط' : 'مؤرشف'}
                      </Badge>
                    </td>
                    <td className="py-3 text-slate-700 dark:text-slate-200">
                      {new Date(template.updated_at).toLocaleDateString('ar-SA')}
                    </td>
                    <td className="py-3">
                      <div className="flex flex-wrap gap-2">
                        <Link href={`/app/templates/${template.id}`} className={buttonVariants('ghost', 'sm')}>
                          عرض
                        </Link>
                        {template.status === 'active' ? (
                          <ConfirmActionForm
                            action={archiveTemplateAction.bind(null, template.id, '/app/templates')}
                            triggerLabel="أرشفة"
                            triggerVariant="outline"
                            triggerSize="sm"
                            confirmTitle="أرشفة القالب"
                            confirmMessage="هل تريد أرشفة هذا القالب؟ يمكنك استعادته لاحقًا."
                            confirmLabel="أرشفة"
                            destructive
                          />
                        ) : (
                          <ConfirmActionForm
                            action={restoreTemplateAction.bind(null, template.id, '/app/templates')}
                            triggerLabel="استعادة"
                            triggerVariant="outline"
                            triggerSize="sm"
                            confirmTitle="استعادة القالب"
                            confirmMessage="هل تريد استعادة هذا القالب إلى الحالة النشطة؟"
                            confirmLabel="استعادة"
                            destructive={false}
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600 dark:text-slate-300">
            <p>
              الصفحة {result.page} من {totalPages} ({result.total} قالب)
            </p>
            <div className="flex items-center gap-2">
              <Link
                aria-disabled={!hasPrevious}
                href={{ pathname: '/app/templates', query: previousQuery }}
                className={`${buttonVariants('outline', 'sm')} ${!hasPrevious ? 'pointer-events-none opacity-50' : ''}`}
              >
                السابق
              </Link>
              <Link
                aria-disabled={!hasNext}
                href={{ pathname: '/app/templates', query: nextQuery }}
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

function buildQuery(params: { q: string; category: string; status: TemplateStatus | 'all'; page: number }) {
  const query: Record<string, string> = { page: String(params.page) };

  if (params.q) query.q = params.q;
  if (params.category) query.category = params.category;
  if (params.status && params.status !== 'active') query.status = params.status;

  return query;
}

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

