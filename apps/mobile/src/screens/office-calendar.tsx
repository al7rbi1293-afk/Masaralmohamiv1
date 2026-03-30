import { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import {
  Card,
  EmptyState,
  HeroCard,
  LoadingBlock,
  Page,
  SectionTitle,
  SegmentedControl,
  StatCard,
  StatusChip,
} from '../components/ui';
import { useAuth } from '../context/auth-context';
import { fetchOfficeCalendar, type OfficeCalendarItem } from '../features/office/api';
import { formatDate } from '../lib/format';
import { styles } from './office.styles';
import {
  buildCalendarQuery,
  calendarGroupKey,
  calendarItemSortValue,
  calendarItemTimeLabel,
  calendarKindLabel,
  calendarRangeLabel,
  calendarTone,
  type CalendarRangePreset,
} from './office.utils';

function CalendarEntry({ item }: { item: OfficeCalendarItem }) {
  return (
    <View style={styles.calendarEntry}>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{item.title}</Text>
        <Text style={styles.rowMeta}>
          {[item.source_label, item.matter_title || 'بدون قضية', calendarItemTimeLabel(item)].join(' · ')}
        </Text>
        {item.note ? <Text style={styles.body}>{item.note}</Text> : null}
      </View>
      <View style={styles.rightMeta}>
        <StatusChip label={calendarKindLabel(item.kind)} tone={calendarTone(item.kind)} />
      </View>
    </View>
  );
}

export function OfficeCalendarScreen() {
  const { session } = useAuth();
  const isFocused = useIsFocused();
  const [items, setItems] = useState<OfficeCalendarItem[]>([]);
  const [range, setRange] = useState<{ from: string; to: string } | null>(null);
  const [rangePreset, setRangePreset] = useState<CalendarRangePreset>('30d');
  const [kind, setKind] = useState<'all' | OfficeCalendarItem['kind']>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!session?.token) return;

      setLoading(true);
      setError('');

      try {
        const payload = await fetchOfficeCalendar(session.token, buildCalendarQuery(rangePreset));
        if (mounted) {
          setItems(payload.items);
          setRange({ from: payload.from, to: payload.to });
        }
      } catch (nextError) {
        if (mounted) {
          setError(nextError instanceof Error ? nextError.message : 'تعذر تحميل التقويم.');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      mounted = false;
    };
  }, [isFocused, rangePreset, session?.token]);

  const filtered = useMemo(() => {
    const sorted = [...items].sort((a, b) => calendarItemSortValue(a) - calendarItemSortValue(b));
    return kind === 'all' ? sorted : sorted.filter((item) => item.kind === kind);
  }, [items, kind]);

  const grouped = useMemo(() => {
    const map = new Map<string, OfficeCalendarItem[]>();
    for (const item of filtered) {
      const key = calendarGroupKey(item);
      const bucket = map.get(key) ?? [];
      bucket.push(item);
      map.set(key, bucket);
    }

    return [...map.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([dateKey, groupItems]) => ({
        dateKey,
        items: groupItems,
      }));
  }, [filtered]);

  const counts = useMemo(() => {
    return {
      all: items.length,
      hearing: items.filter((item) => item.kind === 'hearing').length,
      meeting: items.filter((item) => item.kind === 'meeting').length,
      event: items.filter((item) => item.kind === 'event').length,
      task: items.filter((item) => item.kind === 'task').length,
      invoice: items.filter((item) => item.kind === 'invoice').length,
    };
  }, [items]);

  if (loading) {
    return (
      <Page>
        <LoadingBlock />
      </Page>
    );
  }

  return (
    <Page>
      <HeroCard
        eyebrow="التقويم"
        title="مواعيد المكتب"
        subtitle="تقويم فعلي داخل التطبيق مع نطاقات زمنية أوسع، وليس مجرد ملخص للأسبوع الحالي فقط."
        aside={<StatusChip label={range ? calendarRangeLabel(rangePreset) : 'التقويم'} tone="success" />}
      />

      <View style={styles.statsGrid}>
        <StatCard label="كل العناصر" value={String(counts.all)} />
        <StatCard label="الجلسات" value={String(counts.hearing)} tone="danger" />
        <StatCard label="الاجتماعات" value={String(counts.meeting)} tone="success" />
        <StatCard label="المهام" value={String(counts.task)} tone="warning" />
      </View>

      <Card>
        <SectionTitle title="النطاق الزمني" subtitle="بدّل بين الأسابيع والشهور حسب ما تريد مراجعته الآن." />
        <SegmentedControl
          value={rangePreset}
          onChange={(next) => setRangePreset(next as CalendarRangePreset)}
          options={[
            { key: '7d', label: '7 أيام' },
            { key: '14d', label: '14 يومًا' },
            { key: '30d', label: '30 يومًا' },
            { key: '90d', label: '90 يومًا' },
          ]}
        />
      </Card>

      <Card>
        <SectionTitle title="تصفية سريعة" subtitle="بدل التمرير الطويل، اختر نوع العنصر الذي تريد مراجعته." />
        <SegmentedControl
          value={kind}
          onChange={(next) => setKind(next as typeof kind)}
          options={[
            { key: 'all', label: 'الكل', count: counts.all },
            { key: 'hearing', label: 'الجلسات', count: counts.hearing },
            { key: 'meeting', label: 'الاجتماعات', count: counts.meeting },
            { key: 'event', label: 'الأحداث', count: counts.event },
            { key: 'task', label: 'المهام', count: counts.task },
            { key: 'invoice', label: 'الفواتير', count: counts.invoice },
          ]}
        />
      </Card>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Card>
        <SectionTitle title="العناصر القادمة" subtitle="مرتبة حسب اليوم لتسهيل القراءة السريعة على الهاتف." />
        {grouped.length ? (
          grouped.map((group) => (
            <View key={group.dateKey} style={styles.calendarDayCard}>
              <View style={styles.calendarDayHeader}>
                <Text style={styles.calendarDayTitle}>
                  {group.dateKey === 'unknown'
                    ? 'بدون موعد'
                    : formatDate(group.items[0]?.start_at || group.items[0]?.date || group.dateKey)}
                </Text>
                <StatusChip label={`${group.items.length} عناصر`} tone="default" />
              </View>
              <View style={styles.calendarDayList}>
                {group.items.map((item) => (
                  <CalendarEntry key={`${item.kind}-${item.id}`} item={item} />
                ))}
              </View>
            </View>
          ))
        ) : (
          <EmptyState title="لا توجد عناصر في هذا النطاق" message="جرّب تغيير نوع العرض أو انتظر مزيدًا من المواعيد القادمة." />
        )}
      </Card>
    </Page>
  );
}
