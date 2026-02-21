import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { getTrialStatusForCurrentUser } from '@/lib/trial';
import {
  Building2,
  Users,
  BriefcaseBusiness,
  FileText,
  CheckCircle2,
  Calculator,
  ArrowRight
} from 'lucide-react';

const supportEmail = 'masar.almohami@outlook.sa';

function formatDate(value: string | null) {
  if (!value) {
    return '—';
  }
  return new Date(value).toLocaleDateString('ar-SA');
}

function trialLabel(status: 'active' | 'expired' | 'none') {
  if (status === 'active') return { text: 'نشطة', variant: 'success' as const };
  if (status === 'expired') return { text: 'منتهية', variant: 'danger' as const };
  return { text: 'غير مبدوءة', variant: 'warning' as const };
}

export default async function DashboardPage() {
  const trial = await getTrialStatusForCurrentUser();
  const label = trialLabel(trial.status);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-bold tracking-tight text-brand-navy dark:text-slate-100">مرحباً بك في مسار المحامي 👋</h2>
        <p className="text-slate-500 dark:text-slate-400">
          نظرة عامة على نشاط مكتبك وإجراءات سريعة للبدء.
        </p>
      </div>

      {trial.status === 'none' ? (
        <div className="relative overflow-hidden rounded-xl2 border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-6 dark:border-blue-900/50 dark:from-slate-900 dark:to-blue-950/30">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-blue-900 dark:text-blue-100">حسابك جاهز للاستخدام</h3>
              <p className="mt-1 text-sm text-blue-700 dark:text-blue-300">
                يمكنك تفعيل التجربة المجانية للوصول الكامل إلى جميع الميزات، أو التواصل معنا لأي استفسار.
              </p>
            </div>
            <div className="flex shrink-0 gap-3 text-sm">
              <Link href="/#trial" className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 font-medium text-white shadow-sm transition-colors hover:bg-blue-700">
                تفعيل التجربة الآن
              </Link>
              <a href={`mailto:${supportEmail}`} className="inline-flex items-center justify-center rounded-lg border border-blue-300 bg-transparent px-4 py-2 font-medium text-blue-700 transition-colors hover:bg-blue-100 dark:border-blue-700 dark:text-blue-300 dark:hover:bg-blue-900/50">
                راسلنا
              </a>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Trial Status Card */}
        <Card className="flex flex-col justify-between p-6 transition-all hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold text-brand-navy dark:text-slate-100">حالة الاشتراك</h3>
              <Badge variant={label.variant}>{label.text}</Badge>
            </div>

            <dl className="space-y-3 text-sm">
              <div className="flex justify-between border-b border-dashed border-slate-200 pb-2 dark:border-slate-800">
                <dt className="text-slate-500 dark:text-slate-400">تاريخ الانتهاء</dt>
                <dd className="font-medium text-slate-900 dark:text-slate-200">{formatDate(trial.endsAt)}</dd>
              </div>
              <div className="flex justify-between pt-1">
                <dt className="text-slate-500 dark:text-slate-400">الأيام المتبقية</dt>
                <dd className="font-bold text-brand-emerald">{trial.daysLeft ?? '—'}</dd>
              </div>
            </dl>
          </div>
        </Card>

        {/* Next Steps / Onboarding Card */}
        <Card className="p-6 transition-all hover:shadow-md dark:border-slate-800 dark:bg-slate-900 lg:col-span-2">
          <h3 className="mb-4 font-semibold text-brand-navy dark:text-slate-100">اكتشف المنصة واكمل الإعدادات</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Link
              href="/app/settings"
              className="group flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4 transition-all hover:border-brand-emerald hover:bg-brand-emerald/5 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-emerald-500/50 dark:hover:bg-emerald-500/5"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-md bg-white p-2 shadow-sm dark:bg-slate-900">
                  <Building2 className="h-5 w-5 text-indigo-500" />
                </div>
                <span className="font-medium text-brand-navy dark:text-slate-200">إعداد هوية المكتب</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">تخصيص الشعار ومعلومات التواصل والفواتير.</p>
              <div className="mt-2 text-xs font-semibold text-brand-emerald opacity-0 transition-opacity group-hover:opacity-100 flex items-center gap-1">
                بدء الإعداد <ArrowRight className="h-3 w-3" />
              </div>
            </Link>

            <Link
              href="/app/settings/team"
              className="group flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4 transition-all hover:border-brand-emerald hover:bg-brand-emerald/5 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-emerald-500/50 dark:hover:bg-emerald-500/5"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-md bg-white p-2 shadow-sm dark:bg-slate-900">
                  <Users className="h-5 w-5 text-amber-500" />
                </div>
                <span className="font-medium text-brand-navy dark:text-slate-200">إضافة فريق العمل</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">دعوة المحامين والإداريين وتحديد الصلاحيات.</p>
              <div className="mt-2 text-xs font-semibold text-brand-emerald opacity-0 transition-opacity group-hover:opacity-100 flex items-center gap-1">
                إرسال دعوة <ArrowRight className="h-3 w-3" />
              </div>
            </Link>
          </div>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="rounded-xl2 border border-brand-border bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h3 className="mb-4 font-semibold text-brand-navy dark:text-slate-100">إجراءات سريعة</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Link href="/app/clients/new" className="flex flex-col items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 p-4 text-center transition-all hover:-translate-y-1 hover:border-brand-emerald hover:shadow-glow dark:border-slate-800 dark:bg-slate-950 dark:hover:border-emerald-500/50">
            <Users className="h-6 w-6 text-slate-400 dark:text-slate-500" />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">عميل جديد</span>
          </Link>

          <Link href="/app/matters/new" className="flex flex-col items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 p-4 text-center transition-all hover:-translate-y-1 hover:border-brand-emerald hover:shadow-glow dark:border-slate-800 dark:bg-slate-950 dark:hover:border-emerald-500/50">
            <BriefcaseBusiness className="h-6 w-6 text-slate-400 dark:text-slate-500" />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">قضية جديدة</span>
          </Link>

          <Link href="/app/documents/new" className="flex flex-col items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 p-4 text-center transition-all hover:-translate-y-1 hover:border-brand-emerald hover:shadow-glow dark:border-slate-800 dark:bg-slate-950 dark:hover:border-emerald-500/50">
            <FileText className="h-6 w-6 text-slate-400 dark:text-slate-500" />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">مستند جديد</span>
          </Link>

          <Link href="/app/tasks?new=1" className="flex flex-col items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 p-4 text-center transition-all hover:-translate-y-1 hover:border-brand-emerald hover:shadow-glow dark:border-slate-800 dark:bg-slate-950 dark:hover:border-emerald-500/50">
            <CheckCircle2 className="h-6 w-6 text-slate-400 dark:text-slate-500" />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">مهمة جديدة</span>
          </Link>

          <Link href="/app/billing/invoices/new" className="flex flex-col items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 p-4 text-center transition-all hover:-translate-y-1 hover:border-brand-emerald hover:shadow-glow dark:border-slate-800 dark:bg-slate-950 dark:hover:border-emerald-500/50">
            <Calculator className="h-6 w-6 text-slate-400 dark:text-slate-500" />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">فاتورة جديدة</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
