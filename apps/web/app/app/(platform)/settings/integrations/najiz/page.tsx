import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { buttonVariants } from '@/components/ui/button';
import { requireOwner } from '@/lib/org';
import { createSupabaseServerRlsClient } from '@/lib/supabase/server';
import { NajizIntegrationClient } from '@/components/integrations/najiz-integration-client';
import { getOrgPlanLimits } from '@/lib/plan-limits';

type IntegrationRow = {
  status: 'disconnected' | 'connected' | 'error';
  config: any;
  secret_enc: string | null;
};

type LastSyncRow = {
  status: 'completed' | 'failed';
  imported_count: number;
  endpoint_path: string;
  created_at: string;
};

export default async function NajizIntegrationPage() {
  let orgId = '';

  try {
    const owner = await requireOwner();
    orgId = owner.orgId;

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
            <h1 className="text-2xl font-bold text-brand-navy dark:text-slate-100">باقة الشركات فقط</h1>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
              هذه الميزة (الربط المباشر مع ناجز) متاحة حصرياً لمشتركي باقة الشركات. يرجى ترقية اشتراكك للاستفادة من مزايا المزامنة التلقائية للقضايا والجلسات.
            </p>
          </div>
          <div className="flex gap-3">
            <Link href="/app/settings/subscription" className={buttonVariants('primary', 'lg')}>
              ترقية الآن
            </Link>
            <Link href="/app/settings" className={buttonVariants('outline', 'lg')}>
              العودة للإعدادات
            </Link>
          </div>
        </Card>
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'لا تملك صلاحية الوصول.';
    return (
      <Card className="p-6">
        <EmptyState title="تكامل ناجز" message={message} backHref="/app/settings" backLabel="العودة للإعدادات" />
      </Card>
    );
  }

  const supabase = createSupabaseServerRlsClient();
  const { data, error } = await supabase
    .from('org_integrations')
    .select('status, config, secret_enc')
    .eq('org_id', orgId)
    .eq('provider', 'najiz')
    .maybeSingle();

  const row = (data as IntegrationRow | null) ?? null;

  const status = row?.status ?? 'disconnected';
  const config = (row?.config ?? {}) as any;
  const hasSecrets = Boolean(row?.secret_enc);
  const { data: lastSync } = await supabase
    .from('najiz_sync_runs')
    .select('status, imported_count, endpoint_path, created_at')
    .eq('org_id', orgId)
    .eq('provider', 'najiz')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return (
      <Card className="p-6">
        <h1 className="text-xl font-bold text-brand-navy dark:text-slate-100">تكامل ناجز</h1>
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          تعذر تحميل بيانات التكامل. {error.message}
        </p>
        <div className="mt-4">
          <Link href="/app/settings" className={buttonVariants('outline', 'sm')}>
            العودة إلى الإعدادات
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-brand-navy dark:text-slate-100">التكاملات</h1>
        <Link href="/app/settings" className={buttonVariants('outline', 'sm')}>
          رجوع
        </Link>
      </div>

      <NajizIntegrationClient
        initial={{
          status,
          config,
          hasSecrets,
        }}
        lastSync={(lastSync as LastSyncRow | null) ?? null}
      />
    </Card>
  );
}
