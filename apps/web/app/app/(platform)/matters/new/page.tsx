import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { EmptyState } from '@/components/ui/empty-state';
import { FormSubmitButton } from '@/components/ui/form-submit-button';
import { listClients } from '@/lib/clients';
import { createMatterAction } from '../actions';

type MatterNewPageProps = {
  searchParams?: { error?: string; title?: string };
};

export default async function MatterNewPage({ searchParams }: MatterNewPageProps) {
  const error = searchParams?.error ? safeDecode(searchParams.error) : '';
  const initialTitle = searchParams?.title ? safeDecode(searchParams.title).slice(0, 200) : '';
  const clientsResult = await listClients({
    status: 'active',
    page: 1,
    limit: 50,
  });

  if (!clientsResult.data.length) {
    return (
      <Card className="p-6">
        <EmptyState
          title="إنشاء قضية"
          message="لا يوجد موكلون نشطون. أضف موكلاً أولاً قبل إنشاء قضية."
          backHref="/app/clients/new"
          backLabel="إضافة موكل"
        />
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <Breadcrumbs
        className="mb-4"
        items={[
          { label: 'لوحة التحكم', href: '/app' },
          { label: 'القضايا', href: '/app/matters' },
          { label: 'قضية جديدة' },
        ]}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-brand-navy dark:text-slate-100">قضية جديدة</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            أدخل المعلومات الأساسية لبدء متابعة القضية.
          </p>
        </div>
        <Link href="/app/matters" className={buttonVariants('outline', 'sm')}>
          إلغاء
        </Link>
      </div>

      {error ? (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </p>
      ) : null}

      <form action={createMatterAction} className="mt-6 grid gap-4">
        <label className="block space-y-1 text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-200">
            العنوان <span className="text-red-600">*</span>
          </span>
          <input
            required
            minLength={2}
            name="title"
            defaultValue={initialTitle}
            className="h-11 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              الموكل <span className="text-red-600">*</span>
            </span>
            <select
              required
              name="client_id"
              className="h-11 w-full rounded-lg border border-brand-border bg-white px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
            >
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
              defaultValue="new"
              className="h-11 w-full rounded-lg border border-brand-border bg-white px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
            >
              <option value="new">جديدة</option>
              <option value="in_progress">قيد العمل</option>
              <option value="on_hold">معلّقة</option>
              <option value="closed">مغلقة</option>
              <option value="archived">مؤرشفة</option>
            </select>
          </label>
        </div>

        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            name="is_private"
            className="h-4 w-4 rounded border-brand-border text-brand-emerald focus:ring-brand-emerald"
          />
          <span className="font-medium text-slate-700 dark:text-slate-200">قضية خاصة</span>
        </label>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          القضية الخاصة تظهر فقط للشريك والأعضاء المصرّح لهم.
        </p>

        <label className="block space-y-1 text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-200">ملخص (اختياري)</span>
          <textarea
            name="summary"
            rows={6}
            className="w-full rounded-lg border border-brand-border px-3 py-2 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
          />
        </label>

        <div className="flex flex-wrap gap-3">
          <FormSubmitButton pendingText="جارٍ الحفظ..." variant="primary" size="md">
            حفظ
          </FormSubmitButton>
          <Link href="/app/matters" className={buttonVariants('outline', 'md')}>
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
