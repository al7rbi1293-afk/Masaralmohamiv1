import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { BillingItemsEditor } from '@/components/billing/items-editor';
import { FormSubmitButton } from '@/components/ui/form-submit-button';
import { listClients } from '@/lib/clients';
import { listMatters } from '@/lib/matters';
import { getQuoteById, type QuoteStatus } from '@/lib/billing';
import { createSupabaseServerRlsClient } from '@/lib/supabase/server';
import { updateQuoteAction } from '../../actions';

type QuoteDetailsPageProps = {
  params: { id: string };
  searchParams?: { success?: string; error?: string };
};

const statusLabel: Record<QuoteStatus, string> = {
  draft: 'مسودة',
  sent: 'مرسل',
  accepted: 'مقبول',
  rejected: 'مرفوض',
};

const statusVariant: Record<QuoteStatus, 'default' | 'success' | 'warning' | 'danger'> = {
  draft: 'default',
  sent: 'warning',
  accepted: 'success',
  rejected: 'danger',
};

export default async function QuoteDetailsPage({ params, searchParams }: QuoteDetailsPageProps) {
  const quote = await getQuoteById(params.id);
  if (!quote) {
    return (
      <Card className="p-6">
        <h2 className="text-lg font-bold text-brand-navy dark:text-slate-100">عرض السعر</h2>
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          عرض السعر غير موجود.
        </p>
        <div className="mt-4">
          <Link href="/app/billing/quotes" className={buttonVariants('outline', 'sm')}>
            العودة إلى عروض الأسعار
          </Link>
        </div>
      </Card>
    );
  }

  const success = searchParams?.success ? safeDecode(searchParams.success) : '';
  const error = searchParams?.error ? safeDecode(searchParams.error) : '';

  const [clientsResult, mattersResult, orgResult] = await Promise.all([
    listClients({ status: 'active', page: 1, limit: 100 }),
    listMatters({ status: 'all', page: 1, limit: 100 }),
    createSupabaseServerRlsClient()
      .from('organizations')
      .select('name, address, cr_number, tax_number')
      .eq('id', quote.org_id)
      .maybeSingle()
      .then((res) => res),
  ]);

  const org = orgResult.data;

  const matters = mattersResult.data.filter((matter) => matter.status !== 'archived');
  const items = Array.isArray(quote.items) ? quote.items : [];

  return (
    <Card className="p-6 space-y-5">
      <Breadcrumbs
        className="mb-1"
        items={[
          { label: 'لوحة التحكم', href: '/app' },
          { label: 'الفوترة', href: '/app/billing/invoices' },
          { label: 'عروض الأسعار', href: '/app/billing/quotes' },
          { label: quote.number },
        ]}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-brand-navy dark:text-slate-100">{quote.number}</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge variant={statusVariant[quote.status]}>{statusLabel[quote.status]}</Badge>
            <Badge variant="default">{formatMoney(quote.total)} SAR</Badge>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={`/app/api/quotes/${quote.id}/pdf`}
            target="_blank"
            rel="noreferrer"
            className={buttonVariants('outline', 'sm')}
          >
            تحميل PDF
          </a>
          <Link href="/app/billing/quotes" className={buttonVariants('outline', 'sm')}>
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

      <form action={updateQuoteAction.bind(null, quote.id)} className="grid gap-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block space-y-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              العميل <span className="text-red-600">*</span>
            </span>
            <select
              name="client_id"
              required
              defaultValue={quote.client_id}
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
            <span className="font-medium text-slate-700 dark:text-slate-200">القضية (اختياري)</span>
            <select
              name="matter_id"
              defaultValue={quote.matter_id ?? ''}
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
            <span className="font-medium text-slate-700 dark:text-slate-200">الحالة</span>
            <select
              name="status"
              defaultValue={quote.status}
              className="h-11 w-full rounded-lg border border-brand-border bg-white px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
            >
              <option value="draft">مسودة</option>
              <option value="sent">مرسل</option>
              <option value="accepted">مقبول</option>
              <option value="rejected">مرفوض</option>
            </select>
          </label>
        </div>

        <section className="space-y-3">
          <h3 className="font-semibold text-brand-navy dark:text-slate-100">البنود</h3>
          <BillingItemsEditor
            name="items_json"
            taxName="tax"
            taxEnabledName="tax_enabled"
            taxNumberName="tax_number"
            defaultItems={items.map((item) => ({ ...item }))}
            defaultTaxEnabled={quote.tax_enabled}
            defaultTaxNumber={quote.tax_number ?? org?.tax_number ?? ''}
          />
        </section>

        <div className="flex flex-wrap gap-3">
          <FormSubmitButton pendingText="جارٍ الحفظ..." variant="primary" size="md">
            حفظ التحديثات
          </FormSubmitButton>
        </div>

        <div className="grid gap-4 rounded-lg bg-slate-50 p-4 text-sm dark:bg-slate-900/50 sm:grid-cols-2">
          <div>
            <p className="font-semibold text-brand-navy dark:text-slate-100">{org?.name || 'المكتب'}</p>
            <p className="mt-1 text-slate-600 dark:text-slate-300">{org?.address || 'لا يوجد عنوان مسجل'}</p>
            {org?.cr_number && (
              <p className="mt-1 text-slate-500 dark:text-slate-400">سجل تجاري: {org.cr_number}</p>
            )}
            {quote.tax_number && (
              <p className="mt-1 text-slate-500 dark:text-slate-400">رقم ضريبي: {quote.tax_number}</p>
            )}
          </div>
          <div className="text-end">
            <p className="font-semibold text-brand-navy dark:text-slate-100">{quote.client?.name}</p>
            <p className="mt-1 text-slate-500 dark:text-slate-400">
              تاريخ الإنشاء: {new Date(quote.created_at).toLocaleString('ar-SA')}
            </p>
          </div>
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

function formatMoney(value: string | number) {
  const numberValue = typeof value === 'number' ? value : Number(value);
  const safe = Number.isFinite(numberValue) ? numberValue : 0;
  return safe.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
