import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { EmptyState } from '@/components/ui/empty-state';
import { BillingItemsEditor } from '@/components/billing/items-editor';
import { FormSubmitButton } from '@/components/ui/form-submit-button';
import { listClients } from '@/lib/clients';
import { listMatters } from '@/lib/matters';
import { createInvoiceAction } from '../../actions';

type InvoiceNewPageProps = {
  searchParams?: { error?: string };
};

export default async function InvoiceNewPage({ searchParams }: InvoiceNewPageProps) {
  const error = searchParams?.error ? safeDecode(searchParams.error) : '';

  const [clientsResult, mattersResult] = await Promise.all([
    listClients({ status: 'active', page: 1, limit: 100 }),
    listMatters({ status: 'all', page: 1, limit: 100 }),
  ]);

  if (!clientsResult.data.length) {
    return (
      <Card className="p-6">
        <EmptyState
          title="فاتورة جديدة"
          message="لا يوجد عملاء نشطون. أضف عميلاً أولاً."
          backHref="/app/clients/new"
          backLabel="إضافة عميل"
        />
      </Card>
    );
  }

  const matters = mattersResult.data.filter((matter) => matter.status !== 'archived');

  return (
    <Card className="p-6">
      <Breadcrumbs
        className="mb-4"
        items={[
          { label: 'لوحة التحكم', href: '/app' },
          { label: 'الفوترة', href: '/app/billing/invoices' },
          { label: 'فاتورة جديدة' },
        ]}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-brand-navy dark:text-slate-100">فاتورة جديدة</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            أنشئ فاتورة مع بنود وضريبة اختيارية واستحقاق.
          </p>
        </div>
        <Link href="/app/billing/invoices" className={buttonVariants('outline', 'sm')}>
          رجوع
        </Link>
      </div>

      {error ? (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </p>
      ) : null}

      <form action={createInvoiceAction} className="mt-6 grid gap-5">
        <div className="grid gap-4 lg:grid-cols-4">
          <label className="block space-y-1 text-sm lg:col-span-2">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              العميل <span className="text-red-600">*</span>
            </span>
            <select
              name="client_id"
              required
              className="h-11 w-full rounded-lg border border-brand-border bg-white px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
            >
              {clientsResult.data.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1 text-sm lg:col-span-2">
            <span className="font-medium text-slate-700 dark:text-slate-200">القضية (اختياري)</span>
            <select
              name="matter_id"
              defaultValue=""
              className="h-11 w-full rounded-lg border border-brand-border bg-white px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
            >
              <option value="">بدون ربط</option>
              {matters.map((matter) => (
                <option key={matter.id} value={matter.id}>
                  {matter.title}
                </option>
              ))}
            </select>
          </label>



          <label className="block space-y-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">تاريخ الاستحقاق (اختياري)</span>
            <input
              type="date"
              name="due_at"
              className="h-11 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
            />
          </label>
        </div>

        <section className="space-y-3">
          <h3 className="font-semibold text-brand-navy dark:text-slate-100">بنود الفاتورة</h3>
          <BillingItemsEditor name="items_json" taxName="tax" />
        </section>

        <div className="flex flex-wrap gap-3">
          <FormSubmitButton pendingText="جارٍ الحفظ..." variant="primary" size="md">
            حفظ
          </FormSubmitButton>
          <Link href="/app/billing/invoices" className={buttonVariants('outline', 'md')}>
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
