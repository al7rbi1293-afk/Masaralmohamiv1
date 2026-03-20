import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { EmptyState } from '@/components/ui/empty-state';
import { buttonVariants } from '@/components/ui/button';
import { requireOrgIdForUser } from '@/lib/org';
import { createSupabaseServerRlsClient } from '@/lib/supabase/server';
import { getOrgPlanLimits } from '@/lib/plan-limits';

type ExternalCaseRow = {
  id: string;
  external_id: string;
  title: string;
  court: string | null;
  status: string | null;
  last_synced_at: string;
  matter_id: string | null;
};

type NajizExternalCasesPageProps = {
  searchParams?: {
    error?: string;
    success?: string;
  };
};

export default async function NajizExternalCasesPage({ searchParams }: NajizExternalCasesPageProps) {
  let orgId = '';
  const successMessage = searchParams?.success ? safeDecode(searchParams.success) : '';
  const errorMessage = searchParams?.error ? safeDecode(searchParams.error) : '';

  try {
    orgId = await requireOrgIdForUser();
    const { limits } = await getOrgPlanLimits(orgId);
    if (!limits.najiz_integration) {
      return (
        <Card className="p-10 text-center space-y-6 flex flex-col items-center justify-center min-h-[400px]">
          <div className="bg-brand-emerald/10 p-4 rounded-full">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-brand-emerald"
            >
              <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <div className="max-w-md space-y-2">
            <h1 className="text-2xl font-bold text-brand-navy dark:text-slate-100">نسخة الشركات فقط</h1>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
              هذه الميزة جزء من نسخة الشركات المخصصة للتكاملات الحكومية، ولا تظهر على الباقات العادية 250 و500 و750. يمكنك الترقية إذا كنت ترغب في تفعيل ربط ناجز.
            </p>
          </div>
          <div className="flex gap-3">
            <Link href="/app/settings/subscription" className={buttonVariants('primary', 'lg')}>
              ترقية الآن
            </Link>
            <Link href="/app" className={buttonVariants('outline', 'lg')}>
              العودة للمنصة
            </Link>
          </div>
        </Card>
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'لا تملك صلاحية الوصول.';
    return (
      <Card className="p-6">
        <EmptyState title="بيانات ناجز" message={message} backHref="/app" backLabel="العودة للمنصة" />
      </Card>
    );
  }

  const supabase = createSupabaseServerRlsClient();
  const { data, error } = await supabase
    .from('external_cases')
    .select('id, external_id, title, court, status, last_synced_at, matter_id')
    .eq('org_id', orgId)
    .eq('provider', 'najiz')
    .order('last_synced_at', { ascending: false })
    .limit(200);

  if (error) {
    return (
      <Card className="p-6 space-y-4">
        <h1 className="text-xl font-bold text-brand-navy dark:text-slate-100">بيانات ناجز</h1>
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          تعذر تحميل البيانات. {error.message}
        </p>
        <Link href="/app/settings/integrations/najiz" className={buttonVariants('outline', 'sm')}>
          العودة إلى إعدادات ناجز
        </Link>
      </Card>
    );
  }

  const rows = ((data as ExternalCaseRow[] | null) ?? []).filter(Boolean);

  if (!rows.length) {
    return (
      <Card className="p-6">
        <EmptyState
          title="لا توجد بيانات مستوردة"
          message="لم يتم العثور على حالات مستوردة من ناجز. نفّذ المزامنة أولًا من صفحة التكامل."
          backHref="/app/settings/integrations/najiz"
          backLabel="الذهاب لصفحة التكامل"
        />
      </Card>
    );
  }

  return (
    <Card className="space-y-5 p-4 sm:p-6">
      <Breadcrumbs
        items={[
          { label: 'لوحة التحكم', href: '/app' },
          { label: 'التكاملات', href: '/app/settings/integrations/najiz' },
          { label: 'بيانات ناجز' },
        ]}
      />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-brand-navy dark:text-slate-100">بيانات ناجز</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            هذه بيانات مرجعية مستوردة. يمكنك استيراد القضية مباشرة إلى مسار، أو فتح القضية المرتبطة إذا كانت موجودة بالفعل.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/app/external/najiz/verify-lawyer" className={buttonVariants('outline', 'sm')}>
            التحقق من المحامي
          </Link>
          <Link href="/app/settings/integrations/najiz" className={buttonVariants('outline', 'sm')}>
            إعدادات ناجز
          </Link>
        </div>
      </div>

      {successMessage ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200">
          {successMessage}
        </p>
      ) : null}

      {errorMessage ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          {errorMessage}
        </p>
      ) : null}

      <div className="space-y-3 md:hidden">
        {rows.map((row) => (
          <article key={row.id} className="rounded-lg border border-brand-border p-3 dark:border-slate-700">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-brand-navy dark:text-slate-100">{row.title}</h3>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">#{row.external_id}</p>
              </div>
              {row.matter_id ? (
                <span className="rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200">
                  مرتبطة
                </span>
              ) : null}
            </div>

            <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-md bg-brand-background/70 px-2 py-2 dark:bg-slate-800/70">
                <dt className="text-xs text-slate-500 dark:text-slate-400">المحكمة</dt>
                <dd className="mt-1 font-medium text-slate-700 dark:text-slate-200">{row.court || '—'}</dd>
              </div>
              <div className="rounded-md bg-brand-background/70 px-2 py-2 dark:bg-slate-800/70">
                <dt className="text-xs text-slate-500 dark:text-slate-400">الحالة</dt>
                <dd className="mt-1 font-medium text-slate-700 dark:text-slate-200">{row.status || '—'}</dd>
              </div>
              <div className="col-span-2 rounded-md bg-brand-background/70 px-2 py-2 dark:bg-slate-800/70">
                <dt className="text-xs text-slate-500 dark:text-slate-400">آخر مزامنة</dt>
                <dd className="mt-1 font-medium text-slate-700 dark:text-slate-200">
                  {new Date(row.last_synced_at).toLocaleString('ar-SA')}
                </dd>
              </div>
            </dl>

            <div className="mt-3">
              <NajizExternalCaseActions row={row} />
            </div>
          </article>
        ))}
      </div>

      <div className="hidden overflow-x-auto rounded-lg border border-brand-border md:block dark:border-slate-700">
        <table className="min-w-full text-sm">
          <thead className="bg-brand-background text-slate-700 dark:bg-slate-800 dark:text-slate-100">
            <tr>
              <th className="px-3 py-2 text-right font-semibold">العنوان</th>
              <th className="px-3 py-2 text-right font-semibold">المحكمة</th>
              <th className="px-3 py-2 text-right font-semibold">الحالة</th>
              <th className="px-3 py-2 text-right font-semibold">آخر مزامنة</th>
              <th className="px-3 py-2 text-right font-semibold">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-brand-border dark:border-slate-700">
                <td className="px-3 py-3 align-top">
                  <div className="font-medium text-slate-800 dark:text-slate-100">{row.title}</div>
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">#{row.external_id}</div>
                </td>
                <td className="px-3 py-3 align-top text-slate-700 dark:text-slate-200">{row.court || '—'}</td>
                <td className="px-3 py-3 align-top text-slate-700 dark:text-slate-200">{row.status || '—'}</td>
                <td className="px-3 py-3 align-top text-slate-700 dark:text-slate-200">
                  {new Date(row.last_synced_at).toLocaleString('ar-SA')}
                </td>
                <td className="px-3 py-3 align-top">
                  <NajizExternalCaseActions row={row} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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

function NajizExternalCaseActions({ row }: { row: ExternalCaseRow }) {
  if (row.matter_id) {
    return (
      <Link href={`/app/matters/${row.matter_id}`} className={buttonVariants('primary', 'sm')}>
        فتح القضية
      </Link>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      <form action={`/app/api/integrations/najiz/external-cases/${row.id}/import`} method="post">
        <button type="submit" className={buttonVariants('primary', 'sm')}>
          استيراد إلى قضية
        </button>
      </form>
      <Link href={`/app/matters/new?title=${encodeURIComponent(row.title)}`} className={buttonVariants('outline', 'sm')}>
        إنشاء يدوي
      </Link>
    </div>
  );
}
