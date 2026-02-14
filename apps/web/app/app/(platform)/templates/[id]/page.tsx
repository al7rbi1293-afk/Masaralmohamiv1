import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { ConfirmActionForm } from '@/components/ui/confirm-action-form';
import { TemplateVersionActions } from '@/components/templates/template-version-actions';
import { TemplateVariablesEditor } from '@/components/templates/template-variables-editor';
import { TemplateGenerateModal } from '@/components/templates/template-generate-modal';
import { getTemplateById, listTemplateVersions, type TemplateStatus, type TemplateType } from '@/lib/templates';
import { getCurrentAuthUser } from '@/lib/supabase/auth-session';
import { listClients } from '@/lib/clients';
import { listMatters } from '@/lib/matters';
import { archiveTemplateAction, restoreTemplateAction } from '../actions';

type TemplateDetailsPageProps = {
  params: { id: string };
  searchParams?: { success?: string; error?: string };
};

const typeLabel: Record<TemplateType, string> = {
  docx: 'DOCX',
  pdf: 'PDF',
};

const statusLabel: Record<TemplateStatus, string> = {
  active: 'نشط',
  archived: 'مؤرشف',
};

export default async function TemplateDetailsPage({ params, searchParams }: TemplateDetailsPageProps) {
  const [template, versions, currentUser, mattersResult, clientsResult] = await Promise.all([
    getTemplateById(params.id),
    listTemplateVersions(params.id).catch(() => []),
    getCurrentAuthUser(),
    listMatters({ status: 'all', page: 1, limit: 50 }).catch(() => ({ data: [], page: 1, limit: 50, total: 0 })),
    listClients({ status: 'active', page: 1, limit: 50 }).catch(() => ({ data: [], page: 1, limit: 50, total: 0 })),
  ]);

  if (!template) {
    return (
      <Card className="p-6">
        <h1 className="text-xl font-bold text-brand-navy dark:text-slate-100">القالب</h1>
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          القالب غير موجود أو لا تملك صلاحية الوصول.
        </p>
        <div className="mt-4">
          <Link href="/app/templates" className={buttonVariants('outline', 'sm')}>
            العودة إلى القوالب
          </Link>
        </div>
      </Card>
    );
  }

  const success = searchParams?.success ? safeDecode(searchParams.success) : '';
  const error = searchParams?.error ? safeDecode(searchParams.error) : '';

  const latest = versions[0] ?? null;

  return (
    <Card className="space-y-5 p-6">
      <Breadcrumbs
        className="mb-1"
        items={[
          { label: 'لوحة التحكم', href: '/app' },
          { label: 'القوالب', href: '/app/templates' },
          { label: template.name },
        ]}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-brand-navy dark:text-slate-100">{template.name}</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            {template.category} · {typeLabel[template.template_type]}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant={template.status === 'active' ? 'success' : 'warning'}>{statusLabel[template.status]}</Badge>
            <Badge variant="default">عدد النسخ: {versions.length}</Badge>
          </div>
        </div>
        <Link href="/app/templates" className={buttonVariants('outline', 'sm')}>
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

      <section className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-lg border border-brand-border p-4 dark:border-slate-700">
          <h2 className="font-semibold text-brand-navy dark:text-slate-100">إجراءات</h2>
          <div className="mt-4">
            <TemplateGenerateModal
              templateId={template.id}
              templateName={template.name}
              variables={latest?.variables ?? []}
              matters={mattersResult.data.map((matter) => ({
                id: matter.id,
                label: `${matter.title}${matter.client?.name ? ` — ${matter.client.name}` : ''}`,
                client_id: matter.client_id,
                client_label: matter.client?.name ?? '',
              }))}
              clients={clientsResult.data.map((client) => ({
                id: client.id,
                label: client.name,
              }))}
            />
          </div>

          <div className="mt-4">
            <TemplateVersionActions
              templateId={template.id}
              latestVersion={latest}
              defaultVariables={latest?.variables ?? []}
            />
          </div>

          <div className="mt-4">
            {template.status === 'active' ? (
              <ConfirmActionForm
                action={archiveTemplateAction.bind(null, template.id, `/app/templates/${template.id}`)}
                triggerLabel="أرشفة القالب"
                triggerVariant="outline"
                triggerSize="md"
                confirmTitle="أرشفة القالب"
                confirmMessage="هل تريد أرشفة هذا القالب؟ يمكنك استعادته لاحقًا."
                confirmLabel="أرشفة"
                destructive
              />
            ) : (
              <ConfirmActionForm
                action={restoreTemplateAction.bind(null, template.id, `/app/templates/${template.id}`)}
                triggerLabel="استعادة القالب"
                triggerVariant="outline"
                triggerSize="md"
                confirmTitle="استعادة القالب"
                confirmMessage="هل تريد استعادة هذا القالب إلى الحالة النشطة؟"
                confirmLabel="استعادة"
                destructive={false}
              />
            )}
          </div>
        </div>

        <div className="rounded-lg border border-brand-border p-4 dark:border-slate-700">
          <h2 className="font-semibold text-brand-navy dark:text-slate-100">متغيرات القالب</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            عرّف المتغيرات التي ستُعبأ لاحقًا عند إنشاء المستندات من هذا القالب.
          </p>
          <div className="mt-4">
            <TemplateVariablesEditor templateId={template.id} latestVersion={latest} />
          </div>
        </div>
      </section>

      <div className="rounded-lg border border-brand-border p-4 dark:border-slate-700">
        <h2 className="font-semibold text-brand-navy dark:text-slate-100">النسخ</h2>
        {!versions.length ? (
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">لا توجد نسخ بعد.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-brand-border text-slate-600 dark:border-slate-700 dark:text-slate-300">
                <tr>
                  <th className="py-2 text-start font-medium">الإصدار</th>
                  <th className="py-2 text-start font-medium">الملف</th>
                  <th className="py-2 text-start font-medium">الحجم</th>
                  <th className="py-2 text-start font-medium">تاريخ الرفع</th>
                  <th className="py-2 text-start font-medium">الرافع</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border dark:divide-slate-800">
                {versions.map((v) => (
                  <tr key={v.id}>
                    <td className="py-2 text-slate-700 dark:text-slate-200">v{v.version_no}</td>
                    <td className="py-2 text-slate-700 dark:text-slate-200">{v.file_name}</td>
                    <td className="py-2 text-slate-700 dark:text-slate-200">{formatBytes(v.file_size)}</td>
                    <td className="py-2 text-slate-700 dark:text-slate-200">
                      {new Date(v.created_at).toLocaleString('ar-SA')}
                    </td>
                    <td className="py-2 text-slate-700 dark:text-slate-200">
                      {currentUser?.id && v.uploaded_by === currentUser.id ? 'أنت' : v.uploaded_by}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = value;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}
