import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { getClientById } from '@/lib/clients';
import { archiveClientAction, restoreClientAction, updateClientAction } from '../actions';

type ClientDetailsPageProps = {
  params: { id: string };
  searchParams?: { success?: string; error?: string };
};

export default async function ClientDetailsPage({ params, searchParams }: ClientDetailsPageProps) {
  const client = await getClientById(params.id);
  if (!client) {
    return (
      <Card className="p-6">
        <h1 className="text-xl font-bold text-brand-navy dark:text-slate-100">العميل</h1>
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          العميل غير موجود.
        </p>
        <div className="mt-4">
          <Link href="/app/clients" className={buttonVariants('outline', 'sm')}>
            العودة إلى العملاء
          </Link>
        </div>
      </Card>
    );
  }

  const success = searchParams?.success ? safeDecode(searchParams.success) : '';
  const error = searchParams?.error ? safeDecode(searchParams.error) : '';

  return (
    <Card className="p-6">
      <nav aria-label="breadcrumbs" className="text-sm text-slate-500 dark:text-slate-400">
        <Link href="/app/clients" className="hover:underline">
          العملاء
        </Link>
        <span className="mx-2">›</span>
        <span className="text-slate-700 dark:text-slate-200">{client.name}</span>
      </nav>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-brand-navy dark:text-slate-100">{client.name}</h1>
          <div className="mt-2">
            <Badge variant={client.status === 'active' ? 'success' : 'warning'}>
              {client.status === 'active' ? 'نشط' : 'مؤرشف'}
            </Badge>
          </div>
        </div>
        <Link href="/app/clients" className={buttonVariants('outline', 'sm')}>
          رجوع
        </Link>
      </div>

      {success ? (
        <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200">
          {success}
        </p>
      ) : null}

      {error ? (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </p>
      ) : null}

      <form action={updateClientAction.bind(null, client.id)} className="mt-6 grid gap-4 sm:grid-cols-2">
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
          <span className="font-medium text-slate-700 dark:text-slate-200">الاسم</span>
          <input
            required
            name="name"
            minLength={2}
            defaultValue={client.name}
            className="h-11 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
          />
        </label>

        <label className="block space-y-1 text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-200">رقم الهوية (اختياري)</span>
          <input
            name="identity_no"
            defaultValue={client.identity_no ?? ''}
            className="h-11 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
          />
        </label>

        <label className="block space-y-1 text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-200">رقم السجل التجاري (اختياري)</span>
          <input
            name="commercial_no"
            defaultValue={client.commercial_no ?? ''}
            className="h-11 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
          />
        </label>

        <label className="block space-y-1 text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-200">البريد (اختياري)</span>
          <input
            name="email"
            type="email"
            defaultValue={client.email ?? ''}
            className="h-11 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
          />
        </label>

        <label className="block space-y-1 text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-200">الجوال (اختياري)</span>
          <input
            name="phone"
            defaultValue={client.phone ?? ''}
            className="h-11 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
          />
        </label>

        <label className="block space-y-1 text-sm sm:col-span-2">
          <span className="font-medium text-slate-700 dark:text-slate-200">ملاحظات (اختياري)</span>
          <textarea
            name="notes"
            rows={5}
            defaultValue={client.notes ?? ''}
            className="w-full rounded-lg border border-brand-border px-3 py-2 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
          />
        </label>

        <div className="flex flex-wrap gap-3 sm:col-span-2">
          <button type="submit" className={buttonVariants('primary', 'md')}>
            حفظ التحديثات
          </button>
        </div>
      </form>

      <div className="mt-4">
        {client.status === 'active' ? (
          <form action={archiveClientAction.bind(null, client.id, `/app/clients/${client.id}`)}>
            <button type="submit" className={buttonVariants('outline', 'md')}>
              أرشفة
            </button>
          </form>
        ) : (
          <form action={restoreClientAction.bind(null, client.id, `/app/clients/${client.id}`)}>
            <button type="submit" className={buttonVariants('outline', 'md')}>
              استعادة
            </button>
          </form>
        )}
      </div>
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
