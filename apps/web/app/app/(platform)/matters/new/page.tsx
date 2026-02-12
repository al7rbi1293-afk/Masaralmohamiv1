import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { createSupabaseServerRlsClient } from '@/lib/supabase/server';
import { getCurrentOrgIdForUser } from '@/lib/org';
import { createMatterAction } from '../actions';

type NewMatterPageProps = {
  searchParams?: {
    error?: string;
  };
};

type ClientOption = {
  id: string;
  name: string;
};

export default async function NewMatterPage({ searchParams }: NewMatterPageProps) {
  const orgId = await getCurrentOrgIdForUser();
  const error = searchParams?.error ? safeDecode(searchParams.error) : null;

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

  const clients = (clientsData as ClientOption[] | null) ?? [];

  return (
    <section className="rounded-lg border border-brand-border bg-white p-6 shadow-panel dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-brand-navy dark:text-slate-100">قضية جديدة</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            أنشئ ملف قضية واربطه بالعميل.
          </p>
        </div>
        <Link href="/app/matters" className={buttonVariants('outline', 'sm')}>
          رجوع
        </Link>
      </div>

      {error ? (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </p>
      ) : null}

      {!orgId ? (
        <p className="mt-6 text-sm text-slate-600 dark:text-slate-300">لا يوجد مكتب مفعّل لهذا الحساب بعد.</p>
      ) : null}

      <form action={createMatterAction} className="mt-6 grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1 text-sm sm:col-span-2">
          <span className="font-medium text-slate-700 dark:text-slate-200">العميل</span>
          <select
            required
            name="client_id"
            className="h-11 w-full rounded-lg border border-brand-border bg-white px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="">اختر العميل</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            لم تجد العميل؟ أضفه من صفحة <Link className="underline" href="/app/clients">العملاء</Link>.
          </p>
        </label>

        <label className="block space-y-1 text-sm sm:col-span-2">
          <span className="font-medium text-slate-700 dark:text-slate-200">العنوان</span>
          <input
            required
            name="title"
            className="h-11 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
          />
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
            <option value="on_hold">معلقة</option>
            <option value="closed">مغلقة</option>
            <option value="archived">مؤرشفة</option>
          </select>
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="is_private"
            className="h-4 w-4 rounded border-brand-border text-brand-emerald focus:ring-brand-emerald"
          />
          <span className="text-slate-700 dark:text-slate-200">قضية خاصة (تظهر للمالك/الأعضاء فقط)</span>
        </label>

        <label className="block space-y-1 text-sm sm:col-span-2">
          <span className="font-medium text-slate-700 dark:text-slate-200">ملخص</span>
          <textarea
            name="summary"
            rows={5}
            className="w-full rounded-lg border border-brand-border px-3 py-2 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
          />
        </label>

        <div className="flex flex-wrap gap-3 sm:col-span-2">
          <button type="submit" className={buttonVariants('primary', 'md')} disabled={!orgId}>
            إنشاء القضية
          </button>
          <Link href="/app/matters" className={buttonVariants('outline', 'md')}>
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

