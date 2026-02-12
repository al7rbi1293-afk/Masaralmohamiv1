import Link from 'next/link';
import { notFound } from 'next/navigation';
import { buttonVariants } from '@/components/ui/button';
import { createSupabaseServerRlsClient } from '@/lib/supabase/server';
import { getCurrentOrgIdForUser } from '@/lib/org';
import {
  archiveClientAction,
  unarchiveClientAction,
  updateClientAction,
} from '../actions';

type ClientDetailsPageProps = {
  params: {
    id: string;
  };
  searchParams?: {
    error?: string;
    success?: string;
  };
};

type ClientRow = {
  id: string;
  type: 'person' | 'company';
  name: string;
  status: 'active' | 'archived';
  identity_no: string | null;
  commercial_no: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export default async function ClientDetailsPage({ params, searchParams }: ClientDetailsPageProps) {
  const orgId = await getCurrentOrgIdForUser();
  if (!orgId) {
    notFound();
  }

  const supabase = createSupabaseServerRlsClient();
  const { data, error } = await supabase
    .from('clients')
    .select(
      'id, type, name, status, identity_no, commercial_no, email, phone, notes, created_at, updated_at',
    )
    .eq('org_id', orgId)
    .eq('id', params.id)
    .maybeSingle();

  if (error || !data) {
    notFound();
  }

  const client = data as ClientRow;
  const bannerError = searchParams?.error ? safeDecode(searchParams.error) : null;
  const success = searchParams?.success ? true : false;

  return (
    <section className="rounded-lg border border-brand-border bg-white p-6 shadow-panel dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-brand-navy dark:text-slate-100">{client.name}</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            {client.type === 'company' ? 'شركة' : 'فرد'} •{' '}
            {client.status === 'archived' ? 'مؤرشف' : 'نشط'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/app/clients" className={buttonVariants('outline', 'sm')}>
            رجوع
          </Link>
          {client.status === 'archived' ? (
            <form action={async () => unarchiveClientAction(client.id)}>
              <button type="submit" className={buttonVariants('outline', 'sm')}>
                استعادة
              </button>
            </form>
          ) : (
            <form action={async () => archiveClientAction(client.id)}>
              <button type="submit" className={buttonVariants('outline', 'sm')}>
                أرشفة
              </button>
            </form>
          )}
        </div>
      </div>

      {bannerError ? (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          {bannerError}
        </p>
      ) : null}

      {success ? (
        <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200">
          تم حفظ التغييرات.
        </p>
      ) : null}

      <form action={async (formData) => updateClientAction(client.id, formData)} className="mt-6 grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1 text-sm sm:col-span-2">
          <span className="font-medium text-slate-700 dark:text-slate-200">الاسم</span>
          <input
            required
            name="name"
            defaultValue={client.name}
            className="h-11 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
          />
        </label>

        <label className="block space-y-1 text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-200">النوع</span>
          <select
            name="type"
            defaultValue={client.type}
            className="h-11 w-full rounded-lg border border-brand-border bg-white px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="person">فرد</option>
            <option value="company">شركة</option>
          </select>
        </label>

        <label className="block space-y-1 text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-200">الحالة</span>
          <select
            name="status"
            defaultValue={client.status}
            className="h-11 w-full rounded-lg border border-brand-border bg-white px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="active">نشط</option>
            <option value="archived">مؤرشف</option>
          </select>
        </label>

        <label className="block space-y-1 text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-200">البريد الإلكتروني</span>
          <input
            name="email"
            type="email"
            defaultValue={client.email ?? ''}
            className="h-11 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
          />
        </label>

        <label className="block space-y-1 text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-200">رقم الجوال</span>
          <input
            name="phone"
            dir="ltr"
            defaultValue={client.phone ?? ''}
            className="h-11 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
          />
        </label>

        <label className="block space-y-1 text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-200">رقم الهوية</span>
          <input
            name="identity_no"
            dir="ltr"
            defaultValue={client.identity_no ?? ''}
            className="h-11 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
          />
        </label>

        <label className="block space-y-1 text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-200">السجل التجاري</span>
          <input
            name="commercial_no"
            dir="ltr"
            defaultValue={client.commercial_no ?? ''}
            className="h-11 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
          />
        </label>

        <label className="block space-y-1 text-sm sm:col-span-2">
          <span className="font-medium text-slate-700 dark:text-slate-200">ملاحظات</span>
          <textarea
            name="notes"
            rows={5}
            defaultValue={client.notes ?? ''}
            className="w-full rounded-lg border border-brand-border px-3 py-2 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
          />
        </label>

        <div className="flex flex-wrap gap-3 sm:col-span-2">
          <button type="submit" className={buttonVariants('primary', 'md')}>
            حفظ
          </button>
          <Link href="/app/clients" className={buttonVariants('outline', 'md')}>
            رجوع للقائمة
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

