import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { CopyButton } from '@/components/ui/copy-button';
import { Container } from '@/components/ui/container';
import { requireOwner } from '@/lib/org';
import { createSupabaseServerRlsClient } from '@/lib/supabase/server';
import { HealthCheck } from '@/components/diagnostics/health-check';
import { getAppVersion } from '@/lib/version';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type SubscriptionRow = {
  plan_code: string;
  status: string;
  seats: number;
  current_period_end: string | null;
};

type AuditRow = {
  id: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  created_at: string;
  meta: Record<string, unknown>;
};

export default async function DiagnosticsPage() {
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
          <p className="text-sm text-slate-700 dark:text-slate-200">الرجاء تسجيل الدخول.</p>
        </Card>
      );
    }

    return (
      <Card className="p-6 space-y-4">
        <h1 className="text-xl font-bold text-brand-navy dark:text-slate-100">التشخيص</h1>
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          لا تملك صلاحية الوصول.
        </p>
        <Link href="/app/settings" className={buttonVariants('outline', 'sm')}>
          رجوع
        </Link>
      </Card>
    );
  }

  const supabase = createSupabaseServerRlsClient();

  const version = getAppVersion();

  const [orgRes, subscriptionRes, auditRes, counts] = await Promise.all([
    supabase.from('organizations').select('id, name, created_at').eq('id', orgId).maybeSingle(),
    supabase
      .from('subscriptions')
      .select('plan_code, status, seats, current_period_end')
      .eq('org_id', orgId)
      .maybeSingle(),
    supabase
      .from('audit_logs')
      .select('id, action, entity_type, entity_id, created_at, meta')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(10),
    Promise.all([
      countRows({ supabase, table: 'clients', orgId }),
      countRows({ supabase, table: 'matters', orgId }),
      countRows({ supabase, table: 'documents', orgId }),
      countRows({ supabase, table: 'tasks', orgId }),
      countRows({ supabase, table: 'invoices', orgId }),
    ]),
  ]);

  const orgName = (orgRes.data as any)?.name ? String((orgRes.data as any).name) : '—';
  const subscription = (subscriptionRes.data as SubscriptionRow | null) ?? null;
  const auditEvents = ((auditRes.data as AuditRow[] | null) ?? []).map((row) => ({
    ...row,
    meta: (row.meta ?? {}) as Record<string, unknown>,
  }));

  return (
    <Card className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-brand-navy dark:text-slate-100">التشخيص</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            صفحة مساعدة للدعم (للمالك فقط).
          </p>
        </div>
        <Link href="/app/settings" className={buttonVariants('outline', 'sm')}>
          رجوع
        </Link>
      </div>

      <section className="rounded-lg border border-brand-border p-4 dark:border-slate-700">
        <h2 className="text-base font-semibold text-brand-navy dark:text-slate-100">معلومات المكتب</h2>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <div className="sm:col-span-2">
            <dt className="text-slate-500 dark:text-slate-400">معرّف المكتب</dt>
            <dd className="mt-1 flex flex-wrap items-center gap-2">
              <code className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-800 dark:bg-slate-800/60 dark:text-slate-100">
                {orgId}
              </code>
              <CopyButton value={orgId} label="نسخ" copiedLabel="تم النسخ" />
            </dd>
          </div>
          <div>
            <dt className="text-slate-500 dark:text-slate-400">اسم المكتب</dt>
            <dd className="mt-1 font-medium text-slate-800 dark:text-slate-100">{orgName}</dd>
          </div>
          <div>
            <dt className="text-slate-500 dark:text-slate-400">معرّف المستخدم</dt>
            <dd className="mt-1 flex flex-wrap items-center gap-2">
              <code className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-800 dark:bg-slate-800/60 dark:text-slate-100">
                {userId}
              </code>
              <CopyButton value={userId} label="نسخ" copiedLabel="تم النسخ" />
            </dd>
          </div>
        </dl>
      </section>

      <section className="rounded-lg border border-brand-border p-4 dark:border-slate-700">
        <h2 className="text-base font-semibold text-brand-navy dark:text-slate-100">النسخة والاشتراك</h2>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500 dark:text-slate-400">نسخة التطبيق</dt>
            <dd className="mt-1 flex flex-wrap items-center gap-2">
              <code className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-800 dark:bg-slate-800/60 dark:text-slate-100">
                {version}
              </code>
              <CopyButton value={version} label="نسخ" copiedLabel="تم النسخ" />
            </dd>
          </div>
          <div>
            <dt className="text-slate-500 dark:text-slate-400">الخطة</dt>
            <dd className="mt-1 font-medium text-slate-800 dark:text-slate-100">
              {subscription?.plan_code ?? '—'}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500 dark:text-slate-400">الحالة</dt>
            <dd className="mt-1 font-medium text-slate-800 dark:text-slate-100">
              {subscription ? statusLabel(subscription.status) : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500 dark:text-slate-400">المقاعد</dt>
            <dd className="mt-1 font-medium text-slate-800 dark:text-slate-100">
              {subscription?.seats ?? '—'}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-slate-500 dark:text-slate-400">نهاية الفترة</dt>
            <dd className="mt-1 font-medium text-slate-800 dark:text-slate-100">
              {formatDate(subscription?.current_period_end ?? null)}
            </dd>
          </div>
        </dl>
      </section>

      <section className="rounded-lg border border-brand-border p-4 dark:border-slate-700">
        <HealthCheck />
      </section>

      <section className="rounded-lg border border-brand-border p-4 dark:border-slate-700">
        <h2 className="text-base font-semibold text-brand-navy dark:text-slate-100">إحصاءات سريعة</h2>
        <div className="mt-4 grid gap-3 text-sm sm:grid-cols-5">
          <StatCard label="العملاء" value={counts[0]} />
          <StatCard label="القضايا" value={counts[1]} />
          <StatCard label="المستندات" value={counts[2]} />
          <StatCard label="المهام" value={counts[3]} />
          <StatCard label="الفواتير" value={counts[4]} />
        </div>
      </section>

      <section className="rounded-lg border border-brand-border p-4 dark:border-slate-700">
        <h2 className="text-base font-semibold text-brand-navy dark:text-slate-100">آخر 10 أحداث تدقيق</h2>
        {!auditEvents.length ? (
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">لا توجد سجلات.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[620px] text-sm">
              <thead>
                <tr className="text-right text-xs text-slate-500 dark:text-slate-400">
                  <th className="px-2 py-2">الوقت</th>
                  <th className="px-2 py-2">الإجراء</th>
                  <th className="px-2 py-2">الكيان</th>
                  <th className="px-2 py-2">تفاصيل</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border dark:divide-slate-700">
                {auditEvents.map((row) => (
                  <tr key={row.id} className="align-top">
                    <td className="px-2 py-2 whitespace-nowrap text-slate-700 dark:text-slate-200">
                      {formatDateTime(row.created_at)}
                    </td>
                    <td className="px-2 py-2 font-medium text-slate-800 dark:text-slate-100">
                      {row.action}
                    </td>
                    <td className="px-2 py-2 text-slate-700 dark:text-slate-200">
                      {row.entity_type ?? '—'}
                    </td>
                    <td className="px-2 py-2 text-xs text-slate-600 dark:text-slate-300">
                      <CodeBlock value={summarizeMeta(row.meta)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-brand-border p-4 dark:border-slate-700">
        <h2 className="text-base font-semibold text-brand-navy dark:text-slate-100">مشاركة التشخيص مع الدعم</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          عند التواصل مع الدعم، أرسل معرّف المكتب + نسخة التطبيق + وقت المشكلة. البريد:
          <span className="mx-1 font-medium">masar.almohami@outlook.sa</span>
        </p>
      </section>

      <Container className="text-xs text-slate-500 dark:text-slate-400">
        هذه الصفحة لا تعرض محتوى المستندات أو بيانات حساسة، وتهدف للمساعدة في تشخيص المشاكل.
      </Container>
    </Card>
  );
}

function statusLabel(value: string) {
  switch (value) {
    case 'trial':
      return 'تجربة';
    case 'active':
      return 'نشط';
    case 'past_due':
      return 'متأخر';
    case 'canceled':
      return 'ملغي';
    case 'expired':
      return 'منتهي';
    default:
      return value;
  }
}

function formatDate(value: string | null) {
  if (!value) return 'غير محدد';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'غير محدد';
  return date.toLocaleDateString('ar-SA');
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.toLocaleDateString('ar-SA')} ${date.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}`;
}

async function countRows(params: {
  supabase: ReturnType<typeof createSupabaseServerRlsClient>;
  table: string;
  orgId: string;
}) {
  const { supabase, table, orgId } = params;
  const { count, error } = await supabase
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId);

  if (error) {
    return 0;
  }

  return count ?? 0;
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-brand-border p-3 dark:border-slate-700">
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">{value}</p>
    </div>
  );
}

function summarizeMeta(meta: Record<string, unknown>) {
  const safe: Record<string, unknown> = {};

  // Keep small and avoid dumping PII.
  const keys = ['changed', 'number', 'role', 'expires_in', 'expires_at', 'version_no', 'file_size', 'amount', 'length'] as const;
  for (const key of keys) {
    if (meta[key] !== undefined) safe[key] = meta[key];
  }

  try {
    return JSON.stringify(safe);
  } catch {
    return '{}';
  }
}

function CodeBlock({ value }: { value: string }) {
  return (
    <code className="block max-w-[520px] whitespace-pre-wrap break-words rounded bg-slate-100 px-2 py-1 text-[11px] text-slate-800 dark:bg-slate-800/60 dark:text-slate-100">
      {value}
    </code>
  );
}
