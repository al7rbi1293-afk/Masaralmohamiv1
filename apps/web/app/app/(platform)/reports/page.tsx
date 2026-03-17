import { Card } from '@/components/ui/card';
import { requireOrgIdForUser } from '@/lib/org';
import { createSupabaseServerRlsClient } from '@/lib/supabase/server';

type MatterStatus = 'new' | 'in_progress' | 'on_hold' | 'closed' | 'archived';

const matterStatuses: Array<{ key: MatterStatus; label: string; color: string }> = [
  { key: 'new', label: 'جديدة', color: 'bg-blue-500' },
  { key: 'in_progress', label: 'قيد العمل', color: 'bg-brand-emerald' },
  { key: 'on_hold', label: 'معلّقة', color: 'bg-amber-500' },
  { key: 'closed', label: 'مغلقة', color: 'bg-slate-400' },
  { key: 'archived', label: 'مؤرشفة', color: 'bg-slate-300' },
];

export default async function ReportsPage() {
  const orgId = await requireOrgIdForUser();
  const supabase = createSupabaseServerRlsClient();

  const nowIso = new Date().toISOString();
  const now = new Date();
  const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    clientsCount,
    overdueTasksCount,
    overdueTasksList,
    unpaidInvoiceRows,
    paidInvoiceRows,
    invoicesThisMonthCount,
    mattersCounts,
    openMattersCount,
    upcomingEventsCount,
    upcomingEventsList,
    docsGeneratedCount,
  ] = await Promise.all([
    // 1. Active clients
    supabase
      .from('clients')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('status', 'active')
      .then(({ count }) => count ?? 0),

    // 2. Overdue tasks count
    supabase
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('is_archived', false)
      .not('due_at', 'is', null)
      .lt('due_at', nowIso)
      .in('status', ['todo', 'doing'])
      .then(({ count }) => count ?? 0),

    // 3. Overdue tasks list (top 5)
    supabase
      .from('tasks')
      .select('id, title, due_at, matter_id, matters(title)')
      .eq('org_id', orgId)
      .eq('is_archived', false)
      .not('due_at', 'is', null)
      .lt('due_at', nowIso)
      .in('status', ['todo', 'doing'])
      .order('due_at', { ascending: true })
      .limit(5)
      .then(({ data }) => (data as unknown as Array<{ id: string; title: string; due_at: string; matter_id: string | null; matters: { title: string } | null }>) ?? []),

    // 4. Unpaid invoices
    supabase
      .from('invoices')
      .select('total, status')
      .eq('org_id', orgId)
      .eq('is_archived', false)
      .in('status', ['unpaid', 'partial'])
      .then(({ data }) => (data as Array<{ total: string; status: string }> | null) ?? []),

    // 5. Paid invoices
    supabase
      .from('invoices')
      .select('total')
      .eq('org_id', orgId)
      .eq('is_archived', false)
      .eq('status', 'paid')
      .then(({ data }) => (data as Array<{ total: string }> | null) ?? []),

    // 6. Invoices created this month
    supabase
      .from('invoices')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .gte('created_at', monthStart.toISOString())
      .then(({ count }) => count ?? 0),

    // 7. Matters by status
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

    // 8. Open matters count (new + in_progress)
    supabase
      .from('matters')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .in('status', ['new', 'in_progress'])
      .then(({ count }) => count ?? 0),

    // 9. Upcoming events count (next 7 days)
    supabase
      .from('calendar_events')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .gte('start_at', nowIso)
      .lt('start_at', sevenDaysLater.toISOString())
      .then(({ count }) => count ?? 0),

    // 10. Upcoming events list (top 5)
    supabase
      .from('calendar_events')
      .select('id, title, start_at, matter_id, matters(title)')
      .eq('org_id', orgId)
      .gte('start_at', nowIso)
      .lt('start_at', sevenDaysLater.toISOString())
      .order('start_at', { ascending: true })
      .limit(5)
      .then(({ data }) => (data as unknown as Array<{ id: string; title: string; start_at: string; matter_id: string | null; matters: { title: string } | null }>) ?? []),

    // 11. Docs generated this month
    supabase
      .from('doc_generations')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('status', 'exported')
      .gte('created_at', monthStart.toISOString())
      .then(({ count }) => count ?? 0),
  ]);

  // Compute invoice amounts
  const unpaidTotal = unpaidInvoiceRows.reduce((acc, row) => acc + (Number(row.total) || 0), 0);
  const paidTotal = paidInvoiceRows.reduce((acc, row) => acc + (Number(row.total) || 0), 0);
  const grandTotal = paidTotal + unpaidTotal;
  const collectedPct = grandTotal > 0 ? Math.round((paidTotal / grandTotal) * 100) : 0;

  // Matters chart
  const mattersByStatus = new Map<MatterStatus, number>();
  mattersCounts.forEach((entry) => mattersByStatus.set(entry.key, entry.count));
  const totalMatters = matterStatuses.reduce((acc, s) => acc + (mattersByStatus.get(s.key) ?? 0), 0);
  const maxMatters = Math.max(1, ...matterStatuses.map((s) => mattersByStatus.get(s.key) ?? 0));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-brand-navy dark:text-slate-100">التقارير</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          نظرة شاملة على أداء المكتب والبيانات التشغيلية.
        </p>
      </div>

      {/* Row 1: 6 Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          title="عدد العملاء النشطين"
          value={String(clientsCount)}
          note="عملاء بحالة نشط"
          icon="👥"
          accent="border-l-blue-500"
        />
        <MetricCard
          title="القضايا المفتوحة"
          value={String(openMattersCount)}
          note="قضايا جديدة أو قيد العمل"
          icon="📂"
          accent="border-l-brand-emerald"
        />
        <MetricCard
          title="المهام المتأخرة"
          value={String(overdueTasksCount)}
          note="مهام تجاوزت موعد الاستحقاق"
          icon="⏰"
          accent={overdueTasksCount > 0 ? 'border-l-red-500' : 'border-l-slate-300'}
        />
        <MetricCard
          title="مواعيد الأسبوع القادم"
          value={String(upcomingEventsCount)}
          note="جلسات ومواعيد خلال 7 أيام"
          icon="📅"
          accent="border-l-purple-500"
        />
        <MetricCard
          title="المستندات المُنشأة هذا الشهر"
          value={String(docsGeneratedCount)}
          note="مستندات تم تصديرها"
          icon="📄"
          accent="border-l-teal-500"
        />
        <MetricCard
          title="إجمالي الفواتير غير المسددة"
          value={`${formatMoney(unpaidTotal)} ر.س`}
          note="الفواتير غير المسددة/الجزئية"
          icon="💰"
          accent={unpaidTotal > 0 ? 'border-l-amber-500' : 'border-l-brand-emerald'}
        />
      </div>

      {/* Row 2: Two columns */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Cases by Status */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-brand-navy dark:text-slate-100">القضايا حسب الحالة</h2>
            <span className="text-sm text-slate-500 dark:text-slate-400">
              الإجمالي: {totalMatters}
            </span>
          </div>
          <div className="space-y-3">
            {matterStatuses.map((status) => {
              const count = mattersByStatus.get(status.key) ?? 0;
              const pct = Math.round((count / maxMatters) * 100);
              return (
                <div key={status.key} className="space-y-1">
                  <div className="flex items-center justify-between text-sm text-slate-700 dark:text-slate-200">
                    <div className="flex items-center gap-2">
                      <span className={`inline-block h-2.5 w-2.5 rounded-full ${status.color}`} />
                      <span className="font-medium">{status.label}</span>
                    </div>
                    <span className="font-semibold">{count}</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className={`h-2 rounded-full ${status.color} transition-all duration-500`}
                      style={{ width: `${pct}%` }}
                      aria-hidden="true"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Financial Summary */}
        <Card className="p-5">
          <h2 className="font-semibold text-brand-navy dark:text-slate-100 mb-4">الملخص المالي</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 p-3 border border-emerald-200 dark:border-emerald-900/40">
                <p className="text-xs text-emerald-600 dark:text-emerald-400 mb-1">إجمالي المُحصّل</p>
                <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">{formatMoney(paidTotal)} ر.س</p>
              </div>
              <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 p-3 border border-amber-200 dark:border-amber-900/40">
                <p className="text-xs text-amber-600 dark:text-amber-400 mb-1">إجمالي غير المسدد</p>
                <p className="text-lg font-bold text-amber-700 dark:text-amber-300">{formatMoney(unpaidTotal)} ر.س</p>
              </div>
            </div>

            {/* Collection progress bar */}
            {grandTotal > 0 && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>نسبة التحصيل</span>
                  <span>{collectedPct}%</span>
                </div>
                <div className="h-3 w-full rounded-full bg-amber-100 dark:bg-amber-950/50">
                  <div
                    className="h-3 rounded-full bg-brand-emerald transition-all duration-500"
                    style={{ width: `${collectedPct}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-300 pt-2 border-t border-slate-100 dark:border-slate-800">
              <span>فواتير مصدرة هذا الشهر</span>
              <span className="font-semibold text-brand-navy dark:text-slate-100">{invoicesThisMonthCount}</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Row 3: Two lists */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Overdue Tasks */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-lg">⏰</span>
            <h2 className="font-semibold text-brand-navy dark:text-slate-100">المهام المتأخرة</h2>
            {overdueTasksCount > 0 && (
              <span className="mr-auto rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950/30 dark:text-red-400">
                {overdueTasksCount}
              </span>
            )}
          </div>
          {overdueTasksList.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-6">
              🎉 لا توجد مهام متأخرة حالياً
            </p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {overdueTasksList.map((task) => (
                <div key={task.id} className="py-3 first:pt-0 last:pb-0">
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{task.title}</p>
                  <div className="mt-1 flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                    <span className="text-red-500">📆 {formatDate(task.due_at)}</span>
                    {task.matters && (
                      <span>📁 {(task.matters as any)?.title ?? ''}</span>
                    )}
                  </div>
                </div>
              ))}
              {overdueTasksCount > 5 && (
                <p className="pt-3 text-xs text-slate-500 dark:text-slate-400 text-center">
                  و {overdueTasksCount - 5} مهام أخرى...
                </p>
              )}
            </div>
          )}
        </Card>

        {/* Upcoming Events */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-lg">📅</span>
            <h2 className="font-semibold text-brand-navy dark:text-slate-100">المواعيد القادمة</h2>
            {upcomingEventsCount > 0 && (
              <span className="mr-auto rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-950/30 dark:text-purple-400">
                {upcomingEventsCount}
              </span>
            )}
          </div>
          {upcomingEventsList.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-6">
              لا توجد مواعيد خلال الأسبوع القادم
            </p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {upcomingEventsList.map((event) => (
                <div key={event.id} className="py-3 first:pt-0 last:pb-0">
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{event.title}</p>
                  <div className="mt-1 flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                    <span>🕐 {formatDateTime(event.start_at)}</span>
                    {event.matters && (
                      <span>📁 {(event.matters as any)?.title ?? ''}</span>
                    )}
                  </div>
                </div>
              ))}
              {upcomingEventsCount > 5 && (
                <p className="pt-3 text-xs text-slate-500 dark:text-slate-400 text-center">
                  و {upcomingEventsCount - 5} مواعيد أخرى...
                </p>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function MetricCard({
  title,
  value,
  note,
  icon,
  accent,
}: {
  title: string;
  value: string;
  note: string;
  icon: string;
  accent: string;
}) {
  return (
    <div className={`rounded-lg border border-brand-border bg-white p-4 border-l-4 ${accent} dark:border-slate-700 dark:bg-slate-900 dark:border-l-4`}>
      <div className="flex items-start justify-between">
        <p className="text-sm text-slate-600 dark:text-slate-300">{title}</p>
        <span className="text-xl">{icon}</span>
      </div>
      <p className="mt-2 text-2xl font-bold text-brand-navy dark:text-slate-100">{value}</p>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{note}</p>
    </div>
  );
}

function formatMoney(value: number) {
  const safe = Number.isFinite(value) ? value : 0;
  return safe.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}

function formatDateTime(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('ar-SA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}
