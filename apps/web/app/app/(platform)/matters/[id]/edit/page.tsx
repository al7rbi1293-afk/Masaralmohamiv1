import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { FormSubmitButton } from '@/components/ui/form-submit-button';
import { listClients } from '@/lib/clients';
import { listOrgMembers } from '@/lib/matter-members';
import { getMatterById } from '@/lib/matters';
import { updateMatterAction } from '../../actions';

type MatterEditPageProps = {
  params: { id: string };
  searchParams?: { error?: string };
};

export default async function MatterEditPage({ params, searchParams }: MatterEditPageProps) {
  const matter = await getMatterById(params.id);

  if (!matter) {
    return (
      <Card className="p-6">
        <h1 className="text-xl font-bold text-brand-navy dark:text-slate-100">تعديل القضية</h1>
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          القضية غير موجودة أو لا تملك صلاحية الوصول.
        </p>
        <div className="mt-4">
          <Link href="/app/matters" className={buttonVariants('outline', 'sm')}>
            العودة إلى القضايا
          </Link>
        </div>
      </Card>
    );
  }

  const error = searchParams?.error ? safeDecode(searchParams.error) : '';

  const [clientsResult, orgMembers] = await Promise.all([
    listClients({
      status: 'all',
      page: 1,
      limit: 50,
    }),
    listOrgMembers(matter.org_id).catch(() => [] as Awaited<ReturnType<typeof listOrgMembers>>),
  ]);

  const selectedClientExists = clientsResult.data.some((client) => client.id === matter.client_id);
  const assignableLawyers = orgMembers.filter((member) => member.role === 'owner' || member.role === 'lawyer');
  const selectedAssigneeExists = assignableLawyers.some((member) => member.user_id === matter.assigned_user_id);

  return (
    <Card className="p-6">
      <Breadcrumbs
        className="mb-4"
        items={[
          { label: 'لوحة التحكم', href: '/app' },
          { label: 'القضايا', href: '/app/matters' },
          { label: matter.title, href: `/app/matters/${matter.id}` },
          { label: 'تعديل القضية' },
        ]}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-brand-navy dark:text-slate-100">تعديل القضية</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            عدّل بيانات القضية في صفحة مستقلة عن صفحة التفاصيل.
          </p>
        </div>
        <Link href={`/app/matters/${matter.id}`} className={buttonVariants('outline', 'sm')}>
          العودة للتفاصيل
        </Link>
      </div>

      {error ? (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </p>
      ) : null}

      <form action={updateMatterAction.bind(null, matter.id)} className="mt-6 grid gap-4">
        <label className="block space-y-1 text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-200">العنوان</span>
          <input
            required
            minLength={2}
            name="title"
            defaultValue={matter.title}
            className="h-11 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">الموكل</span>
            <select
              name="client_id"
              defaultValue={matter.client_id ?? ''}
              className="h-11 w-full rounded-lg border border-brand-border bg-white px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
            >
              <option value="">بدون موكل</option>
              {!selectedClientExists && matter.client_id ? (
                <option value={matter.client_id}>{matter.client?.name ?? 'الموكل الحالي'}</option>
              ) : null}
              {clientsResult.data.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">الحالة</span>
            <select
              name="status"
              defaultValue={matter.status}
              className="h-11 w-full rounded-lg border border-brand-border bg-white px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
            >
              <option value="new">جديدة</option>
              <option value="in_progress">قيد العمل</option>
              <option value="on_hold">معلّقة</option>
              <option value="closed">مغلقة</option>
              <option value="archived">مؤرشفة</option>
            </select>
          </label>

          <label className="block space-y-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">مالك القضية (المحامي المسؤول)</span>
            <select
              name="assigned_user_id"
              defaultValue={matter.assigned_user_id ?? ''}
              className="h-11 w-full rounded-lg border border-brand-border bg-white px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
            >
              <option value="">غير محدد</option>
              {!selectedAssigneeExists && matter.assigned_user_id ? (
                <option value={matter.assigned_user_id}>المسؤول الحالي</option>
              ) : null}
              {assignableLawyers.map((member) => (
                <option key={member.user_id} value={member.user_id}>
                  {(member.full_name || member.email || 'محامٍ')} {member.role === 'owner' ? '(شريك)' : '(محامٍ)'}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">نوع القضية</span>
            <select
              name="case_type"
              defaultValue={matter.case_type ?? ''}
              className="h-11 w-full rounded-lg border border-brand-border bg-white px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
            >
              <option value="">غير محدد</option>
              <option value="commercial">تجارية</option>
              <option value="labor">عمالية</option>
              <option value="personal_status">أحوال شخصية</option>
              <option value="general">عامة</option>
              <option value="criminal">جزائية</option>
              <option value="administrative">إدارية</option>
              <option value="enforcement">تنفيذ</option>
            </select>
          </label>

          <label className="block space-y-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">رقم القضية في ناجز (اختياري)</span>
            <input
              type="text"
              name="najiz_case_number"
              defaultValue={matter.najiz_case_number ?? ''}
              className="h-11 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
              placeholder="مثال: 4410123456"
            />
          </label>
        </div>

        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            name="is_private"
            defaultChecked={matter.is_private}
            className="h-4 w-4 rounded border-brand-border text-brand-emerald focus:ring-brand-emerald"
          />
          <span className="font-medium text-slate-700 dark:text-slate-200">قضية خاصة</span>
        </label>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          عند تفعيل الخصوصية: اختر المحامي المسؤول، ولن تظهر القضية لباقي المحامين غير المصرح لهم.
        </p>

        <label className="block space-y-1 text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-200">ملخص (اختياري)</span>
          <textarea
            name="summary"
            rows={4}
            defaultValue={matter.summary ?? ''}
            className="w-full rounded-lg border border-brand-border px-3 py-2 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
          />
        </label>

        <label className="block space-y-1 text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-200">المطالبات (اختياري)</span>
          <textarea
            name="claims"
            rows={4}
            defaultValue={matter.claims ?? ''}
            placeholder="أدخل تفاصيل المطالبات..."
            className="w-full rounded-lg border border-brand-border px-3 py-2 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
          />
        </label>

        <div className="flex flex-wrap gap-3">
          <FormSubmitButton pendingText="جارٍ الحفظ..." variant="primary" size="md">
            حفظ التعديلات
          </FormSubmitButton>
          <Link href={`/app/matters/${matter.id}`} className={buttonVariants('outline', 'md')}>
            إلغاء
          </Link>
        </div>
      </form>
    </Card>
  );
}

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
