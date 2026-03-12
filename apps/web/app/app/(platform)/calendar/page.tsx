import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { requireOrgIdForUser } from '@/lib/org';
import { getErrorText, isMissingColumnError, isMissingRelationError } from '@/lib/shared-utils';
import { createSupabaseServerRlsClient } from '@/lib/supabase/server';
import { getCurrentAuthUser } from '@/lib/supabase/auth-session';

type CalendarPageProps = {
  searchParams?: {
    month?: string;
    type?: string;
    mine?: string;
  };
};

type CalendarSource = 'all' | 'hearings' | 'meetings' | 'tasks' | 'invoices';

type CalendarItem = {
  kind: 'hearing' | 'meeting' | 'task' | 'invoice';
  date: string;
  title: string;
  href: string;
};

const sourceOptions: Array<{ value: CalendarSource; label: string }> = [
  { value: 'all', label: 'الكل' },
  { value: 'hearings', label: 'الجلسات' },
  { value: 'meetings', label: 'الاجتماعات' },
  { value: 'tasks', label: 'المهام' },
  { value: 'invoices', label: 'الفواتير' },
];

const dayLabels = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'] as const;

export default async function CalendarPage({ searchParams }: CalendarPageProps) {
  const today = new Date();
  const monthParam = (searchParams?.month ?? '').trim();
  const monthKey = isValidMonthKey(monthParam) ? monthParam : formatMonthKey(today);

  const sourceRaw = (searchParams?.type ?? 'all').trim();
  const source: CalendarSource = sourceOptions.some((item) => item.value === (sourceRaw as any))
    ? (sourceRaw as CalendarSource)
    : 'all';

  const mine = (searchParams?.mine ?? '').trim() === '1';

  const { year, monthIndex } = parseMonthKey(monthKey);
  const monthStart = new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0));
  const monthEnd = new Date(Date.UTC(year, monthIndex + 1, 1, 0, 0, 0));

  const upcomingStart = today;
  const upcomingEnd = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000);

  const fetchStart = new Date(Math.min(monthStart.getTime(), upcomingStart.getTime()));
  const fetchEnd = new Date(Math.max(monthEnd.getTime(), upcomingEnd.getTime()));

  const fromDay = `${monthKey}-01`;
  const toDay = formatDateKey(
    new Date(Date.UTC(year, monthIndex + 1, 0, 0, 0, 0)),
  );

  let user: Awaited<ReturnType<typeof getCurrentAuthUser>>;
  let orgId: string;

  try {
    [user, orgId] = await Promise.all([getCurrentAuthUser(), requireOrgIdForUser()]);
  } catch (error) {
    return (
      <Card className="p-4 sm:p-6">
        <EmptyState
          title="التقويم"
          message="لا يوجد مكتب مفعّل لهذا الحساب. ابدأ التجربة من الصفحة الرئيسية أو تواصل معنا."
          backHref="/#trial"
          backLabel="ابدأ التجربة"
        />
      </Card>
    );
  }

  if (!user) {
    return (
      <Card className="p-6">
        <EmptyState title="التقويم" message="يرجى تسجيل الدخول للمتابعة." backHref="/signin" backLabel="تسجيل الدخول" />
      </Card>
    );
  }

  const supabase = createSupabaseServerRlsClient();
  const includeEvents = source === 'all' || source === 'hearings' || source === 'meetings';
  const includeTasks = source === 'all' || source === 'tasks';
  const includeInvoices = source === 'all' || source === 'invoices';

  const eventTypes: Array<'hearing' | 'meeting'> =
    source === 'hearings' ? ['hearing'] : source === 'meetings' ? ['meeting'] : ['hearing', 'meeting'];

  const eventsPromise = includeEvents
    ? loadCalendarMatterEvents({
      supabase,
      orgId,
      userId: user.id,
      mine,
      fetchStartIso: fetchStart.toISOString(),
      fetchEndIso: fetchEnd.toISOString(),
      eventTypes,
    })
    : Promise.resolve({ data: [], error: null } as any);

  const tasksPromise = includeTasks
    ? loadCalendarTasks({
      supabase,
      orgId,
      userId: user.id,
      mine,
      fetchStartIso: fetchStart.toISOString(),
      fetchEndIso: fetchEnd.toISOString(),
    })
    : Promise.resolve({ data: [], error: null } as any);

  const invoicesPromise = includeInvoices
    ? loadCalendarInvoices({
      supabase,
      orgId,
      fetchStartIso: fetchStart.toISOString(),
      fetchEndIso: fetchEnd.toISOString(),
    })
    : Promise.resolve({ data: [], error: null } as any);

  const [eventsRes, tasksRes, invoicesRes] = await Promise.all([
    eventsPromise,
    tasksPromise,
    invoicesPromise,
  ]);

  if (eventsRes.error || tasksRes.error || invoicesRes.error) {
    const message = toUserMessage(eventsRes.error || tasksRes.error || invoicesRes.error);
    return (
      <Card className="p-6">
        <h1 className="text-xl font-bold text-brand-navy dark:text-slate-100">التقويم</h1>
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

  const eventItems = (eventsRes.data as any[]).map((row) => {
    const matter = eventsRes.matterById.get(String(row.matter_id ?? ''));
    const matterTitle = matter?.title || 'قضية';
    const kind: 'hearing' | 'meeting' = row.type === 'meeting' ? 'meeting' : 'hearing';
    const title = kind === 'hearing' ? `جلسة: ${matterTitle}` : `اجتماع: ${matterTitle}`;
    return {
      kind,
      date: String(row.event_date),
      title,
      href: row.matter_id ? `/app/matters/${row.matter_id}` : '/app/matters',
    } satisfies CalendarItem;
  });

  const taskItems = (tasksRes.data as any[])
    .filter((row) => (mine ? row.assignee_id === user.id : true))
    .map((row) => {
      const title = `مهمة: ${String(row.title)}`;
      const href = row.matter_id ? `/app/matters/${row.matter_id}` : '/app/tasks';
      return {
        kind: 'task',
        date: String(row.due_at),
        title,
        href,
      } satisfies CalendarItem;
    });

  const invoiceItems = (invoicesRes.data as any[]).map((row) => {
    const number = row.number ? String(row.number) : row.id;
    return {
      kind: 'invoice',
      date: String(row.due_at),
      title: `فاتورة مستحقة: ${number}`,
      href: `/app/billing/invoices/${row.id}`,
    } satisfies CalendarItem;
  });

  const allItems = [...eventItems, ...taskItems, ...invoiceItems].filter((item) => {
    const date = new Date(item.date);
    return !Number.isNaN(date.getTime());
  });

  const monthItems = allItems
    .filter((item) => {
      const date = new Date(item.date);
      return date >= monthStart && date < monthEnd;
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const upcomingItems = allItems
    .filter((item) => {
      const date = new Date(item.date);
      return date >= upcomingStart && date < upcomingEnd;
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const itemsByDay = groupByDay(monthItems);
  const monthLabel = monthStart.toLocaleString('ar-SA', { month: 'long', year: 'numeric' });
  const prevMonth = formatMonthKey(new Date(Date.UTC(year, monthIndex - 1, 1)));
  const nextMonth = formatMonthKey(new Date(Date.UTC(year, monthIndex + 1, 1)));

  const queryBase = buildQuery({ type: source, mine });
  const monthCells = buildMonthCells(monthStart);
  const monthCounts = countItemsByKind(monthItems);
  const mobileDayEntries = Array.from(itemsByDay.entries()).sort(([a], [b]) => a.localeCompare(b));
  const todayKey = formatLocalDateKey(today);
  const currentMonthKey = formatMonthKey(today);

  return (
    <div className="space-y-5">
      <Card className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-brand-navy dark:text-slate-100">التقويم</h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              عرض مبسط للشهر الحالي والعناصر القادمة.
            </p>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
            <Link
              href={{ pathname: '/app/calendar', query: { ...queryBase, month: currentMonthKey } }}
              className={`${buttonVariants('ghost', 'sm')} w-full sm:w-auto`}
            >
              الشهر الحالي
            </Link>
            <Link
              href={{ pathname: '/app/api/calendar/ics', query: { from: fromDay, to: toDay } }}
              className={`${buttonVariants('outline', 'sm')} w-full sm:w-auto`}
            >
              تصدير ICS
            </Link>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Badge variant="default">إجمالي الشهر: {monthItems.length}</Badge>
          <Badge variant="danger">جلسات: {monthCounts.hearing}</Badge>
          <Badge variant="warning">اجتماعات: {monthCounts.meeting}</Badge>
          <Badge variant="success">مهام: {monthCounts.task}</Badge>
          <Badge variant="warning">فواتير: {monthCounts.invoice}</Badge>
        </div>

        <form className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_220px_220px_auto]">
          <label className="block">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">الشهر</span>
            <input
              name="month"
              type="month"
              defaultValue={monthKey}
              className="mt-1 h-11 w-full rounded-lg border border-brand-border bg-white px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">النوع</span>
            <select
              name="type"
              defaultValue={source}
              className="mt-1 h-11 w-full rounded-lg border border-brand-border bg-white px-3 outline-none ring-brand-emerald focus:ring-2 dark:border-slate-700 dark:bg-slate-950"
            >
              {sourceOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2 rounded-lg border border-brand-border bg-white px-3 py-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
            <input
              type="checkbox"
              name="mine"
              value="1"
              defaultChecked={mine}
              className="h-4 w-4 accent-brand-emerald"
            />
            قضاياي/مهامي فقط
          </label>

          <div className="flex items-end gap-2 sm:col-span-2 xl:col-span-1">
            <button type="submit" className={buttonVariants('outline', 'sm')}>
              تطبيق
            </button>
          </div>
        </form>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-brand-border pt-4 dark:border-slate-800">
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <Link
              href={{ pathname: '/app/calendar', query: { ...queryBase, month: prevMonth } }}
              className={`${buttonVariants('outline', 'sm')} flex-1 sm:flex-none`}
            >
              الشهر السابق
            </Link>
            <Link
              href={{ pathname: '/app/calendar', query: { ...queryBase, month: nextMonth } }}
              className={`${buttonVariants('outline', 'sm')} flex-1 sm:flex-none`}
            >
              الشهر التالي
            </Link>
          </div>
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{monthLabel}</p>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-brand-border bg-brand-background/60 p-3 text-xs dark:border-slate-800 dark:bg-slate-950/30">
          {(['hearing', 'meeting', 'task', 'invoice'] as const).map((kind) => (
            <div key={kind} className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
              <span className={`h-2.5 w-2.5 rounded-full ${kindDotClass(kind)}`} />
              {kindLabel(kind)}
            </div>
          ))}
        </div>

        <div className="mt-5 md:hidden">
          {mobileDayEntries.length ? (
            <ul className="space-y-2">
              {mobileDayEntries.map(([dateKey, dayItems]) => (
                <li
                  key={dateKey}
                  className={`rounded-lg border px-3 py-2 ${
                    dateKey === todayKey
                      ? 'border-brand-emerald bg-emerald-50/70 dark:border-emerald-700 dark:bg-emerald-950/20'
                      : 'border-brand-border bg-white dark:border-slate-700 dark:bg-slate-950'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                      {formatDateKeyLabel(dateKey)}
                    </p>
                    <span className="text-xs text-slate-500 dark:text-slate-400">{dayItems.length}</span>
                  </div>

                  <div className="mt-2 space-y-1.5">
                    {dayItems.slice(0, 4).map((item) => (
                      <Link
                        key={`${item.kind}-${item.href}-${item.date}`}
                        href={item.href}
                        className="flex items-start gap-1.5 rounded-md px-1 py-1 text-xs text-slate-700 hover:bg-brand-background dark:text-slate-200 dark:hover:bg-slate-900"
                        title={item.title}
                      >
                        <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${kindDotClass(item.kind)}`} />
                        <span className="truncate">{stripKindPrefix(item.title)}</span>
                      </Link>
                    ))}
                    {dayItems.length > 4 ? (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">+{dayItems.length - 4} أخرى</p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-lg border border-dashed border-brand-border px-3 py-4 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
              لا توجد عناصر في هذا الشهر.
            </p>
          )}
        </div>

        <div className="mt-5 hidden md:block">
          <div className="grid grid-cols-7 gap-2 text-xs text-slate-500 dark:text-slate-400">
            {dayLabels.map((label) => (
              <div key={label} className="text-center font-medium">
                {label}
              </div>
            ))}
          </div>

          <div className="mt-2 overflow-x-auto">
            <div className="grid min-w-[820px] grid-cols-7 gap-2">
              {monthCells.map((cell, idx) => {
                if (!cell) {
                  return (
                    <div key={`empty-${idx}`} className="h-32 rounded-lg border border-dashed border-brand-border/60 dark:border-slate-800" />
                  );
                }

                const dayItems = itemsByDay.get(cell.key) ?? [];
                const isToday = cell.key === todayKey;

                return (
                  <div
                    key={cell.key}
                    className={`h-32 overflow-hidden rounded-lg border p-2 ${
                      isToday
                        ? 'border-brand-emerald bg-emerald-50/70 dark:border-emerald-700 dark:bg-emerald-950/20'
                        : 'border-brand-border bg-brand-background/60 dark:border-slate-800 dark:bg-slate-950/30'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs font-semibold ${
                          isToday
                            ? 'bg-brand-emerald text-white'
                            : 'text-slate-700 dark:text-slate-200'
                        }`}
                      >
                        {cell.day}
                      </span>
                      {dayItems.length ? (
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">{dayItems.length}</span>
                      ) : null}
                    </div>

                    <div className="mt-2 space-y-1">
                      {dayItems.slice(0, 2).map((item) => (
                        <Link
                          key={`${item.kind}-${item.href}-${item.date}`}
                          href={item.href}
                          className="flex items-start gap-1.5 rounded-md px-1 py-0.5 text-[11px] text-slate-700 hover:bg-white dark:text-slate-200 dark:hover:bg-slate-900"
                          title={item.title}
                        >
                          <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${kindDotClass(item.kind)}`} />
                          <span className="truncate">{stripKindPrefix(item.title)}</span>
                        </Link>
                      ))}
                      {dayItems.length > 2 ? (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">+{dayItems.length - 2} أخرى</p>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-brand-navy dark:text-slate-100">القادم خلال 14 يوم</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              العناصر الأقرب زمنيًا مع وصول مباشر للتفاصيل.
            </p>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {formatDayLabel(upcomingStart)} - {formatDayLabel(upcomingEnd)}
          </p>
        </div>

        {upcomingItems.length ? (
          <ul className="mt-5 space-y-2.5">
            {upcomingItems.map((item) => (
              <li
                key={`${item.kind}-${item.href}-${item.date}`}
                className="rounded-lg border border-brand-border bg-white px-3 py-3 sm:px-4 dark:border-slate-700 dark:bg-slate-950"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={badgeVariant(item.kind)}>{kindLabel(item.kind)}</Badge>
                  <p className="text-xs text-slate-600 dark:text-slate-300">{formatDateTime(item.date)}</p>
                </div>
                <Link href={item.href} className="mt-2 block truncate font-semibold text-brand-navy hover:underline dark:text-slate-100">
                  {item.title}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-6">
            <EmptyState
              title="لا توجد عناصر قادمة"
              message="جرّب تغيير الشهر أو الفلاتر لإظهار المزيد."
              backHref="/app/calendar"
              backLabel="تحديث"
            />
          </div>
        )}
      </Card>
    </div>
  );
}

function isValidMonthKey(value: string) {
  return /^\d{4}-\d{2}$/.test(value);
}

function parseMonthKey(value: string) {
  const [yearRaw, monthRaw] = value.split('-');
  const year = Number(yearRaw);
  const monthIndex = Math.max(0, Math.min(11, Number(monthRaw) - 1));
  return { year: Number.isFinite(year) ? year : new Date().getUTCFullYear(), monthIndex };
}

async function loadCalendarTasks(params: {
  supabase: ReturnType<typeof createSupabaseServerRlsClient>;
  orgId: string;
  userId: string;
  mine: boolean;
  fetchStartIso: string;
  fetchEndIso: string;
}) {
  const run = (includeArchiveFilter: boolean) => {
    let query = params.supabase
      .from('tasks')
      .select('id, title, due_at, status, matter_id, assignee_id')
      .eq('org_id', params.orgId)
      .not('due_at', 'is', null)
      .gte('due_at', params.fetchStartIso)
      .lt('due_at', params.fetchEndIso);

    if (includeArchiveFilter) {
      query = query.eq('is_archived', false);
    }

    if (params.mine) {
      query = query.eq('assignee_id', params.userId);
    }

    return query.order('due_at', { ascending: true }).limit(800);
  };

  let result = await run(true);
  if (result.error && isMissingColumnError(result.error, 'tasks', 'is_archived')) {
    result = await run(false);
  }

  return result;
}

async function loadCalendarMatterEvents(params: {
  supabase: ReturnType<typeof createSupabaseServerRlsClient>;
  orgId: string;
  userId: string;
  mine: boolean;
  fetchStartIso: string;
  fetchEndIso: string;
  eventTypes: Array<'hearing' | 'meeting'>;
}) {
  const eventsResult = await params.supabase
    .from('matter_events')
    .select('id, type, event_date, matter_id')
    .eq('org_id', params.orgId)
    .in('type', params.eventTypes)
    .not('event_date', 'is', null)
    .gte('event_date', params.fetchStartIso)
    .lt('event_date', params.fetchEndIso)
    .order('event_date', { ascending: true })
    .limit(600);

  if (eventsResult.error) {
    return { data: [], matterById: new Map<string, { title: string; assigned_user_id?: string | null }>(), error: eventsResult.error };
  }

  const events = ((eventsResult.data as any[]) ?? []).filter((row) => row?.matter_id);
  const matterIds = Array.from(new Set(events.map((row) => String(row.matter_id))));
  const matterById = new Map<string, { title: string; assigned_user_id?: string | null }>();

  if (!matterIds.length) {
    return { data: events, matterById, error: null };
  }

  const loadMatters = async (withAssignedUserId: boolean) => {
    const select = withAssignedUserId ? 'id, title, assigned_user_id' : 'id, title';
    return params.supabase
      .from('matters')
      .select(select)
      .eq('org_id', params.orgId)
      .in('id', matterIds);
  };

  let mattersResult = await loadMatters(true);
  if (
    mattersResult.error &&
    isMissingColumnError(mattersResult.error, 'matters', 'assigned_user_id')
  ) {
    mattersResult = await loadMatters(false);
  }

  if (mattersResult.error) {
    return { data: [], matterById, error: mattersResult.error };
  }

  for (const matter of (mattersResult.data as any[]) ?? []) {
    const id = String(matter.id ?? '');
    if (!id) continue;
    matterById.set(id, {
      title: String(matter.title ?? 'قضية'),
      assigned_user_id: matter.assigned_user_id ? String(matter.assigned_user_id) : null,
    });
  }

  const filtered = params.mine
    ? events.filter((row) => {
      const matter = matterById.get(String(row.matter_id));
      return Boolean(matter?.assigned_user_id && matter.assigned_user_id === params.userId);
    })
    : events;

  return { data: filtered, matterById, error: null };
}

async function loadCalendarInvoices(params: {
  supabase: ReturnType<typeof createSupabaseServerRlsClient>;
  orgId: string;
  fetchStartIso: string;
  fetchEndIso: string;
}) {
  const run = (includeArchiveFilter: boolean) => {
    let query = params.supabase
      .from('invoices')
      .select('id, number, due_at, status')
      .eq('org_id', params.orgId)
      .not('due_at', 'is', null)
      .gte('due_at', params.fetchStartIso)
      .lt('due_at', params.fetchEndIso);

    if (includeArchiveFilter) {
      query = query.eq('is_archived', false);
    }

    return query.order('due_at', { ascending: true }).limit(800);
  };

  let result = await run(true);
  if (result.error && isMissingColumnError(result.error, 'invoices', 'is_archived')) {
    result = await run(false);
  }

  return result;
}

function formatMonthKey(value: Date) {
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function formatDateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

function buildMonthCells(monthStart: Date) {
  const year = monthStart.getUTCFullYear();
  const monthIndex = monthStart.getUTCMonth();
  const firstDay = monthStart.getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;

  return Array.from({ length: totalCells }, (_, idx) => {
    const day = idx - firstDay + 1;
    if (day < 1 || day > daysInMonth) return null;
    const date = new Date(Date.UTC(year, monthIndex, day, 0, 0, 0));
    return { day, key: formatDateKey(date) };
  });
}

function groupByDay(items: CalendarItem[]) {
  const map = new Map<string, CalendarItem[]>();

  items.forEach((item) => {
    const key = formatDateKey(new Date(item.date));
    const existing = map.get(key) ?? [];
    existing.push(item);
    map.set(key, existing);
  });

  return map;
}

function countItemsByKind(items: CalendarItem[]) {
  return items.reduce(
    (acc, item) => {
      acc[item.kind] += 1;
      return acc;
    },
    {
      hearing: 0,
      meeting: 0,
      task: 0,
      invoice: 0,
    } as Record<CalendarItem['kind'], number>,
  );
}

function badgeVariant(kind: CalendarItem['kind']) {
  if (kind === 'hearing') return 'danger' as const;
  if (kind === 'meeting') return 'warning' as const;
  if (kind === 'invoice') return 'warning' as const;
  return 'success' as const;
}

function kindDotClass(kind: CalendarItem['kind']) {
  if (kind === 'hearing') return 'bg-red-500';
  if (kind === 'meeting') return 'bg-amber-500';
  if (kind === 'invoice') return 'bg-orange-500';
  return 'bg-emerald-500';
}

function kindLabel(kind: CalendarItem['kind']) {
  if (kind === 'hearing') return 'جلسة';
  if (kind === 'meeting') return 'اجتماع';
  if (kind === 'invoice') return 'فاتورة';
  return 'مهمة';
}

function stripKindPrefix(value: string) {
  return value.replace(/^([^:]+:\s*)/, '');
}

function formatDateKeyLabel(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('ar-SA', { weekday: 'long', month: 'short', day: 'numeric' });
}

function formatLocalDateKey(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDayLabel(value: Date) {
  return value.toLocaleDateString('ar-SA');
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return `${date.toLocaleDateString('ar-SA')} ${date.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}`;
}

function toUserMessage(error: any) {
  const message = getErrorText(error);
  const normalized = message.toLowerCase();

  if (
    normalized.includes('permission denied') ||
    normalized.includes('violates row-level security') ||
    normalized.includes('not allowed')
  ) {
    return 'لا تملك صلاحية الوصول.';
  }

  if (
    isMissingColumnError(error, 'tasks', 'is_archived') ||
    isMissingColumnError(error, 'invoices', 'is_archived') ||
    isMissingRelationError(message)
  ) {
    return 'تعذر تحميل التقويم حاليًا بسبب عدم اكتمال ترقية قاعدة البيانات. حاول مرة أخرى بعد قليل.';
  }

  return 'تعذر تحميل التقويم. حاول مرة أخرى.';
}

function buildQuery(params: { type: CalendarSource; mine: boolean }) {
  const query: Record<string, string> = {};
  if (params.type !== 'all') query.type = params.type;
  if (params.mine) query.mine = '1';
  return query;
}
