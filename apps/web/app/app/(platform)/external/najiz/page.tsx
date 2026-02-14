import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { EmptyState } from '@/components/ui/empty-state';
import { buttonVariants } from '@/components/ui/button';
import { requireOrgIdForUser } from '@/lib/org';
import { createSupabaseServerRlsClient } from '@/lib/supabase/server';

type ExternalCaseRow = {
  id: string;
  external_id: string;
  title: string;
  court: string | null;
  status: string | null;
  last_synced_at: string;
};

export default async function NajizExternalCasesPage() {
  let orgId = '';

  try {
    orgId = await requireOrgIdForUser();
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
    .select('id, external_id, title, court, status, last_synced_at')
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
    <Card className="p-6 space-y-5">
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
            هذه بيانات مرجعية مستوردة. لإنشاء قضية داخل مسار، اختر "إنشاء قضية في مسار" ثم حدّد الموكل يدويًا.
          </p>
        </div>
        <Link href="/app/settings/integrations/najiz" className={buttonVariants('outline', 'sm')}>
          إعدادات ناجز
        </Link>
      </div>

      <div className="overflow-x-auto rounded-lg border border-brand-border dark:border-slate-700">
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
                  <Link
                    href={`/app/matters/new?title=${encodeURIComponent(row.title)}`}
                    className={buttonVariants('primary', 'sm')}
                  >
                    إنشاء قضية في مسار
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

