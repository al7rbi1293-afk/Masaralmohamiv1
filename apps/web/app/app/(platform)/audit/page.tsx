import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { requireOwner } from '@/lib/org';
import { createSupabaseServerRlsClient } from '@/lib/supabase/server';

type AuditPageProps = {
  searchParams?: {
    from?: string;
    to?: string;
    action?: string;
    page?: string;
  };
};

export default async function AuditPage({ searchParams }: AuditPageProps) {
  let orgId = '';
  let userId = '';
  try {
    const owner = await requireOwner();
    orgId = owner.orgId;
    userId = owner.userId;
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'الرجاء تسجيل الدخول.') {
      return (
        <Card className="p-6">
          <p className="text-sm text-slate-700 dark:text-slate-200">يرجى تسجيل الدخول.</p>
        </Card>
      );
    }

    if (message === 'لا تملك صلاحية تنفيذ هذا الإجراء.') {
      return (
        <Card className="p-6">
          <h1 className="text-xl font-bold text-brand-navy dark:text-slate-100">سجل التدقيق</h1>
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
            لا تملك صلاحية الوصول.
          </p>
          <div className="mt-4">
            <Link href="/app" className={buttonVariants('outline', 'sm')}>
              العودة للوحة التحكم
            </Link>
          </div>
        </Card>
      );
    }

    return (
      <Card className="p-6">
        <h1 className="text-xl font-bold text-brand-navy dark:text-slate-100">سجل التدقيق</h1>
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          {message || 'تعذر تحميل السجل.'}
        </p>
        <div className="mt-4">
          <Link href="/app" className={buttonVariants('outline', 'sm')}>
            العودة للوحة التحكم
          </Link>
        </div>
      </Card>
    );
  }

  const supabase = createSupabaseServerRlsClient();

  const today = new Date();
  const defaultFrom = new Date(today);
  defaultFrom.setDate(defaultFrom.getDate() - 7);

  const fromRaw = (searchParams?.from ?? toDateOnly(defaultFrom)).trim();
  const toRaw = (searchParams?.to ?? toDateOnly(today)).trim();
  const action = (searchParams?.action ?? '').trim();
  const page = Math.max(1, Number(searchParams?.page ?? '1') || 1);

  const fromIso = startOfDayIso(fromRaw);
  const toIso = endOfDayIso(toRaw);

  const limit = 20;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase
    .from('audit_logs')
    .select('id, user_id, action, entity_type, entity_id, meta, created_at', { count: 'exact' })
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .gte('created_at', fromIso)
    .lte('created_at', toIso)
    .range(from, to);

  if (action) {
    query = query.eq('action', action);
  }

  const { data, error, count } = await query;
  if (error) {
    return (
      <Card className="p-6">
        <h1 className="text-xl font-bold text-brand-navy dark:text-slate-100">سجل التدقيق</h1>
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          تعذر تحميل السجل.
        </p>
        <div className="mt-4">
          <Link href="/app" className={buttonVariants('outline', 'sm')}>
            العودة للوحة التحكم
          </Link>
        </div>
      </Card>
    );
  }

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const hasPrevious = page > 1;
  const hasNext = page < totalPages;

  const previousQuery = buildQuery({ from: fromRaw, to: toRaw, action, page: Math.max(1, page - 1) });
  const nextQuery = buildQuery({ from: fromRaw, to: toRaw, action, page: Math.min(totalPages, page + 1) });

  return (
    <Card className="p-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold text-brand-navy dark:text-slate-100">سجل التدقيق</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          آخر العمليات الحساسة داخل المكتب (للمالك فقط).
        </p>
      </div>

      <form className="grid gap-3 rounded-lg border border-brand-border p-4 dark:border-slate-700 sm:grid-cols-[1fr_1fr_1fr_auto]">
        <label className="block space-y-1 text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-200">من</span>
          <input
            type="date"
            name="from"
            defaultValue={fromRaw}
            className="h-11 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
          />
        </label>

        <label className="block space-y-1 text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-200">إلى</span>
          <input
            type="date"
            name="to"
            defaultValue={toRaw}
            className="h-11 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
          />
        </label>

        <label className="block space-y-1 text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-200">الإجراء (اختياري)</span>
          <input
            name="action"
            defaultValue={action}
            placeholder="مثال: invoice.created"
            className="h-11 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
          />
        </label>

        <button type="submit" className={buttonVariants('outline', 'sm')}>
          تطبيق
        </button>
      </form>

      {!data?.length ? (
        <div className="rounded-lg border border-brand-border p-6 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">
          لا توجد سجلات ضمن هذا النطاق.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-brand-border dark:border-slate-700">
          <table className="min-w-full text-sm">
            <thead className="border-b border-brand-border text-slate-600 dark:border-slate-700 dark:text-slate-300">
              <tr>
                <th className="px-3 py-3 text-start font-medium">الوقت</th>
                <th className="px-3 py-3 text-start font-medium">المستخدم</th>
                <th className="px-3 py-3 text-start font-medium">الإجراء</th>
                <th className="px-3 py-3 text-start font-medium">الكيان</th>
                <th className="px-3 py-3 text-start font-medium">تفاصيل</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-border dark:divide-slate-800">
              {data.map((row: any) => (
                <tr key={row.id} className="hover:bg-brand-background/60 dark:hover:bg-slate-800/60">
                  <td className="px-3 py-3 text-slate-700 dark:text-slate-200">
                    {new Date(row.created_at).toLocaleString('ar-SA')}
                  </td>
                  <td className="px-3 py-3 text-slate-700 dark:text-slate-200">
                    {row.user_id ? (row.user_id === userId ? 'أنت' : 'عضو الفريق') : 'النظام'}
                  </td>
                  <td className="px-3 py-3">
                    <Badge variant="default">{row.action}</Badge>
                  </td>
                  <td className="px-3 py-3 text-slate-700 dark:text-slate-200">
                    {row.entity_type ?? '—'}
                  </td>
                  <td className="px-3 py-3 text-xs text-slate-600 dark:text-slate-300">
                    {renderMeta(row.meta)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600 dark:text-slate-300">
        <p>
          الصفحة {page} من {totalPages} ({total} سجل)
        </p>
        <div className="flex items-center gap-2">
          <Link
            aria-disabled={!hasPrevious}
            href={{ pathname: '/app/audit', query: previousQuery }}
            className={`${buttonVariants('outline', 'sm')} ${!hasPrevious ? 'pointer-events-none opacity-50' : ''}`}
          >
            السابق
          </Link>
          <Link
            aria-disabled={!hasNext}
            href={{ pathname: '/app/audit', query: nextQuery }}
            className={`${buttonVariants('outline', 'sm')} ${!hasNext ? 'pointer-events-none opacity-50' : ''}`}
          >
            التالي
          </Link>
        </div>
      </div>
    </Card>
  );
}

function buildQuery(params: { from: string; to: string; action: string; page: number }) {
  const query: Record<string, string> = { page: String(params.page) };
  if (params.from) query.from = params.from;
  if (params.to) query.to = params.to;
  if (params.action) query.action = params.action;
  return query;
}

function toDateOnly(value: Date) {
  const yyyy = value.getFullYear();
  const mm = String(value.getMonth() + 1).padStart(2, '0');
  const dd = String(value.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function startOfDayIso(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  return date.toISOString();
}

function endOfDayIso(value: string) {
  const date = new Date(`${value}T23:59:59.999Z`);
  return date.toISOString();
}

function renderMeta(meta: unknown) {
  if (!meta) return '—';
  try {
    const text = JSON.stringify(meta);
    return text.length > 140 ? `${text.slice(0, 140)}…` : text;
  } catch {
    return '—';
  }
}
