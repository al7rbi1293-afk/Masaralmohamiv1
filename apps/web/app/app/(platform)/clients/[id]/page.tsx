import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { ConfirmActionForm } from '@/components/ui/confirm-action-form';
import { FormSubmitButton } from '@/components/ui/form-submit-button';
import { getClientById } from '@/lib/clients';
import { archiveClientAction, deleteClientAction, restoreClientAction, updateClientAction } from '../actions';

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
      <Breadcrumbs
        className="mb-4"
        items={[
          { label: 'لوحة التحكم', href: '/app' },
          { label: 'العملاء', href: '/app/clients' },
          { label: client.name },
        ]}
      />

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

      <form action={updateClientAction.bind(null, client.id)} encType="multipart/form-data" className="mt-6 grid gap-4 sm:grid-cols-2">
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
          <span className="font-medium text-slate-700 dark:text-slate-200">
            الاسم <span className="text-red-600">*</span>
          </span>
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
          <span className="font-medium text-slate-700 dark:text-slate-200">
            البريد الإلكتروني <span className="text-red-600">*</span>
          </span>
          <input
            required
            name="email"
            type="email"
            autoComplete="email"
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

        <label className="block space-y-1 text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-200">رقم الوكالة (اختياري)</span>
          <input
            name="agency_number"
            defaultValue={client.agency_number ?? ''}
            className="h-11 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
          />
        </label>

        <label className="block space-y-1 text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-200">
            {client.agency_storage_path ? 'استبدال مرفق الوكالة (اختياري)' : 'مرفق الوكالة (اختياري)'}
          </span>
          <input
            name="agency_file"
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx"
            className="block w-full rounded-lg border border-brand-border bg-white px-3 py-2 text-sm text-slate-700 file:me-3 file:rounded-md file:border-0 file:bg-brand-background file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-navy hover:file:bg-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:file:bg-slate-800 dark:file:text-slate-100"
          />
          <span className="text-xs text-slate-500 dark:text-slate-400">
            يمكنك رفع نسخة PDF أو صورة أو ملف Word حتى 20 ميجابايت.
          </span>
        </label>

        {client.agency_storage_path ? (
          <div className="rounded-lg border border-brand-border/70 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-900/40 sm:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <p className="font-medium text-slate-700 dark:text-slate-200">المرفق الحالي</p>
                <p className="text-slate-600 dark:text-slate-300">{client.agency_file_name ?? 'مرفق الوكالة'}</p>
              </div>
              <a
                href={`/app/api/clients/${client.id}/agency-download`}
                target="_blank"
                rel="noreferrer"
                className={buttonVariants('outline', 'sm')}
              >
                تنزيل المرفق
              </a>
            </div>

            <label className="mt-3 flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
              <input
                type="checkbox"
                name="remove_agency_attachment"
                className="h-4 w-4 rounded border-brand-border text-brand-emerald focus:ring-brand-emerald dark:border-slate-700"
              />
              حذف المرفق الحالي عند الحفظ
            </label>
          </div>
        ) : null}

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
          <FormSubmitButton pendingText="جارٍ الحفظ..." variant="primary" size="md">
            حفظ التحديثات
          </FormSubmitButton>
        </div>
      </form>

      <div className="mt-4 flex flex-wrap gap-3">
        {client.status === 'active' ? (
          <ConfirmActionForm
            action={archiveClientAction.bind(null, client.id, `/app/clients/${client.id}`)}
            triggerLabel="أرشفة"
            triggerVariant="outline"
            triggerSize="md"
            confirmTitle="أرشفة العميل"
            confirmMessage="هل تريد أرشفة هذا العميل؟ يمكنك استعادته لاحقًا."
            confirmLabel="أرشفة"
            destructive
          />
        ) : (
          <ConfirmActionForm
            action={restoreClientAction.bind(null, client.id, `/app/clients/${client.id}`)}
            triggerLabel="استعادة"
            triggerVariant="outline"
            triggerSize="md"
            confirmTitle="استعادة العميل"
            confirmMessage="هل تريد استعادة هذا العميل إلى الحالة النشطة؟"
            confirmLabel="استعادة"
            destructive={false}
          />
        )}
        <ConfirmActionForm
          action={deleteClientAction.bind(null, client.id, '/app/clients')}
          triggerLabel="حذف نهائي"
          triggerVariant="outline"
          triggerSize="md"
          confirmTitle="حذف العميل نهائيًا"
          confirmMessage="سيتم حذف العميل وكل القضايا والفواتير والمهام والمستندات المرتبطة به نهائيًا. لا يمكن التراجع عن هذا الإجراء."
          confirmLabel="حذف نهائي"
          destructive
        />
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
