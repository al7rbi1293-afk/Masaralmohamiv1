import { Card } from '@/components/ui/card';
import { requireOrgIdForUser } from '@/lib/org';
import { createSupabaseServerRlsClient } from '@/lib/supabase/server';

type MatterStatus = 'new' | 'in_progress' | 'on_hold' | 'closed' | 'archived';

const matterStatuses: Array<{ key: MatterStatus; label: string }> = [
  { key: 'new', label: 'جديدة' },
  { key: 'in_progress', label: 'قيد العمل' },
  { key: 'on_hold', label: 'معلّقة' },
  { key: 'closed', label: 'مغلقة' },
  { key: 'archived', label: 'مؤرشفة' },
];

export default async function ReportsPage() {
  const orgId = await requireOrgIdForUser();
  const supabase = createSupabaseServerRlsClient();

  const nowIso = new Date().toISOString();

  const [clientsCount, overdueTasksCount, unpaidInvoices, mattersCounts] = await Promise.all([
    supabase
      .from('clients')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('status', 'active')
      .then(({ count }) => count ?? 0),
    supabase
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .not('due_at', 'is', null)
      .lt('due_at', nowIso)
      .in('status', ['todo', 'doing'])
      .then(({ count }) => count ?? 0),
    supabase
      .from('invoices')
      .select('total, status')
      .eq('org_id', orgId)
      .in('status', ['unpaid', 'partial'])
      .then(({ data }) => {
        const rows = (data as Array<{ total: string; status: string }> | null) ?? [];
        const sum = rows.reduce((acc, row) => acc + (Number(row.total) || 0), 0);
        return Math.round((sum + Number.EPSILON) * 100) / 100;
      }),
    Promise.all(
      matterStatuses.map((status) =>
        supabase
          .from('matters')
          .select('id', { count: 'exact', head: true })
          .eq('org_id', orgId)
          .eq('status', status.key)
          .then(({ count }) => ({ key: status.key, count: count ?? 0 })),
      ),
    ),
  ]);

  const mattersByStatus = new Map<MatterStatus, number>();
  mattersCounts.forEach((entry) => mattersByStatus.set(entry.key, entry.count));
  const maxMatters = Math.max(1, ...matterStatuses.map((s) => mattersByStatus.get(s.key) ?? 0));

  return (
    <Card className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-brand-navy dark:text-slate-100">التقارير</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          نظرة سريعة على أداء المكتب داخل التجربة.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <MetricCard title="عدد العملاء النشطين" value={String(clientsCount)} note="عملاء بحالة نشط" />
        <MetricCard title="المهام المتأخرة" value={String(overdueTasksCount)} note="مهام لها استحقاق وتجاوزت الموعد" />
        <MetricCard
          title="إجمالي الفواتير غير المسددة"
          value={`${formatMoney(unpaidInvoices)} SAR`}
          note="الفواتير غير المسددة/الجزئية"
        />
      </div>

      <section className="rounded-lg border border-brand-border p-4 dark:border-slate-700">
        <h2 className="font-semibold text-brand-navy dark:text-slate-100">القضايا حسب الحالة</h2>
        <div className="mt-4 space-y-3">
          {matterStatuses.map((status) => {
            const count = mattersByStatus.get(status.key) ?? 0;
            const pct = Math.round((count / maxMatters) * 100);
            return (
              <div key={status.key} className="space-y-1">
                <div className="flex items-center justify-between text-sm text-slate-700 dark:text-slate-200">
                  <span className="font-medium">{status.label}</span>
                  <span>{count}</span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className="h-2 rounded-full bg-brand-emerald"
                    style={{ width: `${pct}%` }}
                    aria-hidden="true"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </Card>
  );
}

function MetricCard({ title, value, note }: { title: string; value: string; note: string }) {
  return (
    <div className="rounded-lg border border-brand-border p-4 dark:border-slate-700">
      <p className="text-sm text-slate-600 dark:text-slate-300">{title}</p>
      <p className="mt-2 text-2xl font-bold text-brand-navy dark:text-slate-100">{value}</p>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{note}</p>
    </div>
  );
}

function formatMoney(value: number) {
  const safe = Number.isFinite(value) ? value : 0;
  return safe.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

