import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FormSubmitButton } from '@/components/ui/form-submit-button';
import { listClients } from '@/lib/clients';
import { listMatterEvents, type MatterEventType } from '@/lib/matterEvents';
import { getMatterById, type MatterStatus } from '@/lib/matters';
import { getCurrentAuthUser } from '@/lib/supabase/auth-session';
import {
  archiveMatterAction,
  createMatterEventAction,
  restoreMatterAction,
  updateMatterAction,
} from '../actions';

type MatterDetailsPageProps = {
  params: { id: string };
  searchParams?: {
    success?: string;
    error?: string;
    tab?: string;
    type?: string;
    page?: string;
  };
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

const eventTypeLabel: Record<MatterEventType, string> = {
  hearing: 'جلسة',
  call: 'اتصال',
  note: 'ملاحظة',
  email: 'إيميل',
  meeting: 'اجتماع',
  other: 'أخرى',
};

const eventTypeVariant: Record<MatterEventType, 'default' | 'success' | 'warning' | 'danger'> = {
  hearing: 'warning',
  call: 'default',
  note: 'success',
  email: 'default',
  meeting: 'success',
  other: 'default',
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

  const currentUser = await getCurrentAuthUser();

  const success = searchParams?.success ? safeDecode(searchParams.success) : '';
  const error = searchParams?.error ? safeDecode(searchParams.error) : '';
  const tab = searchParams?.tab === 'timeline' ? 'timeline' : 'summary';

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

      <div className="flex flex-wrap gap-2 border-b border-brand-border pb-3 dark:border-slate-700">
        <Link
          href={`/app/matters/${matter.id}?tab=summary`}
          className={`${buttonVariants(tab === 'summary' ? 'primary' : 'outline', 'sm')}`}
        >
          ملخص
        </Link>
        <Link
          href={`/app/matters/${matter.id}?tab=timeline`}
          className={`${buttonVariants(tab === 'timeline' ? 'primary' : 'outline', 'sm')}`}
        >
          الخط الزمني
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

      {tab === 'summary' ? (
        <MatterSummarySection matterId={matter.id} matter={matter} />
      ) : (
        <MatterTimelineSection
          matterId={matter.id}
          currentUserId={currentUser?.id ?? null}
          searchParams={searchParams}
        />
      )}
    </Card>
  );
}

async function MatterSummarySection({
  matterId,
  matter,
}: {
  matterId: string;
  matter: NonNullable<Awaited<ReturnType<typeof getMatterById>>>;
}) {
  const clientsResult = await listClients({
    status: 'all',
    page: 1,
    limit: 50,
  });

  const selectedClientExists = clientsResult.data.some((client) => client.id === matter.client_id);

  return (
    <>
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
          <form action={restoreMatterAction.bind(null, matterId, `/app/matters/${matterId}`)}>
            <button type="submit" className={buttonVariants('outline', 'md')}>
              استعادة
            </button>
          </form>
        ) : (
          <form action={archiveMatterAction.bind(null, matterId, `/app/matters/${matterId}`)}>
            <button type="submit" className={buttonVariants('outline', 'md')}>
              أرشفة
            </button>
          </form>
        )}
      </div>
    </>
  );
}

async function MatterTimelineSection({
  matterId,
  currentUserId,
  searchParams,
}: {
  matterId: string;
  currentUserId: string | null;
  searchParams?: {
    type?: string;
    page?: string;
    error?: string;
  };
}) {
  const typeRaw = (searchParams?.type ?? 'all').trim();
  const typeFilter: MatterEventType | 'all' =
    typeRaw === 'all' ||
    typeRaw === 'hearing' ||
    typeRaw === 'call' ||
    typeRaw === 'note' ||
    typeRaw === 'email' ||
    typeRaw === 'meeting' ||
    typeRaw === 'other'
      ? typeRaw
      : 'all';
  const page = Math.max(1, Number(searchParams?.page ?? '1') || 1);
  const cannotAddEvents =
    (searchParams?.error ? safeDecode(searchParams.error) : '') === 'لا تملك صلاحية إضافة أحداث لهذه القضية.';

  const eventsResult = await listMatterEvents(matterId, {
    type: typeFilter,
    page,
    limit: 10,
  });

  const totalPages = Math.max(1, Math.ceil(eventsResult.total / eventsResult.limit));
  const hasPrevious = eventsResult.page > 1;
  const hasNext = eventsResult.page < totalPages;
  const previousQuery = buildTimelineQuery(typeFilter, Math.max(1, eventsResult.page - 1));
  const nextQuery = buildTimelineQuery(typeFilter, Math.min(totalPages, eventsResult.page + 1));

  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-brand-border p-4 dark:border-slate-700">
        <h2 className="font-semibold text-brand-navy dark:text-slate-100">إضافة حدث</h2>
        {cannotAddEvents ? (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
            لا تملك صلاحية إضافة أحداث لهذه القضية.
          </p>
        ) : (
          <form action={createMatterEventAction.bind(null, matterId)} className="mt-4 grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-1 text-sm">
                <span className="font-medium text-slate-700 dark:text-slate-200">النوع</span>
                <select
                  name="type"
                  defaultValue="note"
                  className="h-11 w-full rounded-lg border border-brand-border bg-white px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
                >
                  <option value="hearing">جلسة</option>
                  <option value="call">اتصال</option>
                  <option value="note">ملاحظة</option>
                  <option value="email">إيميل</option>
                  <option value="meeting">اجتماع</option>
                  <option value="other">أخرى</option>
                </select>
              </label>

              <label className="block space-y-1 text-sm">
                <span className="font-medium text-slate-700 dark:text-slate-200">التاريخ (اختياري)</span>
                <input
                  type="datetime-local"
                  name="event_date"
                  className="h-11 w-full rounded-lg border border-brand-border px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
                />
              </label>
            </div>

            <label className="block space-y-1 text-sm">
              <span className="font-medium text-slate-700 dark:text-slate-200">الملاحظات</span>
              <textarea
                name="note"
                rows={4}
                className="w-full rounded-lg border border-brand-border px-3 py-2 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
              />
            </label>

            <div>
              <FormSubmitButton pendingText="جارٍ إضافة الحدث..." variant="primary" size="md">
                إضافة حدث
              </FormSubmitButton>
            </div>
          </form>
        )}
      </div>

      <form className="grid gap-3 rounded-lg border border-brand-border p-4 dark:border-slate-700 sm:grid-cols-[220px_auto]">
        <input type="hidden" name="tab" value="timeline" />
        <label className="block">
          <span className="sr-only">نوع الحدث</span>
          <select
            name="type"
            defaultValue={typeFilter}
            className="h-11 w-full rounded-lg border border-brand-border bg-white px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="all">كل الأنواع</option>
            <option value="hearing">جلسة</option>
            <option value="call">اتصال</option>
            <option value="note">ملاحظة</option>
            <option value="email">إيميل</option>
            <option value="meeting">اجتماع</option>
            <option value="other">أخرى</option>
          </select>
        </label>
        <button type="submit" className={buttonVariants('outline', 'sm')}>
          فلترة
        </button>
      </form>

      {!eventsResult.data.length ? (
        <div className="rounded-lg border border-brand-border p-6 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">
          لا توجد أحداث في الخط الزمني حتى الآن.
        </div>
      ) : (
        <div className="space-y-3">
          {eventsResult.data.map((event) => (
            <article key={event.id} className="rounded-lg border border-brand-border p-4 dark:border-slate-700">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={eventTypeVariant[event.type]}>{eventTypeLabel[event.type]}</Badge>
                {event.event_date ? (
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    تاريخ الحدث: {new Date(event.event_date).toLocaleString('ar-SA')}
                  </span>
                ) : null}
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  أضيف في: {new Date(event.created_at).toLocaleString('ar-SA')}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  بواسطة: {event.created_by === currentUserId ? 'أنت' : event.created_by}
                </span>
              </div>

              <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700 dark:text-slate-200">
                {event.note ?? 'بدون ملاحظات.'}
              </p>
            </article>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600 dark:text-slate-300">
        <p>
          الصفحة {eventsResult.page} من {totalPages} ({eventsResult.total} حدث)
        </p>
        <div className="flex items-center gap-2">
          <Link
            aria-disabled={!hasPrevious}
            href={{ pathname: `/app/matters/${matterId}`, query: previousQuery }}
            className={`${buttonVariants('outline', 'sm')} ${!hasPrevious ? 'pointer-events-none opacity-50' : ''}`}
          >
            السابق
          </Link>
          <Link
            aria-disabled={!hasNext}
            href={{ pathname: `/app/matters/${matterId}`, query: nextQuery }}
            className={`${buttonVariants('outline', 'sm')} ${!hasNext ? 'pointer-events-none opacity-50' : ''}`}
          >
            التالي
          </Link>
        </div>
      </div>
    </section>
  );
}

function buildTimelineQuery(type: MatterEventType | 'all', page: number) {
  const query: Record<string, string> = {
    tab: 'timeline',
    page: String(page),
  };

  if (type !== 'all') {
    query.type = type;
  }

  return query;
}

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
