import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { BillingItemsEditor } from '@/components/billing/items-editor';
import { PaymentAddButton } from '@/components/billing/payment-add-button';
import { InvoiceEmailButton } from '@/components/billing/invoice-email-button';
import { FormSubmitButton } from '@/components/ui/form-submit-button';
import { listClients } from '@/lib/clients';
import { listMatters } from '@/lib/matters';
import {
  computeInvoicePaidAmount,
  getInvoiceById,
  listPayments,
  type InvoiceStatus,
} from '@/lib/billing';
import { updateInvoiceAction } from '../../actions';

type InvoiceDetailsPageProps = {
  params: { id: string };
  searchParams?: { success?: string; error?: string };
};

const statusLabel: Record<InvoiceStatus, string> = {
  unpaid: 'غير مسددة',
  partial: 'جزئية',
  paid: 'مدفوعة',
  void: 'ملغاة',
};

const statusVariant: Record<InvoiceStatus, 'default' | 'success' | 'warning' | 'danger'> = {
  unpaid: 'warning',
  partial: 'warning',
  paid: 'success',
  void: 'danger',
};

export default async function InvoiceDetailsPage({ params, searchParams }: InvoiceDetailsPageProps) {
  const invoice = await getInvoiceById(params.id);
  if (!invoice) {
    return (
      <Card className="p-6">
        <h2 className="text-lg font-bold text-brand-navy dark:text-slate-100">الفاتورة</h2>
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          الفاتورة غير موجودة.
        </p>
        <div className="mt-4">
          <Link href="/app/billing/invoices" className={buttonVariants('outline', 'sm')}>
            العودة إلى الفواتير
          </Link>
        </div>
      </Card>
    );
  }

  const success = searchParams?.success ? safeDecode(searchParams.success) : '';
  const error = searchParams?.error ? safeDecode(searchParams.error) : '';

  const [clientsResult, mattersResult, payments, paidAmount] = await Promise.all([
    listClients({ status: 'active', page: 1, limit: 100 }),
    listMatters({ status: 'all', page: 1, limit: 100 }),
    listPayments(invoice.id),
    computeInvoicePaidAmount(invoice.id),
  ]);

  const matters = mattersResult.data.filter((matter) => matter.status !== 'archived');
  const items = Array.isArray(invoice.items) ? invoice.items : [];

  const total = Number(invoice.total);
  const remaining = Math.max(0, (Number.isFinite(total) ? total : 0) - paidAmount);

  return (
    <Card className="p-6 space-y-6">
      <Breadcrumbs
        className="mb-1"
        items={[
          { label: 'لوحة التحكم', href: '/app' },
          { label: 'الفوترة', href: '/app/billing/invoices' },
          { label: 'الفواتير', href: '/app/billing/invoices' },
          { label: invoice.number },
        ]}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-brand-navy dark:text-slate-100">{invoice.number}</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge variant={statusVariant[invoice.status]}>{statusLabel[invoice.status]}</Badge>
            <Badge variant="default">{formatMoney(invoice.total)} SAR</Badge>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={`/app/api/invoices/${encodeURIComponent(invoice.id)}/pdf`}
            className={buttonVariants('outline', 'sm')}
          >
            تصدير PDF
          </a>
          <InvoiceEmailButton invoiceId={invoice.id} />
          <Link href="/app/billing/invoices" className={buttonVariants('outline', 'sm')}>
            رجوع
          </Link>
        </div>
      </div>

      {success ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200">
          {success}
        </p>
      ) : null}

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </p>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-brand-border p-4 dark:border-slate-700">
          <h3 className="font-semibold text-brand-navy dark:text-slate-100">ملخص</h3>
          <dl className="mt-3 space-y-2 text-sm text-slate-700 dark:text-slate-200">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-500 dark:text-slate-400">الإجمالي</dt>
              <dd className="font-semibold">{formatMoney(invoice.total)} SAR</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-500 dark:text-slate-400">المدفوع</dt>
              <dd className="font-semibold">{formatMoney(paidAmount)} SAR</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-500 dark:text-slate-400">المتبقي</dt>
              <dd className="font-semibold">{formatMoney(remaining)} SAR</dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            تم الإصدار: {new Date(invoice.issued_at).toLocaleDateString('ar-SA')}
          </p>
          {invoice.due_at ? (
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              الاستحقاق: {new Date(invoice.due_at).toLocaleDateString('ar-SA')}
            </p>
          ) : null}
        </div>

        <div className="rounded-lg border border-brand-border p-4 dark:border-slate-700 lg:col-span-2">
          <h3 className="font-semibold text-brand-navy dark:text-slate-100">تعديل الفاتورة</h3>
          <form action={updateInvoiceAction.bind(null, invoice.id)} className="mt-4 grid gap-5">
            <div className="grid gap-4 lg:grid-cols-4">
              <label className="block space-y-1 text-sm lg:col-span-2">
                <span className="font-medium text-slate-700 dark:text-slate-200">
                  العميل <span className="text-red-600">*</span>
                </span>
                <select
                  name="client_id"
                  required
                  defaultValue={invoice.client_id}
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
                  defaultValue={invoice.matter_id ?? ''}
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
                <span className="font-medium text-slate-700 dark:text-slate-200">الاستحقاق (اختياري)</span>
                <input
                  type="date"
                  name="due_at"
                  defaultValue={invoice.due_at ? toDateOnly(invoice.due_at) : ''}
                  className="h-11 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
                />
              </label>
            </div>

            <label className="block space-y-1 text-sm">
              <span className="font-medium text-slate-700 dark:text-slate-200">حالة الفاتورة</span>
              <select
                name="status"
                defaultValue={invoice.status === 'void' ? 'void' : 'active'}
                className="h-11 w-full rounded-lg border border-brand-border bg-white px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
              >
                <option value="active">نشطة (الحالة تُحسب من الدفعات)</option>
                <option value="void">ملغاة</option>
              </select>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                عند تسجيل دفعات يتم تحديث الحالة تلقائيًا إلى غير مسددة/جزئية/مدفوعة.
              </p>
            </label>

            <section className="space-y-3">
              <h4 className="font-semibold text-brand-navy dark:text-slate-100">البنود</h4>
              <BillingItemsEditor name="items_json" taxName="tax" defaultItems={items.map((item) => ({ ...item }))} />
            </section>

            <div className="flex flex-wrap gap-3">
              <FormSubmitButton pendingText="جارٍ الحفظ..." variant="primary" size="md">
                حفظ التحديثات
              </FormSubmitButton>
            </div>
          </form>
        </div>
      </section>

      <section className="rounded-lg border border-brand-border p-4 dark:border-slate-700">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-brand-navy dark:text-slate-100">الدفعات</h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              تسجيل دفعات يدوية وتحديث حالة الفاتورة تلقائيًا.
            </p>
          </div>
          <PaymentAddButton invoiceId={invoice.id} disabled={invoice.status === 'void'} />
        </div>

        {!payments.length ? (
          <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">لا توجد دفعات بعد.</p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-lg border border-brand-border dark:border-slate-700">
            <table className="min-w-full text-sm">
              <thead className="border-b border-brand-border text-slate-600 dark:border-slate-700 dark:text-slate-300">
                <tr>
                  <th className="px-3 py-3 text-start font-medium">المبلغ</th>
                  <th className="px-3 py-3 text-start font-medium">الطريقة</th>
                  <th className="px-3 py-3 text-start font-medium">التاريخ</th>
                  <th className="px-3 py-3 text-start font-medium">ملاحظة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border dark:divide-slate-800">
                {payments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-brand-background/60 dark:hover:bg-slate-800/60">
                    <td className="px-3 py-3 font-medium text-brand-navy dark:text-slate-100">
                      {formatMoney(payment.amount)} SAR
                    </td>
                    <td className="px-3 py-3 text-slate-700 dark:text-slate-200">{payment.method ?? '—'}</td>
                    <td className="px-3 py-3 text-slate-700 dark:text-slate-200">
                      {payment.paid_at ? new Date(payment.paid_at).toLocaleDateString('ar-SA') : new Date(payment.created_at).toLocaleDateString('ar-SA')}
                    </td>
                    <td className="px-3 py-3 text-slate-700 dark:text-slate-200">{payment.note ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
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

function formatMoney(value: string | number) {
  const numberValue = typeof value === 'number' ? value : Number(value);
  const safe = Number.isFinite(numberValue) ? numberValue : 0;
  return safe.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function toDateOnly(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
