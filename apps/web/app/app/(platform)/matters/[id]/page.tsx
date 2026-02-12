import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { listClients } from '@/lib/clients';
import { getMatterById, type MatterStatus } from '@/lib/matters';
import { archiveMatterAction, restoreMatterAction, updateMatterAction } from '../actions';

type MatterDetailsPageProps = {
  params: { id: string };
  searchParams?: { success?: string; error?: string };
};

const statusLabel: Record<MatterStatus, string> = {
  new: 'جديدة',
  in_progress: 'قيد العمل',
  on_hold: 'معلّقة',
  closed: 'مغلقة',
  archived: 'مؤرشفة',
};

const statusVariant: Record<MatterStatus, 'default' | 'success' | 'warning' | 'danger'> = {
  new: 'default',
  in_progress: 'success',
  on_hold: 'warning',
  closed: 'default',
  archived: 'danger',
};

export default async function MatterDetailsPage({ params, searchParams }: MatterDetailsPageProps) {
  const matter = await getMatterById(params.id);
  if (!matter) {
    return (
      <Card className="p-6">
        <h1 className="text-xl font-bold text-brand-navy dark:text-slate-100">القضية</h1>
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

  const success = searchParams?.success ? safeDecode(searchParams.success) : '';
  const error = searchParams?.error ? safeDecode(searchParams.error) : '';

  const clientsResult = await listClients({
    status: 'all',
    page: 1,
    limit: 50,
  });

  const selectedClientExists = clientsResult.data.some((client) => client.id === matter.client_id);

  return (
    <Card className="space-y-5 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-brand-navy dark:text-slate-100">{matter.title}</h1>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge variant={statusVariant[matter.status]}>{statusLabel[matter.status]}</Badge>
            {matter.is_private ? <Badge variant="warning">خاصة</Badge> : <Badge variant="default">عامة</Badge>}
          </div>
        </div>
        <Link href="/app/matters" className={buttonVariants('outline', 'sm')}>
          رجوع
        </Link>
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

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-lg border border-brand-border p-4 dark:border-slate-700">
          <h2 className="font-semibold text-brand-navy dark:text-slate-100">معلومات الموكل</h2>
          <p className="mt-3 text-sm text-slate-700 dark:text-slate-200">
            <span className="font-medium">الاسم:</span> {matter.client?.name ?? '—'}
          </p>
          <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">
            <span className="font-medium">الجوال:</span> {matter.client?.phone ?? '—'}
          </p>
          <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">
            <span className="font-medium">البريد:</span> {matter.client?.email ?? '—'}
          </p>
        </section>

        <section className="rounded-lg border border-brand-border p-4 dark:border-slate-700 lg:col-span-2">
          <h2 className="font-semibold text-brand-navy dark:text-slate-100">ملخص القضية</h2>
          <p className="mt-3 text-sm leading-7 text-slate-700 dark:text-slate-200">
            {matter.summary ?? 'لا يوجد ملخص حتى الآن.'}
          </p>
        </section>

        <section className="rounded-lg border border-brand-border p-4 dark:border-slate-700 lg:col-span-3">
          <h2 className="font-semibold text-brand-navy dark:text-slate-100">البيانات</h2>
          <div className="mt-3 grid gap-3 text-sm text-slate-700 dark:text-slate-200 sm:grid-cols-2">
            <p>
              <span className="font-medium">تاريخ الإنشاء:</span>{' '}
              {new Date(matter.created_at).toLocaleString('ar-SA')}
            </p>
            <p>
              <span className="font-medium">آخر تحديث:</span>{' '}
              {new Date(matter.updated_at).toLocaleString('ar-SA')}
            </p>
          </div>
        </section>
      </div>

      <section className="rounded-lg border border-brand-border p-4 dark:border-slate-700">
        <h2 className="font-semibold text-brand-navy dark:text-slate-100">تعديل القضية</h2>
        <form action={updateMatterAction.bind(null, matter.id)} className="mt-4 grid gap-4">
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
                required
                name="client_id"
                defaultValue={matter.client_id}
                className="h-11 w-full rounded-lg border border-brand-border bg-white px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
              >
                {!selectedClientExists ? (
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
            القضية الخاصة تظهر فقط للشريك والأعضاء المصرّح لهم.
          </p>

          <label className="block space-y-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">ملخص (اختياري)</span>
            <textarea
              name="summary"
              rows={6}
              defaultValue={matter.summary ?? ''}
              className="w-full rounded-lg border border-brand-border px-3 py-2 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
            />
          </label>

          <div>
            <button type="submit" className={buttonVariants('primary', 'md')}>
              تعديل القضية
            </button>
          </div>
        </form>
      </section>

      <div className="flex flex-wrap gap-3">
        {matter.status === 'archived' ? (
          <form action={restoreMatterAction.bind(null, matter.id, `/app/matters/${matter.id}`)}>
            <button type="submit" className={buttonVariants('outline', 'md')}>
              استعادة
            </button>
          </form>
        ) : (
          <form action={archiveMatterAction.bind(null, matter.id, `/app/matters/${matter.id}`)}>
            <button type="submit" className={buttonVariants('outline', 'md')}>
              أرشفة
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
