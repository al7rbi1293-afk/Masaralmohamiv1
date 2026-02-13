import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { DeleteOrgDataRequestClient } from '@/components/settings/delete-org-data-request-client';
import { getCurrentAuthUser } from '@/lib/supabase/auth-session';
import { requireOwner } from '@/lib/org';

const SUPPORT_EMAIL = 'masar.almohami@outlook.sa';

export default async function PrivacySettingsPage() {
  const user = await getCurrentAuthUser();
  if (!user) {
    return (
      <Card className="p-6">
        <p className="text-sm text-slate-700 dark:text-slate-200">الرجاء تسجيل الدخول.</p>
      </Card>
    );
  }

  try {
    await requireOwner();
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'لا تملك صلاحية تنفيذ هذا الإجراء.') {
      return (
        <Card className="p-6">
          <h1 className="text-xl font-bold text-brand-navy dark:text-slate-100">الخصوصية وحذف البيانات</h1>
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
            لا تملك صلاحية الوصول.
          </p>
          <div className="mt-4">
            <Link href="/app/settings" className={buttonVariants('outline', 'sm')}>
              رجوع
            </Link>
          </div>
        </Card>
      );
    }

    return (
      <Card className="p-6">
        <h1 className="text-xl font-bold text-brand-navy dark:text-slate-100">الخصوصية وحذف البيانات</h1>
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          {message || 'تعذر تحميل الصفحة.'}
        </p>
        <div className="mt-4">
          <Link href="/app/settings" className={buttonVariants('outline', 'sm')}>
            رجوع
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-brand-navy dark:text-slate-100">الخصوصية وحذف البيانات</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            هذه الصفحة مخصصة لمالك المكتب لإدارة طلبات الخصوصية.
          </p>
        </div>
        <Link href="/app/settings" className={buttonVariants('outline', 'sm')}>
          رجوع
        </Link>
      </div>

      <section className="rounded-lg border border-brand-border p-4 text-sm text-slate-700 dark:border-slate-700 dark:text-slate-200">
        <h2 className="text-base font-semibold text-brand-navy dark:text-slate-100">طلب حذف بيانات المكتب</h2>
        <p className="mt-2 leading-7 text-slate-600 dark:text-slate-300">
          حذف البيانات يتم <span className="font-medium">يدويًا</span> بعد التحقق من صلاحية المالك والهوية. قد نطلب
          منك معلومات إضافية قبل تنفيذ الحذف. بعد اعتماد الطلب، قد يستغرق التنفيذ وقتًا حسب حجم البيانات.
        </p>
        <p className="mt-2 leading-7 text-slate-600 dark:text-slate-300">
          للاستفسارات: <a className="text-brand-emerald hover:underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
        </p>
      </section>

      <DeleteOrgDataRequestClient />
    </Card>
  );
}

