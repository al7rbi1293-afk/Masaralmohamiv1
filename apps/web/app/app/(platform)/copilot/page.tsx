import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { listMatters } from '@/lib/matters';
import { isCopilotEnabled } from '@/lib/env';

type CopilotLandingPageProps = {
  searchParams?: {
    q?: string;
    page?: string;
  };
};

export default async function CopilotLandingPage({ searchParams }: CopilotLandingPageProps) {
  if (!isCopilotEnabled()) {
    return (
      <Card className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-brand-navy dark:text-slate-100">الذكاء الاصطناعي</h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              الميزة موقوفة مؤقتًا للتحكم بالتكاليف، وسيتم إطلاقها قريبًا بشكل أفضل.
            </p>
          </div>
          <Badge variant="warning">قريبًا</Badge>
        </div>
        <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
          يمكنك متابعة إدارة القضايا والمستندات والمهام بشكل كامل حتى تفعيل الخدمة.
        </div>
      </Card>
    );
  }

  const q = (searchParams?.q ?? '').trim();
  const page = Math.max(1, Number(searchParams?.page ?? '1') || 1);

  const matters = await listMatters({
    q,
    status: 'all',
    page,
    limit: 10,
  });

  const totalPages = Math.max(1, Math.ceil(matters.total / matters.limit));
  const hasPrevious = matters.page > 1;
  const hasNext = matters.page < totalPages;

  const previousQuery = buildQuery({
    q,
    page: Math.max(1, matters.page - 1),
  });
  const nextQuery = buildQuery({
    q,
    page: Math.min(totalPages, matters.page + 1),
  });

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-brand-navy dark:text-slate-100">الذكاء الاصطناعي</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            اختر قضية لبدء المحادثة مع المساعد القانوني المرتبط ببياناتها ومستنداتها.
          </p>
        </div>
      </div>

      <form className="mt-5 grid gap-3 grid-cols-1 sm:grid-cols-[1fr_auto]">
        <label className="block">
          <span className="sr-only">بحث</span>
          <input
            name="q"
            defaultValue={q}
            placeholder="ابحث بعنوان القضية..."
            className="h-11 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
          />
        </label>

        <button type="submit" className={buttonVariants('outline', 'sm')}>
          بحث
        </button>
      </form>

      {!matters.data.length ? (
        <div className="mt-8">
          <EmptyState
            title="الذكاء الاصطناعي"
            message="لا توجد قضايا متاحة الآن لبدء المساعد القانوني."
            backHref="/app/matters/new"
            backLabel="إنشاء قضية"
          />
        </div>
      ) : (
        <>
          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-brand-border text-slate-600 dark:border-slate-700 dark:text-slate-300">
                <tr>
                  <th className="py-3 text-start font-medium">القضية</th>
                  <th className="py-3 text-start font-medium">الخصوصية</th>
                  <th className="py-3 text-start font-medium">آخر تحديث</th>
                  <th className="py-3 text-start font-medium">الإجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border dark:divide-slate-800">
                {matters.data.map((matter) => (
                  <tr key={matter.id} className="hover:bg-brand-background/60 dark:hover:bg-slate-800/60">
                    <td className="py-3 font-medium text-brand-navy dark:text-slate-100">{matter.title}</td>
                    <td className="py-3">
                      <Badge variant={matter.is_private ? 'warning' : 'default'}>
                        {matter.is_private ? 'خاصة' : 'عامة'}
                      </Badge>
                    </td>
                    <td className="py-3 text-slate-700 dark:text-slate-200">
                      {new Date(matter.updated_at).toLocaleDateString('ar-SA')}
                    </td>
                    <td className="py-3">
                      <Link href={`/app/matters/${matter.id}/copilot`} className={buttonVariants('primary', 'sm')}>
                        فتح المساعد
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600 dark:text-slate-300">
            <p>
              الصفحة {matters.page} من {totalPages} ({matters.total} قضية)
            </p>
            <div className="flex items-center gap-2">
              <Link
                aria-disabled={!hasPrevious}
                href={{ pathname: '/app/copilot', query: previousQuery }}
                className={`${buttonVariants('outline', 'sm')} ${!hasPrevious ? 'pointer-events-none opacity-50' : ''}`}
              >
                السابق
              </Link>
              <Link
                aria-disabled={!hasNext}
                href={{ pathname: '/app/copilot', query: nextQuery }}
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

function buildQuery(params: { q: string; page: number }) {
  const query: Record<string, string> = {
    page: String(params.page),
  };

  if (params.q) query.q = params.q;

  return query;
}
