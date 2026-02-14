import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { buttonVariants } from '@/components/ui/button';
import { requireOwner } from '@/lib/org';
import { createSupabaseServerRlsClient } from '@/lib/supabase/server';
import { NajizIntegrationClient } from '@/components/integrations/najiz-integration-client';

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
