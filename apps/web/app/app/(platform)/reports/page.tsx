import { createSupabaseServerRlsClient } from '@/lib/supabase/server';
import { getCurrentOrgIdForUser } from '@/lib/org';

type MatterStatus = 'new' | 'in_progress' | 'on_hold' | 'closed' | 'archived';

const statusLabels: Record<MatterStatus, string> = {
  new: 'جديدة',
  in_progress: 'قيد العمل',
  on_hold: 'معلقة',
  closed: 'مغلقة',
  archived: 'مؤرشفة',
};

export default async function ReportsPage() {
  const orgId = await getCurrentOrgIdForUser();
  if (!orgId) {
    return (
      <section className="rounded-lg border border-brand-border bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
        <h1 className="text-xl font-bold text-brand-navy dark:text-slate-100">التقارير</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">لا يوجد مكتب مفعّل لهذا الحساب بعد.</p>
      </section>
    );
  }

  const supabase = createSupabaseServerRlsClient();

  const [{ data: matters }, { count: overdueCount }, { data: unpaidInvoices }] = await Promise.all([
    supabase.from('matters').select('status').eq('org_id', orgId).limit(500),
    supabase
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .lt('due_at', new Date().toISOString())
      .in('status', ['todo', 'doing']),
    supabase
      .from('invoices')
      .select('total, status')
      .eq('org_id', orgId)
      .in('status', ['unpaid', 'partial'])
      .limit(500),
  ]);

  const statusCounts = new Map<MatterStatus, number>();
  (matters as Array<{ status: MatterStatus }> | null)?.forEach((row) => {
    statusCounts.set(row.status, (statusCounts.get(row.status) ?? 0) + 1);
  });

  const unpaidTotal = (unpaidInvoices as Array<{ total: string }> | null)?.reduce((sum, row) => {
    const value = Number(row.total);
    return sum + (Number.isFinite(value) ? value : 0);
  }, 0) ?? 0;

  return (
    <section className="rounded-lg border border-brand-border bg-white p-6 shadow-panel dark:border-slate-700 dark:bg-slate-900">
      <h1 className="text-xl font-bold text-brand-navy dark:text-slate-100">التقارير</h1>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">ملخصات سريعة للإدارة.</p>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <article className="rounded-lg border border-brand-border p-4 dark:border-slate-700">
          <h2 className="text-sm font-semibold text-brand-navy dark:text-slate-100">القضايا حسب الحالة</h2>
          <div className="mt-3 space-y-2 text-sm text-slate-700 dark:text-slate-200">
            {Object.keys(statusLabels).map((key) => {
              const status = key as MatterStatus;
              const value = statusCounts.get(status) ?? 0;
              return (
                <div key={status} className="flex justify-between gap-3">
                  <span>{statusLabels[status]}</span>
                  <span className="font-medium">{value}</span>
                </div>
              );
            })}
          </div>
        </article>

        <article className="rounded-lg border border-brand-border p-4 dark:border-slate-700">
          <h2 className="text-sm font-semibold text-brand-navy dark:text-slate-100">المهام المتأخرة</h2>
          <p className="mt-3 text-3xl font-bold text-brand-navy dark:text-slate-100">{overdueCount ?? 0}</p>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            مهام تاريخ استحقاقها قبل الآن ولم تُنجز.
          </p>
        </article>

        <article className="rounded-lg border border-brand-border p-4 dark:border-slate-700">
          <h2 className="text-sm font-semibold text-brand-navy dark:text-slate-100">إجمالي الفواتير غير المسددة</h2>
          <p className="mt-3 text-3xl font-bold text-brand-navy dark:text-slate-100">
            {unpaidTotal.toFixed(2)} SAR
          </p>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            مجموع فواتير حالتها (غير مدفوعة/جزئية).
          </p>
        </article>
      </div>
    </section>
  );
}

