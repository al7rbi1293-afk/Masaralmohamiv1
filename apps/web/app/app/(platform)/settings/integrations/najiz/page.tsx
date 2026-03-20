import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { buttonVariants } from '@/components/ui/button';
import { requireOwner } from '@/lib/org';
import { NajizIntegrationClient } from '@/components/integrations/najiz-integration-client';
import { getOrgPlanLimits } from '@/lib/plan-limits';
import { createEmptyIntegrationAccount } from '@/lib/integrations/domain/services/account-config.service';
import { getIntegrationAccount } from '@/lib/integrations/repositories/integration-accounts.repository';
import { createSupabaseServerRlsClient } from '@/lib/supabase/server';

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
            <h1 className="text-2xl font-bold text-brand-navy dark:text-slate-100">نسخة الشركات فقط</h1>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
              هذه الصفحة مخصصة لنسخة الشركات فقط، ولا تظهر ضمن الباقات العادية 250 و500 و750. قم بالترقية إذا كنت تريد تفعيل تكامل ناجز والمزامنة الحكومية.
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
  const account = (await getIntegrationAccount(orgId, 'najiz').catch(() => null)) ?? createEmptyIntegrationAccount(orgId);
  const activeEnvironment = account.activeEnvironment;
  const activeEnvironmentConfig = account.environments[activeEnvironment];
  const environmentConfigs = {
    sandbox: snapshotEnvironment(account.environments.sandbox),
    production: snapshotEnvironment(account.environments.production),
  };
  const credentialsByEnvironment = {
    sandbox: Boolean(account.credentials.sandbox?.clientId && account.credentials.sandbox.clientSecret),
    production: Boolean(account.credentials.production?.clientId && account.credentials.production.clientSecret),
  } as const;
  const { data: lastSync } = await supabase
    .from('najiz_sync_runs')
    .select('status, imported_count, endpoint_path, created_at')
    .eq('org_id', orgId)
    .eq('provider', 'najiz')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <Card className="p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-brand-navy dark:text-slate-100">التكاملات</h1>
        <div className="flex flex-wrap gap-2">
          <Link href="/app/external/najiz/verify-lawyer" className={buttonVariants('outline', 'sm')}>
            التحقق من المحامي
          </Link>
          <Link href="/app/settings" className={buttonVariants('outline', 'sm')}>
            رجوع
          </Link>
        </div>
      </div>

      <Card className="border border-brand-border/70 bg-brand-background/40 p-4 dark:border-slate-700 dark:bg-slate-900/60">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-brand-navy dark:text-slate-100">نظرة سريعة على جاهزية ناجز</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              تعرض هذه الخلاصة ما إذا كان الربط الحالي live فعلًا أو ما زال sandbox/mock.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
              البيئة: {activeEnvironment === 'production' ? 'Production' : 'Sandbox'}
            </span>
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
              الوضع: {activeEnvironmentConfig.useMock ? 'Mock' : activeEnvironment === 'production' ? 'Live' : 'Sandbox'}
            </span>
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
              الصحة: {account.healthStatus === 'healthy' ? 'Healthy' : account.healthStatus}
            </span>
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
              الإعدادات: {credentialsByEnvironment[activeEnvironment] ? 'مكتملة' : 'غير مكتملة'}
            </span>
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
              الجاهزية: {activeEnvironment === 'production' && account.healthStatus === 'healthy' && credentialsByEnvironment.production && !activeEnvironmentConfig.useMock ? 'جاهز' : 'غير جاهز'}
            </span>
          </div>
        </div>
        {account.activeEnvironment === 'production' && account.healthStatus === 'healthy' && credentialsByEnvironment.production && !activeEnvironmentConfig.useMock ? (
          <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200">
            هذا الحساب جاهز للإنتاج الفعلي.
          </p>
        ) : (
          <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
            هذا الحساب ليس جاهزًا للإنتاج بعد. إذا كانت البيئة sandbox أو mock فهذه نتيجة اختبار فقط، وليست اتصالًا مباشرًا مع ناجز.
          </p>
        )}
      </Card>

      <NajizIntegrationClient
        initial={{
          status: account.status,
          activeEnvironment,
          activeEnvironmentHasCredentials: credentialsByEnvironment[activeEnvironment],
          credentialsByEnvironment,
          environmentConfigs,
          healthStatus: account.healthStatus,
          lastSyncedAt: account.lastSyncedAt,
          lastHealthCheckedAt: account.lastHealthCheckedAt,
          lastHealthError: account.lastHealthError,
        }}
        lastSync={(lastSync as LastSyncRow | null) ?? null}
      />
    </Card>
  );
}

function snapshotEnvironment(environment: {
  baseUrl: string;
  lastError: string | null;
  lastTestedAt: string | null;
  lastConnectedAt: string | null;
  syncPaths: {
    cases: string | null;
  };
  useMock: boolean;
}) {
  return {
    base_url: environment.baseUrl,
    sync_path: environment.syncPaths.cases ?? '',
    last_error: environment.lastError,
    last_tested_at: environment.lastTestedAt,
    last_connected_at: environment.lastConnectedAt,
    use_mock: environment.useMock,
  };
}
