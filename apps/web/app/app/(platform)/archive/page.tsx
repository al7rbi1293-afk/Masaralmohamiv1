import type { ReactNode } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConfirmActionForm } from '@/components/ui/confirm-action-form';
import { EmptyState } from '@/components/ui/empty-state';
import { deleteInvoiceAction, restoreInvoiceAction } from '../billing/actions';
import { deleteClientAction, restoreClientAction } from '../clients/actions';
import { deleteDocumentAction, restoreDocumentAction } from '../documents/actions';
import { deleteMatterAction, restoreMatterAction } from '../matters/actions';
import { deleteTaskAction, restoreTaskAction } from '../tasks/actions';
import { deleteTemplateAction, restoreTemplateAction } from '../templates/actions';
import { listInvoices, type Invoice, type InvoiceStatus } from '@/lib/billing';
import { listClients, type Client, type ClientType } from '@/lib/clients';
import { listDocuments, type DocumentWithLatest } from '@/lib/documents';
import { listMatters, type Matter } from '@/lib/matters';
import { listTasks, type Task, type TaskPriority, type TaskStatus } from '@/lib/tasks';
import { listTemplates, type Template } from '@/lib/templates';

type ArchivePageProps = {
  searchParams?: {
    type?: string;
    q?: string;
    page?: string;
    success?: string;
    error?: string;
  };
};

const archiveTypes = ['all', 'clients', 'matters', 'documents', 'tasks', 'invoices', 'templates'] as const;
type ArchiveType = (typeof archiveTypes)[number];

const archiveTypeLabels: Record<Exclude<ArchiveType, 'all'>, string> = {
  clients: 'العملاء',
  matters: 'القضايا',
  documents: 'المستندات',
  tasks: 'المهام',
  invoices: 'الفواتير',
  templates: 'القوالب',
};

const clientTypeLabel: Record<ClientType, string> = {
  person: 'فرد',
  company: 'شركة',
};

const taskStatusLabel: Record<TaskStatus, string> = {
  todo: 'للإنجاز',
  doing: 'قيد التنفيذ',
  done: 'تم',
  canceled: 'ملغي',
};

const taskStatusVariant: Record<TaskStatus, 'default' | 'success' | 'warning' | 'danger'> = {
  todo: 'default',
  doing: 'warning',
  done: 'success',
  canceled: 'danger',
};

const taskPriorityLabel: Record<TaskPriority, string> = {
  low: 'منخفضة',
  medium: 'متوسطة',
  high: 'عالية',
};

const invoiceStatusLabel: Record<InvoiceStatus, string> = {
  unpaid: 'غير مسددة',
  partial: 'جزئية',
  paid: 'مدفوعة',
  void: 'ملغاة',
};

const invoiceStatusVariant: Record<InvoiceStatus, 'default' | 'success' | 'warning' | 'danger'> = {
  unpaid: 'warning',
  partial: 'warning',
  paid: 'success',
  void: 'danger',
};

const overviewLimit = 5;
const pageLimit = 10;

export default async function ArchivePage({ searchParams }: ArchivePageProps) {
  const q = (searchParams?.q ?? '').trim();
  const typeRaw = (searchParams?.type ?? 'all').trim();
  const type: ArchiveType = archiveTypes.includes(typeRaw as ArchiveType) ? (typeRaw as ArchiveType) : 'all';
  const page = Math.max(1, Number(searchParams?.page ?? '1') || 1);
  const success = searchParams?.success ? safeDecode(searchParams.success) : '';
  const error = searchParams?.error ? safeDecode(searchParams.error) : '';
  const redirectTo = buildArchivePath({ type, q, page });

  try {
    if (type === 'all') {
      const overview = await loadArchiveOverview(q);

      return (
        <Card className="p-4 sm:p-6">
          <ArchiveHeader title="الأرشيف" q={q} type={type} success={success} error={error} />

          {hasAnyArchivedData(overview) ? (
            <>
              <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {(
                  Object.entries(archiveTypeLabels) as Array<[Exclude<ArchiveType, 'all'>, string]>
                ).map(([key, label]) => {
                  const total = overview[key].total;
                  return (
                    <Link
                      key={key}
                      href={buildArchivePath({ type: key, q })}
                      className="rounded-xl border border-brand-border bg-brand-background/40 p-4 transition hover:border-brand-emerald/40 hover:bg-brand-background/70 dark:border-slate-700 dark:bg-slate-900/40 dark:hover:border-emerald-500/40 dark:hover:bg-slate-900"
                    >
                      <p className="text-sm font-medium text-slate-600 dark:text-slate-300">{label}</p>
                      <p className="mt-2 text-2xl font-bold text-brand-navy dark:text-slate-100">{total}</p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">العناصر المؤرشفة</p>
                    </Link>
                  );
                })}
              </div>

              <div className="mt-8 space-y-8">
                <ArchiveSection
                  title="العملاء المؤرشفون"
                  count={overview.clients.total}
                  viewAllHref={buildArchivePath({ type: 'clients', q })}
                  showViewAll={overview.clients.total > overview.clients.data.length}
                >
                  {renderClientCards(overview.clients.data, redirectTo)}
                </ArchiveSection>

                <ArchiveSection
                  title="القضايا المؤرشفة"
                  count={overview.matters.total}
                  viewAllHref={buildArchivePath({ type: 'matters', q })}
                  showViewAll={overview.matters.total > overview.matters.data.length}
                >
                  {renderMatterCards(overview.matters.data, redirectTo)}
                </ArchiveSection>

                <ArchiveSection
                  title="المستندات المؤرشفة"
                  count={overview.documents.total}
                  viewAllHref={buildArchivePath({ type: 'documents', q })}
                  showViewAll={overview.documents.total > overview.documents.data.length}
                >
                  {renderDocumentCards(overview.documents.data, redirectTo)}
                </ArchiveSection>

                <ArchiveSection
                  title="المهام المؤرشفة"
                  count={overview.tasks.total}
                  viewAllHref={buildArchivePath({ type: 'tasks', q })}
                  showViewAll={overview.tasks.total > overview.tasks.data.length}
                >
                  {renderTaskCards(overview.tasks.data, redirectTo)}
                </ArchiveSection>

                <ArchiveSection
                  title="الفواتير المؤرشفة"
                  count={overview.invoices.total}
                  viewAllHref={buildArchivePath({ type: 'invoices', q })}
                  showViewAll={overview.invoices.total > overview.invoices.data.length}
                >
                  {renderInvoiceCards(overview.invoices.data, redirectTo)}
                </ArchiveSection>

                <ArchiveSection
                  title="القوالب المؤرشفة"
                  count={overview.templates.total}
                  viewAllHref={buildArchivePath({ type: 'templates', q })}
                  showViewAll={overview.templates.total > overview.templates.data.length}
                >
                  {renderTemplateCards(overview.templates.data, redirectTo)}
                </ArchiveSection>
              </div>
            </>
          ) : (
            <div className="mt-8">
              <EmptyState
                title="الأرشيف"
                message={q ? 'لا توجد عناصر مؤرشفة مطابقة لعبارة البحث.' : 'لا توجد عناصر مؤرشفة حالياً.'}
                backHref="/app"
                backLabel="العودة للوحة التحكم"
              />
            </div>
          )}
        </Card>
      );
    }

    const data = await loadArchiveType(type, q, page);

    return (
      <Card className="p-4 sm:p-6">
        <ArchiveHeader title="الأرشيف" q={q} type={type} success={success} error={error} />

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-brand-navy dark:text-slate-100">
              {archiveTypeLabels[type]}
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              {data.total} عنصر مؤرشف
            </p>
          </div>
          <Link href={buildArchivePath({ q })} className={buttonVariants('outline', 'sm')}>
            عرض كل الأنواع
          </Link>
        </div>

        {data.total > 0 ? (
          <>
            <div className="mt-5 space-y-3">{renderArchiveCardsByType(type, data.items, redirectTo)}</div>
            <ArchivePagination type={type} q={q} page={page} limit={data.limit} total={data.total} />
          </>
        ) : (
          <div className="mt-8">
            <EmptyState
              title={archiveTypeLabels[type]}
              message={q ? 'لا توجد عناصر مؤرشفة مطابقة لعبارة البحث.' : `لا توجد ${archiveTypeLabels[type]} مؤرشفة حالياً.`}
              backHref={buildArchivePath({ q })}
              backLabel="العودة لكل الأنواع"
            />
          </div>
        )}
      </Card>
    );
  } catch (fetchError) {
    const message =
      fetchError instanceof Error && fetchError.message ? fetchError.message : 'تعذر تحميل الأرشيف.';

    return (
      <Card className="p-6">
        <h1 className="text-xl font-bold text-brand-navy dark:text-slate-100">الأرشيف</h1>
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          {message}
        </p>
        <div className="mt-4">
          <Link href="/app" className={buttonVariants('outline', 'sm')}>
            العودة للوحة التحكم
          </Link>
        </div>
      </Card>
    );
  }
}

async function loadArchiveOverview(q: string) {
  const [clients, matters, documents, tasks, invoices, templates] = await Promise.all([
    listClients({ q, status: 'archived', page: 1, limit: overviewLimit }),
    listMatters({ q, status: 'archived', page: 1, limit: overviewLimit }),
    listDocuments({ q, archived: 'archived', page: 1, limit: overviewLimit }),
    listTasks({ q, archived: 'archived', page: 1, limit: overviewLimit }),
    listInvoices({ q, archived: 'archived', status: 'all', page: 1, limit: overviewLimit }),
    listTemplates({ q, status: 'archived', page: 1, limit: overviewLimit }),
  ]);

  return { clients, matters, documents, tasks, invoices, templates };
}

async function loadArchiveType(type: Exclude<ArchiveType, 'all'>, q: string, page: number) {
  switch (type) {
    case 'clients': {
      const result = await listClients({ q, status: 'archived', page, limit: pageLimit });
      return { items: result.data, total: result.total, limit: result.limit };
    }
    case 'matters': {
      const result = await listMatters({ q, status: 'archived', page, limit: pageLimit });
      return { items: result.data, total: result.total, limit: result.limit };
    }
    case 'documents': {
      const result = await listDocuments({ q, archived: 'archived', page, limit: pageLimit });
      return { items: result.data, total: result.total, limit: result.limit };
    }
    case 'tasks': {
      const result = await listTasks({ q, archived: 'archived', page, limit: pageLimit });
      return { items: result.data, total: result.total, limit: result.limit };
    }
    case 'invoices': {
      const result = await listInvoices({ q, archived: 'archived', status: 'all', page, limit: pageLimit });
      return { items: result.data, total: result.total, limit: result.limit };
    }
    case 'templates': {
      const result = await listTemplates({ q, status: 'archived', page, limit: pageLimit });
      return { items: result.data, total: result.total, limit: result.limit };
    }
  }
}

function renderArchiveCardsByType(
  type: Exclude<ArchiveType, 'all'>,
  items: Client[] | Matter[] | DocumentWithLatest[] | Task[] | Invoice[] | Template[],
  redirectTo: string,
) {
  switch (type) {
    case 'clients':
      return renderClientCards(items as Client[], redirectTo);
    case 'matters':
      return renderMatterCards(items as Matter[], redirectTo);
    case 'documents':
      return renderDocumentCards(items as DocumentWithLatest[], redirectTo);
    case 'tasks':
      return renderTaskCards(items as Task[], redirectTo);
    case 'invoices':
      return renderInvoiceCards(items as Invoice[], redirectTo);
    case 'templates':
      return renderTemplateCards(items as Template[], redirectTo);
  }
}

function renderClientCards(items: Client[], redirectTo: string) {
  return items.map((client) => (
    <ArchiveCard
      key={client.id}
      title={client.name}
      badges={
        <>
          <Badge variant="default">عميل</Badge>
          <Badge variant="warning">مؤرشف</Badge>
        </>
      }
      fields={[
        { label: 'النوع', value: clientTypeLabel[client.type] },
        { label: 'الجوال', value: client.phone ?? '—' },
        { label: 'البريد', value: client.email ?? '—', fullWidth: true },
        { label: 'آخر تحديث', value: formatDate(client.updated_at) },
      ]}
      viewHref={`/app/clients/${client.id}`}
      restoreAction={
        <ConfirmActionForm
          action={restoreClientAction.bind(null, client.id, redirectTo)}
          triggerLabel="استرجاع"
          triggerVariant="outline"
          triggerSize="sm"
          confirmTitle="استرجاع العميل"
          confirmMessage="سيعود العميل إلى القائمة النشطة ويمكن متابعة العمل عليه مباشرة."
          confirmLabel="استرجاع"
          destructive={false}
        />
      }
      deleteAction={
        <ConfirmActionForm
          action={deleteClientAction.bind(null, client.id, redirectTo)}
          triggerLabel="حذف نهائي"
          triggerVariant="outline"
          triggerSize="sm"
          confirmTitle="حذف العميل نهائيًا"
          confirmMessage="سيتم حذف العميل وكل البيانات المرتبطة به نهائيًا. لا يمكن التراجع عن هذا الإجراء."
          confirmLabel="حذف نهائي"
          destructive
        />
      }
    />
  ));
}

function renderMatterCards(items: Matter[], redirectTo: string) {
  return items.map((matter) => (
    <ArchiveCard
      key={matter.id}
      title={matter.title}
      subtitle={matter.summary ?? undefined}
      badges={
        <>
          <Badge variant="default">قضية</Badge>
          <Badge variant="warning">مؤرشفة</Badge>
          <Badge variant={matter.is_private ? 'warning' : 'success'}>{matter.is_private ? 'خاصة' : 'عامة'}</Badge>
        </>
      }
      fields={[
        {
          label: 'الموكل',
          value: matter.client ? (
            <Link href={`/app/clients/${matter.client.id}`} className="underline-offset-2 hover:underline">
              {matter.client.name}
            </Link>
          ) : (
            '—'
          ),
        },
        { label: 'رقم Najiz', value: matter.najiz_case_number ?? '—' },
        { label: 'آخر تحديث', value: formatDate(matter.updated_at) },
      ]}
      viewHref={`/app/matters/${matter.id}`}
      restoreAction={
        <ConfirmActionForm
          action={restoreMatterAction.bind(null, matter.id, redirectTo)}
          triggerLabel="استرجاع"
          triggerVariant="outline"
          triggerSize="sm"
          confirmTitle="استرجاع القضية"
          confirmMessage="ستعود القضية إلى حالتها النشطة ويمكن استكمال الإجراءات عليها."
          confirmLabel="استرجاع"
          destructive={false}
        />
      }
      deleteAction={
        <ConfirmActionForm
          action={deleteMatterAction.bind(null, matter.id, redirectTo)}
          triggerLabel="حذف نهائي"
          triggerVariant="outline"
          triggerSize="sm"
          confirmTitle="حذف القضية نهائيًا"
          confirmMessage="سيتم حذف القضية وكل المهام والمستندات والفوترة المرتبطة بها نهائيًا."
          confirmLabel="حذف نهائي"
          destructive
        />
      }
    />
  ));
}

function renderDocumentCards(items: DocumentWithLatest[], redirectTo: string) {
  return items.map((document) => (
    <ArchiveCard
      key={document.id}
      title={document.title}
      subtitle={document.description ?? undefined}
      badges={
        <>
          <Badge variant="default">مستند</Badge>
          <Badge variant="warning">مؤرشف</Badge>
        </>
      }
      fields={[
        {
          label: 'القضية',
          value: document.matter ? (
            <Link href={`/app/matters/${document.matter.id}`} className="underline-offset-2 hover:underline">
              {document.matter.title}
            </Link>
          ) : (
            '—'
          ),
        },
        {
          label: 'العميل',
          value: document.client ? (
            <Link href={`/app/clients/${document.client.id}`} className="underline-offset-2 hover:underline">
              {document.client.name}
            </Link>
          ) : (
            '—'
          ),
        },
        { label: 'آخر نسخة', value: document.latestVersion ? `v${document.latestVersion.version_no}` : '—' },
        { label: 'اسم الملف', value: document.latestVersion?.file_name ?? '—', fullWidth: true },
        { label: 'تاريخ الرفع', value: document.latestVersion ? formatDate(document.latestVersion.created_at) : '—' },
      ]}
      viewHref={`/app/documents/${document.id}`}
      restoreAction={
        <ConfirmActionForm
          action={restoreDocumentAction.bind(null, document.id, redirectTo)}
          triggerLabel="استرجاع"
          triggerVariant="outline"
          triggerSize="sm"
          confirmTitle="استرجاع المستند"
          confirmMessage="سيعود المستند إلى قائمة المستندات النشطة."
          confirmLabel="استرجاع"
          destructive={false}
        />
      }
      deleteAction={
        <ConfirmActionForm
          action={deleteDocumentAction.bind(null, document.id, redirectTo)}
          triggerLabel="حذف نهائي"
          triggerVariant="outline"
          triggerSize="sm"
          confirmTitle="حذف المستند نهائيًا"
          confirmMessage="سيتم حذف المستند وكل نسخه وروابط مشاركته نهائيًا."
          confirmLabel="حذف نهائي"
          destructive
        />
      }
    />
  ));
}

function renderTaskCards(items: Task[], redirectTo: string) {
  return items.map((task) => (
    <ArchiveCard
      key={task.id}
      title={task.title}
      subtitle={task.description ?? undefined}
      badges={
        <>
          <Badge variant="default">مهمة</Badge>
          <Badge variant={taskStatusVariant[task.status]}>{taskStatusLabel[task.status]}</Badge>
          <Badge variant="warning">مؤرشفة</Badge>
        </>
      }
      fields={[
        {
          label: 'القضية',
          value: task.matter ? (
            <Link href={`/app/matters/${task.matter.id}`} className="underline-offset-2 hover:underline">
              {task.matter.title}
            </Link>
          ) : (
            '—'
          ),
        },
        { label: 'الأولوية', value: taskPriorityLabel[task.priority] },
        { label: 'الاستحقاق', value: task.due_at ? formatDateTime(task.due_at) : '—' },
        { label: 'آخر تحديث', value: formatDate(task.updated_at) },
      ]}
      viewHref={task.matter ? `/app/matters/${task.matter.id}?tab=tasks` : '/app/tasks?archived=archived'}
      restoreAction={
        <ConfirmActionForm
          action={restoreTaskAction.bind(null, task.id, redirectTo)}
          triggerLabel="استرجاع"
          triggerVariant="outline"
          triggerSize="sm"
          confirmTitle="استرجاع المهمة"
          confirmMessage="ستعود المهمة إلى قائمة المهام ويمكن استكمال العمل عليها."
          confirmLabel="استرجاع"
          destructive={false}
        />
      }
      deleteAction={
        <ConfirmActionForm
          action={deleteTaskAction.bind(null, task.id, redirectTo)}
          triggerLabel="حذف نهائي"
          triggerVariant="outline"
          triggerSize="sm"
          confirmTitle="حذف المهمة نهائيًا"
          confirmMessage="سيتم حذف المهمة نهائيًا من النظام. لا يمكن التراجع عن هذا الإجراء."
          confirmLabel="حذف نهائي"
          destructive
        />
      }
    />
  ));
}

function renderInvoiceCards(items: Invoice[], redirectTo: string) {
  return items.map((invoice) => (
    <ArchiveCard
      key={invoice.id}
      title={invoice.number}
      badges={
        <>
          <Badge variant="default">فاتورة</Badge>
          <Badge variant={invoiceStatusVariant[invoice.status]}>{invoiceStatusLabel[invoice.status]}</Badge>
          <Badge variant="warning">مؤرشفة</Badge>
        </>
      }
      fields={[
        {
          label: 'العميل',
          value: invoice.client ? (
            <Link href={`/app/clients/${invoice.client.id}`} className="underline-offset-2 hover:underline">
              {invoice.client.name}
            </Link>
          ) : (
            '—'
          ),
        },
        {
          label: 'القضية',
          value: invoice.matter ? (
            <Link href={`/app/matters/${invoice.matter.id}`} className="underline-offset-2 hover:underline">
              {invoice.matter.title}
            </Link>
          ) : (
            '—'
          ),
        },
        { label: 'الإجمالي', value: `${formatMoney(invoice.total)} ${invoice.currency}` },
        { label: 'الإصدار', value: formatDate(invoice.issued_at) },
        { label: 'الاستحقاق', value: invoice.due_at ? formatDate(invoice.due_at) : '—' },
      ]}
      viewHref={`/app/billing/invoices/${invoice.id}`}
      restoreAction={
        <ConfirmActionForm
          action={restoreInvoiceAction.bind(null, invoice.id, redirectTo)}
          triggerLabel="استرجاع"
          triggerVariant="outline"
          triggerSize="sm"
          confirmTitle="استرجاع الفاتورة"
          confirmMessage="ستعود الفاتورة إلى قائمة الفواتير النشطة."
          confirmLabel="استرجاع"
          destructive={false}
        />
      }
      deleteAction={
        <ConfirmActionForm
          action={deleteInvoiceAction.bind(null, invoice.id, redirectTo)}
          triggerLabel="حذف نهائي"
          triggerVariant="outline"
          triggerSize="sm"
          confirmTitle="حذف الفاتورة نهائيًا"
          confirmMessage="سيتم حذف الفاتورة وكل الدفعات المرتبطة بها نهائيًا."
          confirmLabel="حذف نهائي"
          destructive
        />
      }
    />
  ));
}

function renderTemplateCards(items: Template[], redirectTo: string) {
  return items.map((template) => (
    <ArchiveCard
      key={template.id}
      title={template.name}
      subtitle={template.description ?? undefined}
      badges={
        <>
          <Badge variant="default">قالب</Badge>
          <Badge variant="warning">مؤرشف</Badge>
        </>
      }
      fields={[
        { label: 'التصنيف', value: template.category },
        { label: 'النوع', value: 'DOCX' },
        { label: 'آخر تحديث', value: formatDate(template.updated_at) },
      ]}
      viewHref={`/app/templates/${template.id}`}
      restoreAction={
        <ConfirmActionForm
          action={restoreTemplateAction.bind(null, template.id, redirectTo)}
          triggerLabel="استرجاع"
          triggerVariant="outline"
          triggerSize="sm"
          confirmTitle="استرجاع القالب"
          confirmMessage="سيعود القالب إلى قائمة القوالب النشطة ويمكن استخدامه مجددًا."
          confirmLabel="استرجاع"
          destructive={false}
        />
      }
      deleteAction={
        <ConfirmActionForm
          action={deleteTemplateAction.bind(null, template.id, redirectTo)}
          triggerLabel="حذف نهائي"
          triggerVariant="outline"
          triggerSize="sm"
          confirmTitle="حذف القالب نهائيًا"
          confirmMessage="سيتم حذف القالب وجميع نسخه نهائيًا. لا يمكن التراجع عن هذا الإجراء."
          confirmLabel="حذف نهائي"
          destructive
        />
      }
    />
  ));
}

function ArchiveHeader(props: {
  title: string;
  q: string;
  type: ArchiveType;
  success: string;
  error: string;
}) {
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-brand-navy dark:text-slate-100">{props.title}</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            مكان موحد لكل العناصر المؤرشفة مع خيارات الاسترجاع والحذف النهائي.
          </p>
        </div>
      </div>

      {props.success ? (
        <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200">
          {props.success}
        </p>
      ) : null}

      {props.error ? (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          {props.error}
        </p>
      ) : null}

      <form className="mt-5 grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-[1fr_200px_auto]">
        <label className="block">
          <span className="sr-only">بحث في الأرشيف</span>
          <input
            name="q"
            defaultValue={props.q}
            placeholder="ابحث بالاسم أو العنوان أو الرقم..."
            className="h-11 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
          />
        </label>

        <label className="block">
          <span className="sr-only">نوع العنصر</span>
          <select
            name="type"
            defaultValue={props.type}
            className="h-11 w-full rounded-lg border border-brand-border bg-white px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="all">كل الأنواع</option>
            {(
              Object.entries(archiveTypeLabels) as Array<[Exclude<ArchiveType, 'all'>, string]>
            ).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <button type="submit" className={buttonVariants('outline', 'sm')}>
          بحث
        </button>
      </form>
    </>
  );
}

function ArchiveSection(props: {
  title: string;
  count: number;
  viewAllHref: string;
  showViewAll: boolean;
  children: ReactNode;
}) {
  if (props.count === 0) return null;

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold text-brand-navy dark:text-slate-100">{props.title}</h2>
          <Badge variant="default">{props.count}</Badge>
        </div>
        {props.showViewAll ? (
          <Link href={props.viewAllHref} className={buttonVariants('ghost', 'sm')}>
            عرض الكل
          </Link>
        ) : null}
      </div>
      <div className="space-y-3">{props.children}</div>
    </section>
  );
}

type ArchiveCardField = {
  label: string;
  value: ReactNode;
  fullWidth?: boolean;
};

function ArchiveCard(props: {
  title: string;
  subtitle?: string;
  badges?: ReactNode;
  fields: ArchiveCardField[];
  viewHref?: string;
  viewLabel?: string;
  restoreAction: ReactNode;
  deleteAction?: ReactNode;
}) {
  return (
    <article className="rounded-xl border border-brand-border p-4 dark:border-slate-700">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {props.badges ? <div className="mb-2 flex flex-wrap gap-2">{props.badges}</div> : null}
          <h3 className="text-base font-semibold text-brand-navy dark:text-slate-100">{props.title}</h3>
          {props.subtitle ? (
            <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">{props.subtitle}</p>
          ) : null}
        </div>
      </div>

      <dl className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {props.fields.map((field) => (
          <div
            key={`${props.title}-${field.label}`}
            className={`rounded-md bg-brand-background/70 px-3 py-2 dark:bg-slate-800/70 ${
              field.fullWidth ? 'sm:col-span-2 xl:col-span-3' : ''
            }`}
          >
            <dt className="text-xs text-slate-500 dark:text-slate-400">{field.label}</dt>
            <dd className="mt-1 break-words font-medium text-slate-700 dark:text-slate-200">{field.value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-4 flex flex-wrap gap-2">
        {props.viewHref ? (
          <Link href={props.viewHref} className={buttonVariants('ghost', 'sm')}>
            {props.viewLabel ?? 'عرض'}
          </Link>
        ) : null}
        {props.restoreAction}
        {props.deleteAction}
      </div>
    </article>
  );
}

function ArchivePagination(props: {
  type: Exclude<ArchiveType, 'all'>;
  q: string;
  page: number;
  limit: number;
  total: number;
}) {
  const totalPages = Math.max(1, Math.ceil(props.total / props.limit));
  const hasPrevious = props.page > 1;
  const hasNext = props.page < totalPages;

  if (totalPages <= 1) return null;

  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600 dark:text-slate-300">
      <p>
        الصفحة {props.page} من {totalPages}
      </p>
      <div className="flex items-center gap-2">
        {hasPrevious ? (
          <Link
            href={buildArchivePath({ type: props.type, q: props.q, page: props.page - 1 })}
            className={buttonVariants('outline', 'sm')}
          >
            السابق
          </Link>
        ) : null}
        {hasNext ? (
          <Link
            href={buildArchivePath({ type: props.type, q: props.q, page: props.page + 1 })}
            className={buttonVariants('outline', 'sm')}
          >
            التالي
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function hasAnyArchivedData(data: Awaited<ReturnType<typeof loadArchiveOverview>>) {
  return Object.values(data).some((section) => section.total > 0);
}

function buildArchivePath(params: { type?: ArchiveType; q?: string; page?: number }) {
  const search = new URLSearchParams();

  if (params.q?.trim()) {
    search.set('q', params.q.trim());
  }

  if (params.type && params.type !== 'all') {
    search.set('type', params.type);
  }

  if (params.page && params.page > 1) {
    search.set('page', String(params.page));
  }

  const query = search.toString();
  return query ? `/app/archive?${query}` : '/app/archive';
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('ar-SA');
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('ar-SA');
}

function formatMoney(value: string | number) {
  const amount = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(amount)) return '0.00';
  return amount.toFixed(2);
}

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
