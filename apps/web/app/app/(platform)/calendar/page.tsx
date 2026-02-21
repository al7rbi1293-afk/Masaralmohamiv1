import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { requireOrgIdForUser } from '@/lib/org';
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
      <Card className="p-6">
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
    ? (() => {
      let query = supabase
        .from('matter_events')
        .select(
          mine
            ? 'id, type, event_date, matter_id, matters!inner(title, assigned_user_id)'
            : 'id, type, event_date, matter_id, matters(title, assigned_user_id)',
        )
        .eq('org_id', orgId)
        .in('type', eventTypes)
        .not('event_date', 'is', null)
        .gte('event_date', fetchStart.toISOString())
        .lt('event_date', fetchEnd.toISOString());

      if (mine) {
        query = query.eq('matters.assigned_user_id', user.id);
      }

      return query.order('event_date', { ascending: true }).limit(600);
    })()
    : Promise.resolve({ data: [], error: null } as any);

  const tasksPromise = includeTasks
    ? (() => {
      let query = supabase
        .from('tasks')
        .select('id, title, due_at, status, matter_id, assignee_id, matters(title)')
        .eq('org_id', orgId)
        .not('due_at', 'is', null)
        .gte('due_at', fetchStart.toISOString())
        .lt('due_at', fetchEnd.toISOString());

      if (mine) {
        query = query.eq('assignee_id', user.id);
      }

      return query.order('due_at', { ascending: true }).limit(800);
    })()
    : Promise.resolve({ data: [], error: null } as any);

  const invoicesPromise = includeInvoices
    ? supabase
      .from('invoices')
      .select('id, number, due_at, status')
      .eq('org_id', orgId)
      .not('due_at', 'is', null)
      .gte('due_at', fetchStart.toISOString())
      .lt('due_at', fetchEnd.toISOString())
      .order('due_at', { ascending: true })
      .limit(800)
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
    const matterTitle = row.matters?.title ? String(row.matters.title) : 'قضية';
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

  return (
    <div className="space-y-5">
      <Card className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-brand-navy dark:text-slate-100">التقويم</h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              عرض شهري سريع + قائمة قادمة خلال 14 يوم.
            </p>
          </div>
          <Link
            href={{ pathname: '/app/api/calendar/ics', query: { from: fromDay, to: toDay } }}
            className={buttonVariants('outline', 'sm')}
          >
            تصدير ICS
          </Link>
        </div>

        <form className="mt-5 grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-[1fr_220px_220px_auto]">
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

          <button type="submit" className={`${buttonVariants('outline', 'sm')} mt-6 lg:mt-8`}>
            تحديث
          </button>
        </form>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Link href={{ pathname: '/app/calendar', query: { ...queryBase, month: prevMonth } }} className={buttonVariants('outline', 'sm')}>
              الشهر السابق
            </Link>
            <Link href={{ pathname: '/app/calendar', query: { ...queryBase, month: nextMonth } }} className={buttonVariants('outline', 'sm')}>
              الشهر التالي
            </Link>
          </div>
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{monthLabel}</p>
        </div>

        <div className="mt-5 grid grid-cols-7 gap-2 text-xs text-slate-500 dark:text-slate-400">
          {dayLabels.map((label) => (
            <div key={label} className="text-center font-medium">
              {label}
            </div>
          ))}
        </div>

        <div className="mt-2 grid grid-cols-7 gap-2">
          {buildMonthCells(monthStart).map((cell, idx) => {
            if (!cell) {
              return <div key={`empty-${idx}`} className="h-28 rounded-lg border border-dashed border-brand-border/60 dark:border-slate-800" />;
            }

            const dayItems = itemsByDay.get(cell.key) ?? [];

            return (
              <div
                key={cell.key}
                className="h-28 overflow-hidden rounded-lg border border-brand-border bg-brand-background/60 p-2 dark:border-slate-800 dark:bg-slate-950/30"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{cell.day}</span>
                  {dayItems.length ? (
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">{dayItems.length}</span>
                  ) : null}
                </div>

                <div className="mt-2 space-y-1">
                  {dayItems.slice(0, 3).map((item) => (
                    <Link
                      key={`${item.kind}-${item.href}-${item.date}`}
                      href={item.href}
                      className="block truncate rounded-md px-1 py-0.5 text-[11px] text-slate-700 hover:bg-white dark:text-slate-200 dark:hover:bg-slate-900"
                      title={item.title}
                    >
                      <Badge className="me-1" variant={badgeVariant(item.kind)}>
                        {kindLabel(item.kind)}
                      </Badge>
                      {item.title.replace(/^([^:]+: )/, '')}
                    </Link>
                  ))}
                  {dayItems.length > 3 ? (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">+{dayItems.length - 3} أخرى</p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-brand-navy dark:text-slate-100">القادم خلال 14 يوم</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              عناصر استحقاق وجلسات قابلة للوصول حسب صلاحيات المكتب.
            </p>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {formatDayLabel(upcomingStart)} - {formatDayLabel(upcomingEnd)}
          </p>
        </div>

        {upcomingItems.length ? (
          <ul className="mt-5 space-y-3">
            {upcomingItems.map((item) => (
              <li
                key={`${item.kind}-${item.href}-${item.date}`}
                className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-brand-border bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-950"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={badgeVariant(item.kind)}>{kindLabel(item.kind)}</Badge>
                    <Link href={item.href} className="truncate font-semibold text-brand-navy hover:underline dark:text-slate-100">
                      {item.title}
                    </Link>
                  </div>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    {formatDateTime(item.date)}
                  </p>
                </div>
                <Link href={item.href} className={buttonVariants('outline', 'sm')}>
                  فتح
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

function badgeVariant(kind: CalendarItem['kind']) {
  if (kind === 'hearing') return 'danger' as const;
  if (kind === 'meeting') return 'warning' as const;
  if (kind === 'invoice') return 'warning' as const;
  return 'success' as const;
}

function kindLabel(kind: CalendarItem['kind']) {
  if (kind === 'hearing') return 'جلسة';
  if (kind === 'meeting') return 'اجتماع';
  if (kind === 'invoice') return 'فاتورة';
  return 'مهمة';
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
  const message = error instanceof Error ? error.message : '';
  const normalized = message.toLowerCase();

  if (
    normalized.includes('permission denied') ||
    normalized.includes('violates row-level security') ||
    normalized.includes('not allowed')
  ) {
    return 'لا تملك صلاحية الوصول.';
  }

  return message || 'تعذر تحميل التقويم. حاول مرة أخرى.';
}

function buildQuery(params: { type: CalendarSource; mine: boolean }) {
  const query: Record<string, string> = {};
  if (params.type !== 'all') query.type = params.type;
  if (params.mine) query.mine = '1';
  return query;
}
