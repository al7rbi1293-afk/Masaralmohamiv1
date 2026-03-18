import Link from 'next/link';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { buttonVariants } from '@/components/ui/button';
import { NajizLawyerVerificationClient } from '@/components/integrations/najiz-lawyer-verification-client';
import { requireIntegrationActor } from '@/lib/integrations/domain/services/integration-access.service';
import { listRecentLawyerVerifications } from '@/lib/integrations/repositories/lawyer-verifications.repository';
import { getOrgPlanLimits } from '@/lib/plan-limits';
import { createSupabaseServerClient } from '@/lib/supabase/server';

type MembershipRow = {
  user_id: string;
  role: 'owner' | 'lawyer';
  created_at: string;
};

type EligibleLawyer = {
  userId: string;
  fullName: string;
  email: string | null;
  role: 'owner' | 'lawyer';
  licenseNumber: string | null;
  isCurrentUser: boolean;
};

export default async function NajizLawyerVerificationPage() {
  try {
    const actor = await requireIntegrationActor({
      allowedRoles: ['admin', 'owner', 'lawyer', 'assistant'],
    });
    const { limits } = await getOrgPlanLimits(actor.orgId);

    if (!limits.najiz_integration) {
      return (
        <Card className="p-10 text-center space-y-6 flex flex-col items-center justify-center min-h-[400px]">
          <div className="max-w-md space-y-2">
            <h1 className="text-2xl font-bold text-brand-navy dark:text-slate-100">نسخة الشركات فقط</h1>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
              التحقق من المحامين عبر Najiz يظهر فقط في نسخة الشركات، ولن يظهر ضمن الباقات العادية 250 و500 و750.
            </p>
          </div>
          <div className="flex gap-3">
            <Link href="/app/settings/subscription" className={buttonVariants('primary', 'lg')}>
              ترقية الآن
            </Link>
            <Link href="/app/external/najiz" className={buttonVariants('outline', 'lg')}>
              العودة لبيانات ناجز
            </Link>
          </div>
        </Card>
      );
    }

    const [eligibleLawyers, recentVerifications] = await Promise.all([
      listEligibleLawyers(actor.orgId, actor.userId),
      listRecentLawyerVerifications(actor.orgId, 20),
    ]);

    return (
      <Card className="space-y-5 p-4 sm:p-6">
        <Breadcrumbs
          items={[
            { label: 'لوحة التحكم', href: '/app' },
            { label: 'بيانات ناجز', href: '/app/external/najiz' },
            { label: 'التحقق من المحامي' },
          ]}
        />

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-brand-navy dark:text-slate-100">التحقق من المحامي</h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              صفحة تشغيلية داخلية للتحقق من الرخصة المهنية عبر Najiz مع حفظ النتيجة في سجل المكتب.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/app/external/najiz" className={buttonVariants('outline', 'sm')}>
              بيانات ناجز
            </Link>
            <Link href="/app/settings/integrations/najiz" className={buttonVariants('outline', 'sm')}>
              إعدادات التكامل
            </Link>
          </div>
        </div>

        <NajizLawyerVerificationClient
          eligibleLawyers={eligibleLawyers}
          initialVerifications={recentVerifications.map((item) => ({
            externalId: String(item.external_id),
            lawyerUserId: item.lawyer_user_id ? String(item.lawyer_user_id) : null,
            lawyerName: item.lawyer_name ? String(item.lawyer_name) : null,
            officeName: item.office_name ? String(item.office_name) : null,
            licenseNumber: item.license_number ? String(item.license_number) : null,
            nationalId: item.national_id ? String(item.national_id) : null,
            status: item.status,
            verifiedAt: item.verified_at ? String(item.verified_at) : null,
            expiresAt: item.expires_at ? String(item.expires_at) : null,
            syncedAt: String(item.synced_at),
            source: item.source ? String(item.source) : 'najiz',
          }))}
        />
      </Card>
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'لا تملك صلاحية الوصول.';
    return (
      <Card className="p-6">
        <EmptyState
          title="التحقق من المحامي"
          message={message}
          backHref="/app/external/najiz"
          backLabel="العودة إلى بيانات ناجز"
        />
      </Card>
    );
  }
}

async function listEligibleLawyers(orgId: string, currentUserId: string): Promise<EligibleLawyer[]> {
  const service = createSupabaseServerClient();
  const { data: memberships, error } = await service
    .from('memberships')
    .select('user_id, role, created_at')
    .eq('org_id', orgId)
    .in('role', ['owner', 'lawyer'])
    .order('created_at', { ascending: true });

  if (error) {
    throw error;
  }

  const memberRows = ((memberships as MembershipRow[] | null) ?? []).filter((row) => row.user_id);
  const memberIds = memberRows.map((row) => String(row.user_id));
  if (!memberIds.length) {
    return [];
  }

  const [profilesResult, appUsersResult] = await Promise.all([
    service.from('profiles').select('user_id, full_name').in('user_id', memberIds),
    service.from('app_users').select('id, email, full_name, license_number').in('id', memberIds),
  ]);

  if (profilesResult.error) {
    throw profilesResult.error;
  }

  if (appUsersResult.error) {
    throw appUsersResult.error;
  }

  const nameById = new Map<string, string>();
  for (const row of (profilesResult.data as Array<{ user_id: string; full_name: string | null }> | null) ?? []) {
    if (row?.user_id && row.full_name) {
      nameById.set(String(row.user_id), String(row.full_name));
    }
  }

  const emailById = new Map<string, string | null>();
  const licenseById = new Map<string, string | null>();
  for (const row of
    ((appUsersResult.data as Array<{
      id: string;
      email: string | null;
      full_name: string | null;
      license_number: string | null;
    }> | null) ?? [])) {
    const id = String(row.id);
    if (row.full_name && !nameById.get(id)?.trim()) {
      nameById.set(id, String(row.full_name));
    }
    emailById.set(id, row.email ? String(row.email) : null);
    licenseById.set(id, row.license_number ? String(row.license_number) : null);
  }

  return memberRows.map((row) => ({
    userId: String(row.user_id),
    fullName: nameById.get(String(row.user_id)) ?? '',
    email: emailById.get(String(row.user_id)) ?? null,
    role: row.role,
    licenseNumber: licenseById.get(String(row.user_id)) ?? null,
    isCurrentUser: String(row.user_id) === currentUserId,
  }));
}
