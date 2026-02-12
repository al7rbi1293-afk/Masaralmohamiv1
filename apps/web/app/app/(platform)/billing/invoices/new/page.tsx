import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { LineItemsEditor } from '@/components/app/line-items-editor';
import { createSupabaseServerRlsClient } from '@/lib/supabase/server';
import { getCurrentOrgIdForUser } from '@/lib/org';
import { createInvoiceAction } from '../actions';

type NewInvoicePageProps = {
  searchParams?: { error?: string; matter?: string };
};

type ClientOption = { id: string; name: string };
type MatterOption = { id: string; title: string };

export default async function NewInvoicePage({ searchParams }: NewInvoicePageProps) {
  const orgId = await getCurrentOrgIdForUser();
  const error = searchParams?.error ? safeDecode(searchParams.error) : null;
  const initialMatter = (searchParams?.matter ?? '').trim();

  const supabase = createSupabaseServerRlsClient();
  const { data: clientsData } = orgId
    ? await supabase
        .from('clients')
        .select('id, name')
        .eq('org_id', orgId)
        .eq('status', 'active')
        .order('name', { ascending: true })
        .limit(200)
    : { data: [] as any };

  const { data: mattersData } = orgId
    ? await supabase
        .from('matters')
        .select('id, title')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false })
        .limit(200)
    : { data: [] as any };

  const clients = (clientsData as ClientOption[] | null) ?? [];
  const matters = (mattersData as MatterOption[] | null) ?? [];

  return (
    <section className="rounded-lg border border-brand-border bg-white p-6 shadow-panel dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-brand-navy dark:text-slate-100">فاتورة جديدة</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">إنشاء فاتورة بسيطة.</p>
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

      <form action={createInvoiceAction} className="mt-6 space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">العميل</span>
            <select
              required
              name="client_id"
              className="h-11 w-full rounded-lg border border-brand-border bg-white px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
            >
              <option value="">اختر العميل</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">القضية (اختياري)</span>
            <select
              name="matter_id"
              defaultValue={initialMatter}
              className="h-11 w-full rounded-lg border border-brand-border bg-white px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
            >
              <option value="">بدون ربط</option>
              {matters.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="rounded-lg border border-brand-border p-4 dark:border-slate-700">
          <h2 className="text-sm font-semibold text-brand-navy dark:text-slate-100">البنود</h2>
          <div className="mt-3">
            <LineItemsEditor name="items_json" />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">الضريبة (اختياري)</span>
            <input
              name="tax"
              type="number"
              min={0}
              step={0.01}
              defaultValue={0}
              className="h-11 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
            />
          </label>

          <label className="block space-y-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">تاريخ الاستحقاق (اختياري)</span>
            <input
              name="due_at"
              type="datetime-local"
              className="h-11 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
            />
          </label>
        </div>

        <div className="flex flex-wrap gap-3">
          <button type="submit" className={buttonVariants('primary', 'md')} disabled={!orgId}>
            إنشاء الفاتورة
          </button>
          <Link href="/app/billing/invoices" className={buttonVariants('outline', 'md')}>
            إلغاء
          </Link>
        </div>
      </form>
    </section>
  );
}

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

