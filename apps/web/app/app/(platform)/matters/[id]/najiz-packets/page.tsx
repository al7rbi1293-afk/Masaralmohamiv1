import Link from 'next/link';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { buttonVariants } from '@/components/ui/button';
import { NajizPacketsClient } from '@/components/najiz/najiz-packets-client';
import { getMatterById } from '@/lib/matters';
import { getOrgPlanLimits } from '@/lib/plan-limits';

type NajizPacketsPageProps = {
  params: { id: string };
};

export default async function NajizPacketsPage({ params }: NajizPacketsPageProps) {
  const matter = await getMatterById(params.id);
  if (!matter) {
    return (
      <Card className="p-6">
        <EmptyState
          title="حزم ناجز"
          message="القضية غير موجودة أو لا تملك صلاحية الوصول."
          backHref="/app/matters"
          backLabel="العودة إلى القضايا"
        />
      </Card>
    );
  }

  const { limits } = await getOrgPlanLimits(matter.org_id).catch(() => ({ limits: { najiz_integration: false } }));
  if (!limits.najiz_integration) {
    return (
      <Card className="p-10 text-center space-y-6 flex flex-col items-center justify-center min-h-[400px]">
        <div className="max-w-md space-y-2">
          <h1 className="text-2xl font-bold text-brand-navy dark:text-slate-100">نسخة الشركات فقط</h1>
          <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
            حزم ناجز متاحة فقط في نسخة الشركات، لأنها جزء من مسار التكاملات الحكومية.
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/app/settings/subscription" className={buttonVariants('primary', 'lg')}>
            ترقية الآن
          </Link>
          <Link href={`/app/matters/${matter.id}`} className={buttonVariants('outline', 'lg')}>
            العودة إلى القضية
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <Card className="space-y-5 p-4 sm:p-6">
      <Breadcrumbs
        items={[
          { label: 'لوحة التحكم', href: '/app' },
          { label: 'القضايا', href: '/app/matters' },
          { label: matter.title, href: `/app/matters/${matter.id}` },
          { label: 'حزم ناجز' },
        ]}
      />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-brand-navy dark:text-slate-100">حزم ناجز</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            إدارة الحزم المرتبطة بالقضية: إنشاء، مراجعة، وتحديث حالة الحزمة.
          </p>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            القضية: {matter.title}
            {matter.najiz_case_number ? ` • رقم ناجز: ${matter.najiz_case_number}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/app/matters/${matter.id}`} className={buttonVariants('outline', 'sm')}>
            العودة للقضية
          </Link>
        </div>
      </div>

      <NajizPacketsClient
        matterId={matter.id}
        matterTitle={matter.title}
        caseNumber={matter.najiz_case_number}
      />
    </Card>
  );
}
