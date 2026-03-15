'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';

type PortalTabKey = 'overview' | 'matters' | 'documents' | 'invoices';

export type ClientPortalMatter = {
  id: string;
  title: string;
  status: string;
  summary: string | null;
  case_type: string | null;
  updated_at: string;
  events: ClientPortalMatterEvent[];
  communications: ClientPortalMatterCommunication[];
};

export type ClientPortalMatterCommunication = {
  id: string;
  sender: 'CLIENT' | 'LAWYER';
  message: string;
  created_at: string;
};

export type ClientPortalMatterEvent = {
  id: string;
  type: string;
  note: string | null;
  event_date: string | null;
  created_at: string;
  created_by_name: string | null;
};

export type ClientPortalInvoice = {
  id: string;
  number: string;
  status: string;
  total: number;
  currency: string | null;
  issued_at: string | null;
  due_at: string | null;
  paid_amount: number;
  remaining_amount: number;
  matter_title: string | null;
};

export type ClientPortalDocumentVersion = {
  version_no: number;
  storage_path: string;
  file_name: string;
  file_size: number;
  mime_type: string | null;
  created_at: string;
};

export type ClientPortalDocument = {
  id: string;
  title: string;
  matter_id: string | null;
  matter_title: string | null;
  created_at: string;
  latest_version: ClientPortalDocumentVersion | null;
};

export type ClientPortalDashboardData = {
  client: {
    name: string;
    email: string | null;
    phone: string | null;
  };
  matters: ClientPortalMatter[];
  invoices: ClientPortalInvoice[];
  documents: ClientPortalDocument[];
};

const MATTER_STATUS_LABELS: Record<string, string> = {
  new: 'جديدة',
  in_progress: 'قيد المعالجة',
  on_hold: 'معلّقة',
  closed: 'مغلقة',
  archived: 'مؤرشفة',
};

const INVOICE_STATUS_LABELS: Record<string, string> = {
  unpaid: 'غير مدفوعة',
  partial: 'مدفوعة جزئيًا',
  paid: 'مدفوعة',
  void: 'ملغاة',
};

const MATTER_EVENT_TYPE_LABELS: Record<string, string> = {
  hearing: 'جلسة',
  call: 'اتصال',
  note: 'ملاحظة',
  email: 'بريد',
  meeting: 'اجتماع',
  other: 'أخرى',
};

export function ClientPortalDashboard({ data }: { data: ClientPortalDashboardData }) {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<PortalTabKey>('overview');
  const [matterQuery, setMatterQuery] = useState('');
  const [matterStatus, setMatterStatus] = useState<'all' | string>('all');
  const [docQuery, setDocQuery] = useState('');
  const [invoiceStatus, setInvoiceStatus] = useState<'all' | string>('all');

  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadMatterId, setUploadMatterId] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState('');

  const [downloadingPath, setDownloadingPath] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState('');

  const [questionMatterId, setQuestionMatterId] = useState<string | null>(null);
  const [questionText, setQuestionText] = useState('');
  const [submittingQuestion, setSubmittingQuestion] = useState(false);
  const [questionError, setQuestionError] = useState('');
  const [questionSuccess, setQuestionSuccess] = useState('');

  const openMattersCount = data.matters.filter((matter) => matter.status !== 'closed' && matter.status !== 'archived').length;
  const unpaidInvoicesCount = data.invoices.filter(
    (invoice) => invoice.status === 'unpaid' || invoice.status === 'partial' || invoice.remaining_amount > 0,
  ).length;
  const latestDocumentsCount = data.documents.filter((document) => Boolean(document.latest_version)).length;

  const filteredMatters = useMemo(() => {
    const query = matterQuery.trim().toLowerCase();
    return data.matters.filter((matter) => {
      const matchesStatus = matterStatus === 'all' || matter.status === matterStatus;
      const haystack = `${matter.title} ${matter.summary ?? ''} ${matter.case_type ?? ''}`.toLowerCase();
      const matchesQuery = !query || haystack.includes(query);
      return matchesStatus && matchesQuery;
    });
  }, [data.matters, matterQuery, matterStatus]);

  const filteredDocuments = useMemo(() => {
    const query = docQuery.trim().toLowerCase();
    return data.documents.filter((document) => {
      const haystack = `${document.title} ${document.matter_title ?? ''} ${document.latest_version?.file_name ?? ''}`.toLowerCase();
      return !query || haystack.includes(query);
    });
  }, [data.documents, docQuery]);

  const filteredInvoices = useMemo(() => {
    return data.invoices.filter((invoice) => invoiceStatus === 'all' || invoice.status === invoiceStatus);
  }, [data.invoices, invoiceStatus]);

  const matterOptions = useMemo(
    () => data.matters.map((matter) => ({ id: matter.id, label: matter.title })),
    [data.matters],
  );

  async function handleUploadSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUploadError('');
    setUploadSuccess('');

    const title = uploadTitle.trim();
    if (title.length < 2) {
      setUploadError('العنوان مطلوب ويجب أن لا يقل عن حرفين.');
      return;
    }

    if (!uploadFile) {
      setUploadError('يرجى اختيار ملف قبل الرفع.');
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('title', title);
      if (uploadMatterId) {
        formData.append('matter_id', uploadMatterId);
      }
      formData.append('file', uploadFile);

      const response = await fetch('/api/client-portal/documents/upload', {
        method: 'POST',
        body: formData,
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
      };

      if (!response.ok) {
        setUploadError(payload.error || 'تعذر رفع المستند حالياً.');
        return;
      }

      setUploadTitle('');
      setUploadMatterId('');
      setUploadFile(null);
      setUploadSuccess(payload.message || 'تم رفع المستند بنجاح.');
      setActiveTab('documents');
      router.refresh();
    } catch {
      setUploadError('تعذر رفع المستند حالياً.');
    } finally {
      setUploading(false);
    }
  }

  async function handleDocumentDownload(storagePath: string) {
    if (!storagePath) return;
    setDownloadError('');
    setDownloadingPath(storagePath);

    try {
      const response = await fetch('/api/client-portal/documents/download-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storage_path: storagePath }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        signedDownloadUrl?: string;
      };

      if (!response.ok || !payload.signedDownloadUrl) {
        setDownloadError(payload.error || 'تعذر تجهيز رابط التنزيل.');
        return;
      }

      window.open(payload.signedDownloadUrl, '_blank', 'noopener,noreferrer');
    } catch {
      setDownloadError('تعذر تجهيز رابط التنزيل.');
    } finally {
      setDownloadingPath(null);
    }
  }

  async function handleQuestionSubmit(matterId: string, event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setQuestionError('');
    setQuestionSuccess('');

    const text = questionText.trim();
    if (!text) {
      setQuestionError('يرجى كتابة نص الاستفسار.');
      return;
    }

    setSubmittingQuestion(true);
    try {
      const response = await fetch('/api/client-portal/communications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matter_id: matterId, message: text }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setQuestionError(payload.error || 'تعذر إرسال استفسارك. يرجى المحاولة لاحقاً.');
      } else {
        setQuestionText('');
        setQuestionSuccess('تم إرسال استفسارك بنجاح. سيتم إبلاغ المحامي وسيرد عليك في أقرب وقت.');
        setTimeout(() => setQuestionSuccess(''), 5000);
        router.refresh();
      }
    } catch {
      setQuestionError('تعذر إرسال استفسارك. يرجى المحاولة لاحقاً.');
    } finally {
      setSubmittingQuestion(false);
    }
  }

  return (
    <div className="rounded-xl2 border border-brand-border bg-white p-4 shadow-panel dark:border-slate-700 dark:bg-slate-900 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-navy dark:text-slate-100">مرحبًا {data.client.name}</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">هذه لوحة المتابعة التفاعلية الخاصة بك.</p>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400" dir="ltr">
            {data.client.email || '—'}
            {data.client.phone ? ` · ${data.client.phone}` : ''}
          </p>
        </div>

        <form action="/api/client-portal/auth/logout" method="post">
          <button type="submit" className={buttonVariants('outline', 'sm')}>
            تسجيل الخروج
          </button>
        </form>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <StatCard label="القضايا المفتوحة" value={openMattersCount} />
        <StatCard label="فواتير غير مكتملة" value={unpaidInvoicesCount} />
        <StatCard label="مستندات متاحة" value={latestDocumentsCount} />
      </div>

      <div className="mt-6 flex flex-wrap gap-2 rounded-lg border border-brand-border p-2 dark:border-slate-700">
        {[
          { key: 'overview' as const, label: 'نظرة عامة' },
          { key: 'matters' as const, label: 'القضايا' },
          { key: 'documents' as const, label: 'المستندات' },
          { key: 'invoices' as const, label: 'الفواتير' },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={activeTab === tab.key ? buttonVariants('secondary', 'sm') : buttonVariants('outline', 'sm')}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' ? (
        <section className="mt-6 grid gap-6 lg:grid-cols-3">
          <Panel title="آخر القضايا" className="lg:col-span-2">
            {!data.matters.length ? (
              <EmptyText text="لا توجد قضايا مرتبطة بحسابك حتى الآن." />
            ) : (
              <ul className="space-y-3">
                {data.matters.slice(0, 5).map((matter) => (
                  <li key={matter.id} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium text-slate-800 dark:text-slate-100">{matter.title}</p>
                      <Badge variant={toMatterBadgeVariant(matter.status)}>
                        {MATTER_STATUS_LABELS[matter.status] || matter.status}
                      </Badge>
                    </div>
                    {matter.summary ? (
                      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{matter.summary}</p>
                    ) : null}
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                      آخر تحديث: {formatDateTime(matter.updated_at)}
                    </p>
                    {matter.events[0] ? (
                      <div className="mt-2 rounded-md bg-brand-background/70 px-2 py-2 text-xs dark:bg-slate-800/70">
                        <div className="flex items-center gap-2">
                          <Badge variant={toMatterEventBadgeVariant(matter.events[0].type)}>
                            {MATTER_EVENT_TYPE_LABELS[matter.events[0].type] || matter.events[0].type}
                          </Badge>
                          <span className="text-slate-500 dark:text-slate-400">
                            {matter.events[0].event_date
                              ? `تاريخ الحدث: ${formatDateTime(matter.events[0].event_date)}`
                              : `أضيف في: ${formatDateTime(matter.events[0].created_at)}`}
                          </span>
                        </div>
                        <p className="mt-1 text-slate-600 dark:text-slate-300">{matter.events[0].note || 'بدون ملاحظات.'}</p>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="آخر المستندات">
            {!data.documents.length ? (
              <EmptyText text="لا توجد مستندات بعد." />
            ) : (
              <ul className="space-y-3">
                {data.documents.slice(0, 5).map((document) => (
                  <li key={document.id} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                    <p className="font-medium text-slate-800 dark:text-slate-100">{document.title}</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {document.matter_title ? `القضية: ${document.matter_title}` : 'بدون ربط بقضية'}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {document.latest_version ? document.latest_version.file_name : 'لم تُرفع نسخة بعد'}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </section>
      ) : null}

      {activeTab === 'matters' ? (
        <section className="mt-6 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_220px]">
            <input
              value={matterQuery}
              onChange={(event) => setMatterQuery(event.target.value)}
              placeholder="ابحث بعنوان القضية أو الملخص..."
              className="h-11 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
            />
            <select
              value={matterStatus}
              onChange={(event) => setMatterStatus(event.target.value)}
              className="h-11 w-full rounded-lg border border-brand-border bg-white px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
            >
              <option value="all">كل الحالات</option>
              <option value="new">جديدة</option>
              <option value="in_progress">قيد المعالجة</option>
              <option value="on_hold">معلّقة</option>
              <option value="closed">مغلقة</option>
              <option value="archived">مؤرشفة</option>
            </select>
          </div>

          {!filteredMatters.length ? (
            <EmptyText text="لا توجد نتائج مطابقة." />
          ) : (
            <div className="space-y-3">
              {filteredMatters.map((matter) => (
                <article key={matter.id} className="rounded-lg border border-brand-border p-4 dark:border-slate-700">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h3 className="font-semibold text-brand-navy dark:text-slate-100">{matter.title}</h3>
                    <Badge variant={toMatterBadgeVariant(matter.status)}>
                      {MATTER_STATUS_LABELS[matter.status] || matter.status}
                    </Badge>
                  </div>
                  {matter.case_type ? (
                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">نوع القضية: {matter.case_type}</p>
                  ) : null}
                  {matter.summary ? (
                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{matter.summary}</p>
                  ) : null}
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    آخر تحديث: {formatDateTime(matter.updated_at)}
                  </p>

                  <div className="mt-3 rounded-md border border-brand-border p-3 dark:border-slate-700">
                    <p className="text-xs font-medium text-slate-600 dark:text-slate-300">الخط الزمني</p>
                    {!matter.events.length ? (
                      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">لا توجد أحداث زمنية مضافة بعد.</p>
                    ) : (
                      <ul className="mt-2 space-y-2">
                        {matter.events.map((event) => (
                          <li key={event.id} className="rounded-md bg-brand-background/70 px-2 py-2 dark:bg-slate-800/70">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant={toMatterEventBadgeVariant(event.type)}>
                                {MATTER_EVENT_TYPE_LABELS[event.type] || event.type}
                              </Badge>
                              <span className="text-xs text-slate-500 dark:text-slate-400">
                                {event.event_date
                                  ? `تاريخ الحدث: ${formatDateTime(event.event_date)}`
                                  : `أضيف في: ${formatDateTime(event.created_at)}`}
                              </span>
                              {event.created_by_name ? (
                                <span className="text-xs text-slate-500 dark:text-slate-400">
                                  بواسطة: {event.created_by_name}
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{event.note || 'بدون ملاحظات.'}</p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Communications Section */}
                  <div className="mt-4 rounded-md border border-brand-border p-3 dark:border-slate-700">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-slate-600 dark:text-slate-300">الأسئلة والاستفسارات</p>
                      <button
                        type="button"
                        onClick={() => setQuestionMatterId(questionMatterId === matter.id ? null : matter.id)}
                        className={buttonVariants('outline', 'sm')}
                      >
                        {questionMatterId === matter.id ? 'إلغاء' : 'طرح استفسار'}
                      </button>
                    </div>

                    {questionMatterId === matter.id && (
                      <form onSubmit={(e) => handleQuestionSubmit(matter.id, e)} className="mt-3 space-y-3">
                        <div className="rounded-lg bg-blue-50 p-3 text-xs text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                          نأمل أن يكون الاستفسار واضحاً ومباشراً قدر الإمكان لمساعدة المحامي في الرد بشكل دقيق.
                        </div>
                        {questionError && <p className="text-xs text-red-600 dark:text-red-400">{questionError}</p>}
                        {questionSuccess && <p className="text-xs text-emerald-600 dark:text-emerald-400">{questionSuccess}</p>}
                        <textarea
                          placeholder="اكتب استفسارك هنا..."
                          value={questionText}
                          onChange={(e) => setQuestionText(e.target.value)}
                          className="min-h-[100px] w-full resize-y rounded-lg border border-brand-border p-3 outline-none focus:border-brand-emerald focus:ring-1 focus:ring-brand-emerald dark:border-slate-700 dark:bg-slate-900"
                          required
                        />
                        <button
                          type="submit"
                          disabled={submittingQuestion}
                          className={buttonVariants('primary', 'sm')}
                        >
                          {submittingQuestion ? 'جاري الإرسال...' : 'إرسال الاستفسار'}
                        </button>
                      </form>
                    )}

                    {!matter.communications?.length ? (
                      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">لا توجد استفسارات سابقة.</p>
                    ) : (
                      <ul className="mt-3 space-y-3">
                        {matter.communications.map((comm) => (
                          <li
                            key={comm.id}
                            className={`rounded-lg p-3 ${
                              comm.sender === 'CLIENT'
                                ? 'bg-slate-50 dark:bg-slate-800'
                                : 'bg-emerald-50 dark:bg-emerald-900/20'
                            }`}
                          >
                            <div className="mb-1 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                              <span className="font-semibold text-slate-700 dark:text-slate-300">
                                {comm.sender === 'CLIENT' ? data.client.name : 'المحامي'}
                              </span>
                              <span>{formatDateTime(comm.created_at)}</span>
                            </div>
                            <p className="whitespace-pre-wrap text-sm text-slate-800 dark:text-slate-200">
                              {comm.message}
                            </p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {activeTab === 'documents' ? (
        <section className="mt-6 space-y-5">
          <Panel title="رفع مستند جديد">
            <form onSubmit={handleUploadSubmit} className="space-y-3">
              {uploadError ? (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
                  {uploadError}
                </p>
              ) : null}

              {uploadSuccess ? (
                <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200">
                  {uploadSuccess}
                </p>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block space-y-1 text-sm">
                  <span className="font-medium text-slate-700 dark:text-slate-200">عنوان المستند</span>
                  <input
                    value={uploadTitle}
                    onChange={(event) => setUploadTitle(event.target.value)}
                    placeholder="مثال: مذكرة جوابية"
                    className="h-11 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
                    required
                    minLength={2}
                  />
                </label>

                <label className="block space-y-1 text-sm">
                  <span className="font-medium text-slate-700 dark:text-slate-200">ربط بقضية</span>
                  <select
                    value={uploadMatterId}
                    onChange={(event) => setUploadMatterId(event.target.value)}
                    className="h-11 w-full rounded-lg border border-brand-border bg-white px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
                  >
                    <option value="">بدون ربط</option>
                    {matterOptions.map((matter) => (
                      <option key={matter.id} value={matter.id}>
                        {matter.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="block space-y-1 text-sm">
                <span className="font-medium text-slate-700 dark:text-slate-200">الملف</span>
                <input
                  type="file"
                  onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)}
                  className="block w-full rounded-lg border border-brand-border bg-white px-3 py-2 text-sm text-slate-700 file:me-3 file:rounded-md file:border-0 file:bg-brand-background file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-navy hover:file:bg-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:file:bg-slate-800 dark:file:text-slate-100"
                  required
                />
              </label>

              <div className="flex flex-wrap items-center gap-2">
                <button type="submit" disabled={uploading} className={buttonVariants('primary', 'sm')}>
                  {uploading ? 'جارٍ الرفع...' : 'رفع المستند'}
                </button>
                <p className="text-xs text-slate-500 dark:text-slate-400">الحد الأقصى 50 ميجابايت.</p>
              </div>
            </form>
          </Panel>

          <Panel title="المستندات">
            <div className="mb-3">
              <input
                value={docQuery}
                onChange={(event) => setDocQuery(event.target.value)}
                placeholder="ابحث بعنوان المستند أو اسم الملف..."
                className="h-11 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
              />
            </div>

            {downloadError ? (
              <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
                {downloadError}
              </p>
            ) : null}

            {!filteredDocuments.length ? (
              <EmptyText text="لا توجد مستندات مطابقة." />
            ) : (
              <div className="space-y-3">
                {filteredDocuments.map((document) => (
                  <article key={document.id} className="rounded-lg border border-brand-border p-4 dark:border-slate-700">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold text-brand-navy dark:text-slate-100">{document.title}</h3>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          {document.matter_title ? `القضية: ${document.matter_title}` : 'بدون ربط بقضية'}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          تاريخ الإنشاء: {formatDateTime(document.created_at)}
                        </p>
                        {document.latest_version ? (
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            آخر نسخة: v{document.latest_version.version_no} · {document.latest_version.file_name} ·{' '}
                            {formatBytes(document.latest_version.file_size)}
                          </p>
                        ) : null}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {document.latest_version ? (
                          <button
                            type="button"
                            onClick={() => handleDocumentDownload(document.latest_version!.storage_path)}
                            disabled={downloadingPath === document.latest_version.storage_path}
                            className={buttonVariants('outline', 'sm')}
                          >
                            {downloadingPath === document.latest_version.storage_path ? '...' : 'تنزيل'}
                          </button>
                        ) : (
                          <Badge variant="warning">بانتظار رفع نسخة</Badge>
                        )}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </Panel>
        </section>
      ) : null}

      {activeTab === 'invoices' ? (
        <section className="mt-6 space-y-4">
          <div className="grid gap-3 sm:grid-cols-[220px_auto]">
            <select
              value={invoiceStatus}
              onChange={(event) => setInvoiceStatus(event.target.value)}
              className="h-11 w-full rounded-lg border border-brand-border bg-white px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
            >
              <option value="all">كل الحالات</option>
              <option value="unpaid">غير مدفوعة</option>
              <option value="partial">جزئية</option>
              <option value="paid">مدفوعة</option>
              <option value="void">ملغاة</option>
            </select>
          </div>

          {!filteredInvoices.length ? (
            <EmptyText text="لا توجد فواتير مطابقة." />
          ) : (
            <div className="space-y-3">
              {filteredInvoices.map((invoice) => (
                <article key={invoice.id} className="rounded-lg border border-brand-border p-4 dark:border-slate-700">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-brand-navy dark:text-slate-100">فاتورة #{invoice.number}</h3>
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                        {invoice.matter_title ? `القضية: ${invoice.matter_title}` : 'غير مرتبطة بقضية'}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        إصدار: {formatDate(invoice.issued_at)}
                        {invoice.due_at ? ` · استحقاق: ${formatDate(invoice.due_at)}` : ''}
                      </p>
                    </div>
                    <Badge variant={toInvoiceBadgeVariant(invoice.status)}>
                      {INVOICE_STATUS_LABELS[invoice.status] || invoice.status}
                    </Badge>
                  </div>

                  <dl className="mt-3 grid gap-2 sm:grid-cols-3">
                    <AmountBox
                      label="الإجمالي"
                      value={`${formatMoney(invoice.total)} ${invoice.currency || 'SAR'}`}
                    />
                    <AmountBox
                      label="المدفوع"
                      value={`${formatMoney(invoice.paid_amount)} ${invoice.currency || 'SAR'}`}
                    />
                    <AmountBox
                      label="المتبقي"
                      value={`${formatMoney(invoice.remaining_amount)} ${invoice.currency || 'SAR'}`}
                    />
                  </dl>

                  <div className="mt-3">
                    <a
                      href={`/api/client-portal/invoices/${invoice.id}/pdf`}
                      target="_blank"
                      rel="noreferrer"
                      className={buttonVariants('outline', 'sm')}
                    >
                      تحميل PDF
                    </a>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}

function Panel({ title, className = '', children }: { title: string; className?: string; children: React.ReactNode }) {
  return (
    <section className={`rounded-lg border border-brand-border p-4 dark:border-slate-700 ${className}`}>
      <h2 className="mb-3 text-base font-semibold text-brand-navy dark:text-slate-100">{title}</h2>
      {children}
    </section>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-brand-border p-4 dark:border-slate-700">
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-bold text-brand-navy dark:text-slate-100">{value}</p>
    </div>
  );
}

function AmountBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-brand-background/70 px-3 py-2 dark:bg-slate-800/70">
      <dt className="text-xs text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-slate-700 dark:text-slate-200">{value}</dd>
    </div>
  );
}

function EmptyText({ text }: { text: string }) {
  return <p className="text-sm text-slate-500 dark:text-slate-400">{text}</p>;
}

function toMatterBadgeVariant(status: string): 'default' | 'success' | 'warning' | 'danger' {
  if (status === 'in_progress') return 'success';
  if (status === 'on_hold') return 'warning';
  if (status === 'archived') return 'danger';
  return 'default';
}

function toInvoiceBadgeVariant(status: string): 'default' | 'success' | 'warning' | 'danger' {
  if (status === 'paid') return 'success';
  if (status === 'void') return 'danger';
  if (status === 'unpaid' || status === 'partial') return 'warning';
  return 'default';
}

function toMatterEventBadgeVariant(type: string): 'default' | 'success' | 'warning' | 'danger' {
  if (type === 'hearing' || type === 'meeting') return 'warning';
  if (type === 'call' || type === 'email') return 'success';
  if (type === 'other') return 'danger';
  return 'default';
}

function formatDate(rawDate: string | null) {
  if (!rawDate) return '—';
  const date = new Date(rawDate);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('ar-SA');
}

function formatDateTime(rawDate: string | null) {
  if (!rawDate) return '—';
  const date = new Date(rawDate);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('ar-SA', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function formatMoney(value: number) {
  if (!Number.isFinite(value)) return '0.00';
  return value.toFixed(2);
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
