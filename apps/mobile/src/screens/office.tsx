import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as DocumentPicker from 'expo-document-picker';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import {
  SegmentedControl,
  Card,
  EmptyState,
  Field,
  HeroCard,
  LoadingBlock,
  Page,
  SectionTitle,
  PrimaryButton,
  StatCard,
  StatusChip,
} from '../components/ui';
import { useAuth } from '../context/auth-context';
import {
  addOfficeDocumentVersion,
  archiveOfficeDocument,
  archiveOfficeInvoice,
  archiveOfficeTask,
  buildOfficeInvoicePdfUrl,
  buildOfficeQuotePdfUrl,
  createOfficeClient,
  createOfficeInvoice,
  createOfficeMatter,
  createOfficeQuote,
  createOfficeTask,
  deleteOfficeClient,
  deleteOfficeMatter,
  deleteOfficeTask,
  fetchOfficeBilling,
  fetchOfficeCalendar,
  fetchOfficeClients,
  fetchOfficeDocuments,
  fetchOfficeInvoiceDetails,
  fetchOfficeNotifications,
  fetchOfficeOverview,
  fetchOfficeQuoteDetails,
  fetchOfficeTasks,
  requestOfficeDocumentDownloadUrl,
  sendOfficeInvoiceEmail,
  setOfficeTaskStatus,
  updateOfficeClient,
  updateOfficeMatter,
  updateOfficeTask,
  uploadOfficeDocumentFile,
  type OfficeBillingItem,
  type OfficeBillingResponse,
  type OfficeCalendarItem,
  type OfficeClient,
  type OfficeClientWritePayload,
  type OfficeDocument,
  type OfficeDocumentWritePayload,
  type OfficeInvoiceDetails,
  type OfficeInvoiceWritePayload,
  type OfficeMatterWritePayload,
  type OfficeNotification,
  type OfficeOverviewResponse,
  type OfficeQuoteDetails,
  type OfficeQuoteWritePayload,
  type OfficeTask,
  type OfficeTaskWritePayload,
} from '../features/office/api';
import {
  exportRemoteFileToDevice,
  openRemoteFileInApp,
  shareRemoteFileFromDevice,
} from '../lib/file-actions';
import {
  fetchOfficeMatterDetails,
  fetchOfficeMatters,
  requestSignedInAccountDeletion,
  type MatterDetails,
  type MatterSummary,
} from '../lib/api';
import { formatCurrency, formatDate, formatDateTime } from '../lib/format';
import { openPrivacyPolicy, openSupportPage, openTermsOfService } from '../lib/legal-links';
import { colors, fonts, radius, spacing } from '../theme';

export type OfficeStackParamList = {
  OfficeTabs: undefined;
  OfficeMatterDetails: { matterId: string; title: string };
  OfficeClientForm: { mode: 'create' | 'edit'; client?: Partial<OfficeClientWritePayload> & { id?: string } };
  OfficeMatterForm: { mode: 'create' | 'edit'; matter?: Partial<OfficeMatterWritePayload> & { id?: string } };
  OfficeTaskForm: { mode: 'create' | 'edit'; task?: Partial<OfficeTaskWritePayload> & { id?: string } };
  OfficeDocumentForm: { mode: 'create'; draft?: Partial<OfficeDocumentWritePayload> };
  OfficeSettingsHome: undefined;
  OfficeIdentitySettings: undefined;
  OfficeTeamSettings: undefined;
  OfficeSubscriptionSettings: undefined;
  OfficeBillingForm: {
    mode: 'quote' | 'invoice';
    draft?: {
      client_id?: string | null;
      matter_id?: string | null;
      items?: OfficeBillingItem[];
    };
  };
  OfficeSettings: { section?: 'identity' | 'team' | 'subscription' } | undefined;
};

type OfficeMatterDetailsProps = NativeStackScreenProps<OfficeStackParamList, 'OfficeMatterDetails'>;

function matterTone(status: string) {
  if (status === 'in_progress' || status === 'doing') return 'success' as const;
  if (status === 'on_hold') return 'warning' as const;
  if (status === 'archived' || status === 'canceled') return 'danger' as const;
  return 'default' as const;
}

function taskTone(task: OfficeTask) {
  if (task.status === 'done') return 'success' as const;
  if (task.is_overdue) return 'danger' as const;
  if (task.priority === 'high') return 'warning' as const;
  return 'default' as const;
}

function billingTone(status: string) {
  if (status === 'paid' || status === 'accepted') return 'success' as const;
  if (status === 'partial' || status === 'sent' || status === 'draft') return 'warning' as const;
  if (status === 'void' || status === 'rejected') return 'danger' as const;
  return 'gold' as const;
}

function notificationTone(category: string | null) {
  if (category === 'warning' || category === 'invoice_overdue') return 'warning' as const;
  if (category === 'danger' || category === 'error') return 'danger' as const;
  if (category === 'success') return 'success' as const;
  return 'gold' as const;
}

function calendarTone(kind: OfficeCalendarItem['kind']) {
  if (kind === 'task') return 'warning' as const;
  if (kind === 'invoice') return 'gold' as const;
  if (kind === 'hearing') return 'danger' as const;
  return 'success' as const;
}

function calendarKindLabel(kind: OfficeCalendarItem['kind']) {
  switch (kind) {
    case 'hearing':
      return 'جلسة';
    case 'meeting':
      return 'اجتماع';
    case 'task':
      return 'مهمة';
    case 'invoice':
      return 'فاتورة';
    default:
      return 'حدث';
  }
}

function calendarItemSortValue(item: OfficeCalendarItem) {
  const raw = item.start_at || item.date || '';
  const timestamp = Date.parse(raw);
  return Number.isNaN(timestamp) ? Number.MAX_SAFE_INTEGER : timestamp;
}

function calendarGroupKey(item: OfficeCalendarItem) {
  return (item.start_at || item.date || 'unknown').slice(0, 10);
}

function calendarItemTimeLabel(item: OfficeCalendarItem) {
  const primary = item.start_at || item.date;
  if (!primary) return 'بدون موعد';
  if (item.end_at && item.end_at !== primary) {
    return `${formatDateTime(primary)} - ${formatDateTime(item.end_at)}`;
  }
  return formatDateTime(primary);
}

type CalendarRangePreset = '7d' | '14d' | '30d' | '90d';

function calendarRangeLabel(range: CalendarRangePreset) {
  switch (range) {
    case '7d':
      return '7 أيام';
    case '30d':
      return '30 يومًا';
    case '90d':
      return '90 يومًا';
    default:
      return '14 يومًا';
  }
}

function buildCalendarQuery(range: CalendarRangePreset) {
  const from = new Date();
  const to = new Date(from.getTime());
  const rangeDays = range === '7d' ? 7 : range === '30d' ? 30 : range === '90d' ? 90 : 14;
  to.setDate(to.getDate() + rangeDays);
  return {
    from: from.toISOString(),
    to: to.toISOString(),
  };
}

function officeRoleLabel(role: string | null) {
  switch (role) {
    case 'owner':
      return 'مالك المكتب';
    case 'admin':
      return 'إدارة المكتب';
    case 'lawyer':
      return 'محام';
    case 'assistant':
      return 'مساعد';
    default:
      return role || 'عضو فريق';
  }
}

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

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaItem}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

function SummaryRow({
  title,
  subtitle,
  status,
  tone = 'default',
}: {
  title: string;
  subtitle: string;
  status?: string;
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'gold';
}) {
  return (
    <View style={styles.rowCard}>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowMeta}>{subtitle}</Text>
      </View>
      {status ? <StatusChip label={status} tone={tone} /> : null}
    </View>
  );
}

function LedgerPill({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'gold';
}) {
  return (
    <View style={styles.pillCard}>
      <Text style={styles.pillLabel}>{label}</Text>
      <StatusChip label={value} tone={tone} />
    </View>
  );
}

export function OfficeHomeScreen() {
  const { session } = useAuth();
  const navigation = useNavigation<any>();
  const isFocused = useIsFocused();
  const [data, setData] = useState<OfficeOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!session?.token) return;

      setLoading(true);
      setError('');

      try {
        const payload = await fetchOfficeOverview(session.token);
        if (mounted) {
          setData(payload);
        }
      } catch (nextError) {
        if (mounted) {
          setError(nextError instanceof Error ? nextError.message : 'تعذر تحميل لوحة المكتب.');
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
  }, [isFocused, session?.token]);

  if (loading) {
    return (
      <Page>
        <LoadingBlock />
      </Page>
    );
  }

  if (!data) {
    return (
      <Page>
        <EmptyState title="تعذر تحميل اللوحة" message={error || 'لا توجد بيانات متاحة حاليًا.'} />
      </Page>
    );
  }

  return (
    <Page>
      <HeroCard
        eyebrow={data.org?.name || 'منصة العمليات'}
        title={`أهلاً ${data.user.full_name || data.user.email}`}
        subtitle="نظرة سريعة على العمل اليومي. التقويم والتنبيهات الآن في تبويباتهما المخصصة."
        aside={<StatusChip label={officeRoleLabel(data.role.name)} tone="gold" />}
      />

      <Card>
        <SectionTitle title="بدء سريع" subtitle="اذهب مباشرة إلى أهم إجراءات المكتب." />
        <View style={styles.quickActionsGrid}>
          <Pressable style={styles.actionTile} onPress={() => navigation.navigate('OfficeClientForm', { mode: 'create' })}>
            <Text style={styles.actionTileTitle}>عميل جديد</Text>
            <Text style={styles.actionTileMeta}>إنشاء ملف عميل</Text>
          </Pressable>
          <Pressable style={styles.actionTile} onPress={() => navigation.navigate('OfficeMatterForm', { mode: 'create' })}>
            <Text style={styles.actionTileTitle}>قضية جديدة</Text>
            <Text style={styles.actionTileMeta}>ربطها بعميل</Text>
          </Pressable>
          <Pressable style={styles.actionTile} onPress={() => navigation.navigate('OfficeTaskForm', { mode: 'create' })}>
            <Text style={styles.actionTileTitle}>مهمة جديدة</Text>
            <Text style={styles.actionTileMeta}>واجب متابعة</Text>
          </Pressable>
          <Pressable style={styles.actionTile} onPress={() => navigation.navigate('OfficeDocumentForm', { mode: 'create' })}>
            <Text style={styles.actionTileTitle}>مستند جديد</Text>
            <Text style={styles.actionTileMeta}>رفع أو تسجيل نسخة</Text>
          </Pressable>
          <Pressable style={styles.actionTile} onPress={() => navigation.navigate('OfficeBillingForm', { mode: 'quote' })}>
            <Text style={styles.actionTileTitle}>عرض سعر</Text>
            <Text style={styles.actionTileMeta}>نموذج جاهز</Text>
          </Pressable>
          <Pressable style={styles.actionTile} onPress={() => navigation.navigate('OfficeBillingForm', { mode: 'invoice' })}>
            <Text style={styles.actionTileTitle}>فاتورة</Text>
            <Text style={styles.actionTileMeta}>إصدار جديد</Text>
          </Pressable>
        </View>
      </Card>

      <View style={styles.statsGrid}>
        <StatCard label="العملاء" value={String(data.counts.clients)} />
        <StatCard label="القضايا المفتوحة" value={String(data.counts.open_matters)} tone="success" />
        <StatCard label="المهام المفتوحة" value={String(data.counts.open_tasks)} />
        <StatCard label="الفواتير غير المسددة" value={String(data.counts.unpaid_invoices)} tone="gold" />
      </View>

      <View style={styles.summaryStrip}>
        <LedgerPill label="المستندات" value={String(data.counts.documents)} />
        <LedgerPill label="العروض" value={String(data.counts.quotes)} tone="gold" />
        <LedgerPill label="القادم هذا الأسبوع" value={String(data.counts.upcoming_items)} tone="warning" />
        <LedgerPill label="الإشعارات" value={String(data.counts.notifications)} tone="success" />
      </View>

      <Card>
        <SectionTitle title="أولويات اليوم" subtitle="أقرب عناصر العمل التي تحتاج متابعة سريعة." />
        {data.highlights.tasks.length ? (
          data.highlights.tasks.slice(0, 4).map((task) => (
            <SummaryRow
              key={task.id}
              title={task.title}
              subtitle={[
                task.matter_title || 'غير مرتبطة بقضية',
                task.due_at ? `الاستحقاق ${formatDate(task.due_at)}` : 'بدون تاريخ استحقاق',
              ].join(' · ')}
              status={task.is_overdue ? 'متأخرة' : task.status}
              tone={taskTone(task)}
            />
          ))
        ) : (
          <EmptyState title="لا توجد مهام حالية" message="ستظهر هنا أقرب المهام المستحقة من النظام نفسه." />
        )}
      </Card>

      <Card>
        <SectionTitle title="الملفات والفوترة" subtitle="ملخص سريع لآخر المستندات والفواتير على المكتب." />
        {data.highlights.documents.slice(0, 2).map((document) => (
          <SummaryRow
            key={document.id}
            title={document.title}
            subtitle={[
              document.client_name || 'بدون عميل',
              document.latest_version?.file_name || 'بدون نسخة',
            ].join(' · ')}
            status={document.folder || 'مستند'}
            tone="default"
          />
        ))}
        {data.highlights.invoices.slice(0, 2).map((invoice) => (
          <SummaryRow
            key={invoice.id}
            title={`فاتورة ${invoice.number}`}
            subtitle={[
              invoice.client_name || 'بدون عميل',
              formatCurrency(invoice.total, invoice.currency),
            ].join(' · ')}
            status={invoice.status}
            tone={billingTone(invoice.status)}
          />
        ))}
        {!data.highlights.documents.length && !data.highlights.invoices.length ? (
          <EmptyState title="لا توجد حركة حديثة" message="ستظهر هنا آخر المستندات والفواتير حال توفرها." />
        ) : null}
      </Card>
    </Page>
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
                  {group.dateKey === 'unknown' ? 'بدون موعد' : formatDate(group.items[0]?.start_at || group.items[0]?.date || group.dateKey)}
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

export function OfficeClientsScreen({ navigation }: { navigation: any }) {
  const { session } = useAuth();
  const isFocused = useIsFocused();
  const [items, setItems] = useState<OfficeClient[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!session?.token) return;

      setLoading(true);
      setError('');
      try {
        const payload = await fetchOfficeClients(session.token, { page: 1, limit: 50, status: 'all' });
        if (mounted) {
          setItems(payload.data);
        }
      } catch (nextError) {
        if (mounted) {
          setError(nextError instanceof Error ? nextError.message : 'تعذر تحميل العملاء.');
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
  }, [isFocused, session?.token]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return items;

    return items.filter((item) =>
      `${item.name} ${item.email || ''} ${item.phone || ''} ${item.identity_no || ''} ${item.commercial_no || ''}`
        .toLowerCase()
        .includes(normalized),
    );
  }, [items, query]);

  return (
    <Page scroll={false}>
      <View style={styles.container}>
        <Card>
          <SectionTitle title="إدارة العملاء" subtitle="إنشاء وتعديل ملفات الموكلين من نفس التطبيق." />
          <View style={styles.quickActionsGrid}>
            <Pressable style={styles.actionTile} onPress={() => navigation.navigate('OfficeClientForm', { mode: 'create' })}>
              <Text style={styles.actionTileTitle}>عميل جديد</Text>
              <Text style={styles.actionTileMeta}>ملف موكل جديد</Text>
            </Pressable>
            <Pressable style={styles.actionTile} onPress={() => navigation.navigate('OfficeMatterForm', { mode: 'create' })}>
              <Text style={styles.actionTileTitle}>قضية جديدة</Text>
              <Text style={styles.actionTileMeta}>ابدأها من العميل</Text>
            </Pressable>
          </View>
        </Card>

        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="ابحث باسم العميل أو بريده أو جواله أو رقم الهوية"
          placeholderTextColor={colors.textMuted}
          style={styles.search}
          textAlign="right"
        />

        {loading ? <LoadingBlock /> : null}
        {!loading && error ? <Text style={styles.error}>{error}</Text> : null}
        {!loading && !filtered.length ? (
          <EmptyState title="لا يوجد عملاء" message="ابدأ بإضافة عميل جديد أو عدّل كلمات البحث." />
        ) : null}

        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable
              onPress={() =>
                navigation.navigate('OfficeClientForm', {
                  mode: 'edit',
                  client: {
                    id: item.id,
                    type: item.type,
                    name: item.name,
                    email: item.email || '',
                    phone: item.phone || '',
                    identity_no: item.identity_no || '',
                    commercial_no: item.commercial_no || '',
                    agency_number: item.agency_number || '',
                    address: item.address || '',
                    notes: item.notes || '',
                  },
                })
              }
              style={styles.listItem}
            >
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{item.name}</Text>
                <Text style={styles.rowMeta}>
                  {[
                    item.type === 'company' ? 'شركة' : 'فرد',
                    item.email || 'بدون بريد',
                    item.phone || 'بدون جوال',
                  ].join(' · ')}
                </Text>
              </View>
              <View style={styles.rightMeta}>
                <StatusChip label={item.status === 'archived' ? 'مؤرشف' : 'نشط'} tone={item.status === 'archived' ? 'warning' : 'success'} />
              </View>
            </Pressable>
          )}
        />
      </View>
    </Page>
  );
}

export function OfficeMattersScreen({ navigation }: { navigation: any }) {
  const { session } = useAuth();
  const isFocused = useIsFocused();
  const [items, setItems] = useState<MatterSummary[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!session?.token) return;

      setLoading(true);
      setError('');
      try {
        const payload = await fetchOfficeMatters(session.token);
        if (mounted) {
          setItems(payload.data);
        }
      } catch (nextError) {
        if (mounted) {
          setError(nextError instanceof Error ? nextError.message : 'تعذر تحميل القضايا.');
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
  }, [isFocused, session?.token]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return items;

    return items.filter((item) =>
      `${item.title} ${item.client?.name || ''} ${item.case_type || ''} ${item.najiz_case_number || ''}`
        .toLowerCase()
        .includes(normalized),
    );
  }, [items, query]);

  return (
    <Page scroll={false}>
      <View style={styles.container}>
        <Card>
          <SectionTitle title="أوامر سريعة" subtitle="ابدأ من هنا إذا كنت تريد إضافة أو تعديلًا سريعًا." />
          <View style={styles.quickActionsGrid}>
            <Pressable style={styles.actionTile} onPress={() => navigation.navigate('OfficeMatterForm', { mode: 'create' })}>
              <Text style={styles.actionTileTitle}>قضية جديدة</Text>
              <Text style={styles.actionTileMeta}>إضافة ملف</Text>
            </Pressable>
            <Pressable style={styles.actionTile} onPress={() => navigation.navigate('OfficeTaskForm', { mode: 'create' })}>
              <Text style={styles.actionTileTitle}>مهمة جديدة</Text>
              <Text style={styles.actionTileMeta}>متابعة ملف</Text>
            </Pressable>
            <Pressable style={styles.actionTile} onPress={() => navigation.navigate('OfficeDocumentForm', { mode: 'create' })}>
              <Text style={styles.actionTileTitle}>مستند جديد</Text>
              <Text style={styles.actionTileMeta}>رفع ورقة</Text>
            </Pressable>
          </View>
        </Card>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="ابحث في القضايا أو أسماء الموكلين أو رقم ناجز"
          placeholderTextColor={colors.textMuted}
          style={styles.search}
          textAlign="right"
        />

        {loading ? <LoadingBlock /> : null}
        {!loading && error ? <Text style={styles.error}>{error}</Text> : null}
        {!loading && !filtered.length ? (
          <EmptyState title="لا توجد نتائج" message="جرّب تغيير كلمات البحث أو ابدأ بإضافة قضية جديدة من التطبيق." />
        ) : null}

        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => navigation.navigate('OfficeMatterDetails', { matterId: item.id, title: item.title })}
              style={styles.listItem}
            >
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{item.title}</Text>
                <Text style={styles.rowMeta}>
                  {[
                    item.client?.name || 'بدون موكل',
                    item.case_type || 'قضية عامة',
                    item.updated_at ? `آخر تحديث ${formatDate(item.updated_at)}` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </View>
              <View style={styles.rightMeta}>
                {item.is_private ? <StatusChip label="خاص" tone="gold" /> : null}
                <StatusChip label={item.status} tone={matterTone(item.status)} />
              </View>
            </Pressable>
          )}
        />
      </View>
    </Page>
  );
}

export function OfficeMatterDetailsScreen({ route }: OfficeMatterDetailsProps) {
  const { session } = useAuth();
  const navigation = useNavigation<any>();
  const [data, setData] = useState<MatterDetails | null>(null);
  const [section, setSection] = useState<'summary' | 'tasks' | 'documents' | 'timeline' | 'communications'>('summary');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function resolveMatterDocument(document: MatterDetails['documents'][number]) {
    if (!session?.token || !document.latest_version?.storage_path) {
      throw new Error('لا توجد نسخة قابلة للعرض لهذا المستند.');
    }

    const result = await requestOfficeDocumentDownloadUrl(
      { token: session.token, orgId: session.orgId },
      {
        document_id: document.id,
        storage_path: document.latest_version.storage_path,
      },
    );

    return {
      url: result.signedDownloadUrl,
      fileName: document.latest_version.file_name || `${document.title}.pdf`,
      mimeType: document.latest_version.mime_type,
    };
  }

  async function openMatterDocument(document: MatterDetails['documents'][number]) {
    const remote = await resolveMatterDocument(document);
    await openRemoteFileInApp(remote);
  }

  async function downloadMatterDocument(document: MatterDetails['documents'][number]) {
    const remote = await resolveMatterDocument(document);
    await exportRemoteFileToDevice(remote);
  }

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!session?.token) return;

      setLoading(true);
      setError('');

      try {
        const payload = await fetchOfficeMatterDetails(session.token, route.params.matterId);
        if (mounted) {
          setData(payload.data);
        }
      } catch (nextError) {
        if (mounted) {
          setError(nextError instanceof Error ? nextError.message : 'تعذر تحميل تفاصيل القضية.');
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
  }, [route.params.matterId, session?.token]);

  if (loading) {
    return (
      <Page>
        <LoadingBlock />
      </Page>
    );
  }

  if (!data) {
    return (
      <Page>
        <EmptyState title="تعذر تحميل القضية" message={error || 'قد لا تملك صلاحية الوصول إلى هذه القضية.'} />
      </Page>
    );
  }

  return (
    <Page>
      <HeroCard
        eyebrow={data.client?.name || 'ملف قانوني'}
        title={data.title}
        subtitle={data.summary || 'لا يوجد ملخص مسجل حتى الآن.'}
        aside={<StatusChip label={data.status} tone={matterTone(data.status)} />}
      />

      <Card>
        <SectionTitle title="إجراءات الملف" subtitle="التعديلات السريعة على القضية من داخل الموبايل." />
        <View style={styles.quickActionsGrid}>
          <Pressable
            style={styles.actionTile}
            onPress={() =>
              navigation.navigate('OfficeMatterForm', {
                mode: 'edit',
                matter: {
                  id: data.id,
                  client_id: data.client_id,
                  title: data.title,
                  status: data.status,
                  summary: data.summary,
                  najiz_case_number: data.najiz_case_number,
                  case_type: data.case_type,
                  claims: data.claims,
                  is_private: data.is_private,
                },
              })
            }
          >
            <Text style={styles.actionTileTitle}>تعديل القضية</Text>
            <Text style={styles.actionTileMeta}>تحديث البيانات</Text>
          </Pressable>
          <Pressable style={styles.actionTile} onPress={() => navigation.navigate('OfficeTaskForm', { mode: 'create', task: { matter_id: data.id } })}>
            <Text style={styles.actionTileTitle}>مهمة جديدة</Text>
            <Text style={styles.actionTileMeta}>مرتبطة بالقضية</Text>
          </Pressable>
          <Pressable
            style={styles.actionTile}
            onPress={() => navigation.navigate('OfficeDocumentForm', { mode: 'create', draft: { matter_id: data.id, client_id: data.client_id || undefined, title: `${data.title} - مستند` } })}
          >
            <Text style={styles.actionTileTitle}>مستند جديد</Text>
            <Text style={styles.actionTileMeta}>رفع ملف</Text>
          </Pressable>
          {data.client ? (
            <Pressable
              style={styles.actionTile}
              onPress={() =>
                navigation.navigate('OfficeClientForm', {
                  mode: 'edit',
                  client: {
                    id: data.client?.id,
                    name: data.client?.name,
                    email: data.client?.email,
                    phone: data.client?.phone,
                  },
                })
              }
            >
              <Text style={styles.actionTileTitle}>تعديل العميل</Text>
              <Text style={styles.actionTileMeta}>ملف الموكل</Text>
            </Pressable>
          ) : null}
        </View>
      </Card>

      <Card>
        <SectionTitle title="أقسام الملف" subtitle="بدل صفحة طويلة، انتقل مباشرة إلى القسم الذي تريد مراجعته." />
        <SegmentedControl
          value={section}
          onChange={(next) => setSection(next as typeof section)}
          options={[
            { key: 'summary', label: 'الملخص' },
            { key: 'tasks', label: 'المهام', count: data.tasks.length },
            { key: 'documents', label: 'المستندات', count: data.documents.length },
            { key: 'timeline', label: 'التسلسل', count: data.events.length },
            { key: 'communications', label: 'المراسلات', count: data.communications.length },
          ]}
        />
      </Card>

      {section === 'summary' ? (
        <Card>
          <SectionTitle title="معلومات أساسية" subtitle="نظرة سريعة على حالة الملف قبل الدخول للتفاصيل." />
          <View style={styles.statsGrid}>
            <StatCard label="المهام" value={String(data.tasks.length)} tone="warning" />
            <StatCard label="المستندات" value={String(data.documents.length)} tone="gold" />
            <StatCard label="الأحداث" value={String(data.events.length)} tone="success" />
            <StatCard label="المراسلات" value={String(data.communications.length)} />
          </View>
          <View style={styles.metaGrid}>
            <Meta label="نوع القضية" value={data.case_type || '—'} />
            <Meta label="رقم ناجز" value={data.najiz_case_number || '—'} />
            <Meta label="تاريخ الإنشاء" value={formatDate(data.created_at)} />
            <Meta label="آخر تحديث" value={formatDateTime(data.updated_at)} />
          </View>
          {data.claims ? (
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>الطلبات</Text>
              <Text style={styles.body}>{data.claims}</Text>
            </View>
          ) : null}
        </Card>
      ) : null}

      {section === 'tasks' ? (
        <Card>
          <SectionTitle title="المهام المرتبطة" subtitle="حالة التنفيذ الحالية على هذا الملف." />
          {data.tasks.length ? (
            data.tasks.map((task) => (
              <SummaryRow
                key={task.id}
                title={task.title}
                subtitle={[
                  task.priority || 'بدون أولوية',
                  task.due_at ? `الاستحقاق ${formatDate(task.due_at)}` : 'بدون تاريخ',
                ].join(' · ')}
                status={task.status}
                tone={task.status === 'done' ? 'success' : task.priority === 'high' ? 'warning' : 'default'}
              />
            ))
          ) : (
            <EmptyState title="لا توجد مهام" message="لا توجد مهام مرتبطة بهذه القضية حاليًا." />
          )}
        </Card>
      ) : null}

      {section === 'documents' ? (
        <Card>
          <SectionTitle title="المستندات" subtitle="آخر النسخ المرفوعة أو المعتمدة في الملف." />
          {data.documents.length ? (
            data.documents.map((document) => (
              <View key={document.id} style={styles.controlRow}>
                <View style={styles.controlRowMain}>
                  <View style={styles.rowText}>
                    <Text style={styles.rowTitle}>{document.title}</Text>
                    <Text style={styles.rowMeta}>
                      {[
                        document.latest_version?.file_name || 'بدون نسخة',
                        document.latest_version?.created_at
                          ? formatDate(document.latest_version.created_at)
                          : formatDate(document.created_at),
                      ].join(' · ')}
                    </Text>
                  </View>
                  <StatusChip
                    label={document.latest_version ? `v${document.latest_version.version_no}` : 'بدون نسخة'}
                    tone="gold"
                  />
                </View>
                <View style={styles.inlineActionRow}>
                  <Pressable
                    style={styles.inlineAction}
                    onPress={async () => {
                      try {
                        await openMatterDocument(document);
                      } catch (nextError) {
                        setError(nextError instanceof Error ? nextError.message : 'تعذر فتح المستند.');
                      }
                    }}
                  >
                    <Text style={styles.inlineActionText}>عرض</Text>
                  </Pressable>
                  <Pressable
                    style={styles.inlineAction}
                    onPress={async () => {
                      try {
                        await downloadMatterDocument(document);
                        setError('');
                      } catch (nextError) {
                        setError(nextError instanceof Error ? nextError.message : 'تعذر تنزيل المستند.');
                      }
                    }}
                  >
                    <Text style={styles.inlineActionText}>تحميل</Text>
                  </Pressable>
                </View>
              </View>
            ))
          ) : (
            <EmptyState title="لا توجد مستندات" message="سيظهر هنا كل مستند مرتبط بهذه القضية." />
          )}
        </Card>
      ) : null}

      {section === 'timeline' ? (
        <Card>
          <SectionTitle title="الخط الزمني" subtitle="آخر الأحداث والتحديثات على الملف." />
          {data.events.length ? (
            data.events.map((item) => (
              <View key={item.id} style={styles.timelineItem}>
                <View style={styles.timelineDot} />
                <View style={styles.timelineText}>
                  <Text style={styles.rowTitle}>{item.type}</Text>
                  <Text style={styles.rowMeta}>
                    {[formatDateTime(item.created_at), item.created_by_name || '—'].join(' · ')}
                  </Text>
                  {item.note ? <Text style={styles.body}>{item.note}</Text> : null}
                </View>
              </View>
            ))
          ) : (
            <EmptyState title="لا توجد أحداث" message="لم يتم تسجيل أي أحداث على هذه القضية بعد." />
          )}
        </Card>
      ) : null}

      {section === 'communications' ? (
        <Card>
          <SectionTitle title="التواصل" subtitle="آخر الرسائل والمراسلات المسجلة." />
          {data.communications.length ? (
            data.communications.map((item) => (
              <SummaryRow
                key={item.id}
                title={item.sender === 'CLIENT' ? 'العميل' : 'الفريق'}
                subtitle={[item.message, formatDateTime(item.created_at)].join(' · ')}
                status={item.sender}
                tone={item.sender === 'CLIENT' ? 'gold' : 'success'}
              />
            ))
          ) : (
            <EmptyState title="لا توجد مراسلات" message="لم يتم تسجيل مراسلات أساسية على هذا الملف بعد." />
          )}
        </Card>
      ) : null}
    </Page>
  );
}

export function OfficeMoreScreen() {
  const { session, signOut, switchPortal } = useAuth();
  const navigation = useNavigation<any>();
  const isFocused = useIsFocused();
  const [tasks, setTasks] = useState<OfficeTask[]>([]);
  const [documents, setDocuments] = useState<OfficeDocument[]>([]);
  const [billing, setBilling] = useState<OfficeBillingResponse | null>(null);
  const [notifications, setNotifications] = useState<OfficeNotification[]>([]);
  const [section, setSection] = useState<'tasks' | 'documents' | 'billing' | 'activity'>('tasks');
  const [billingPreview, setBillingPreview] = useState<
    | { kind: 'invoice'; invoice: OfficeInvoiceDetails['invoice']; payments: OfficeInvoiceDetails['payments'] }
    | { kind: 'quote'; quote: OfficeQuoteDetails['quote'] }
    | null
  >(null);
  const [billingPreviewLoading, setBillingPreviewLoading] = useState(false);
  const [invoiceEmailTo, setInvoiceEmailTo] = useState('');
  const [invoiceEmailMessage, setInvoiceEmailMessage] = useState('');
  const [invoiceEmailSending, setInvoiceEmailSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionMessage, setActionMessage] = useState('');

  useEffect(() => {
    if (billingPreview?.kind === 'invoice') {
      setInvoiceEmailTo(billingPreview.invoice.client?.email || '');
      setInvoiceEmailMessage('');
      return;
    }

    setInvoiceEmailTo('');
    setInvoiceEmailMessage('');
  }, [billingPreview]);

  async function resolveOfficeDocumentRemote(document: OfficeDocument) {
    if (!session?.token || !document.latest_version?.storage_path) {
      throw new Error('لا توجد نسخة قابلة للوصول لهذا المستند.');
    }

    const result = await requestOfficeDocumentDownloadUrl(
      { token: session.token, orgId: session.orgId },
      { document_id: document.id, storage_path: document.latest_version.storage_path },
    );

    return {
      url: result.signedDownloadUrl,
      fileName: document.latest_version.file_name || `${document.title}.pdf`,
      mimeType: document.latest_version.mime_type,
    };
  }

  async function handleViewOfficeDocument(document: OfficeDocument) {
    const remote = await resolveOfficeDocumentRemote(document);
    await openRemoteFileInApp(remote);
  }

  async function handleDownloadOfficeDocument(document: OfficeDocument) {
    const remote = await resolveOfficeDocumentRemote(document);
    await exportRemoteFileToDevice(remote);
  }

  async function handleShareOfficeDocument(document: OfficeDocument) {
    const remote = await resolveOfficeDocumentRemote(document);
    await shareRemoteFileFromDevice(remote);
  }

  async function handleViewBillingPdf(kind: 'invoice' | 'quote', id: string, number: string) {
    if (!session?.token) return;

    const remote = {
      url: kind === 'invoice'
        ? buildOfficeInvoicePdfUrl({ token: session.token, orgId: session.orgId }, id)
        : buildOfficeQuotePdfUrl({ token: session.token, orgId: session.orgId }, id),
      fileName: `${kind}-${number}.pdf`,
      mimeType: 'application/pdf',
    };

    await openRemoteFileInApp(remote);
  }

  async function handleDownloadBillingPdf(kind: 'invoice' | 'quote', id: string, number: string) {
    if (!session?.token) return;

    const remote = {
      url: kind === 'invoice'
        ? buildOfficeInvoicePdfUrl({ token: session.token, orgId: session.orgId }, id)
        : buildOfficeQuotePdfUrl({ token: session.token, orgId: session.orgId }, id),
      fileName: `${kind}-${number}.pdf`,
      mimeType: 'application/pdf',
    };

    await exportRemoteFileToDevice(remote);
  }

  async function handleShareBillingPdf(kind: 'invoice' | 'quote', id: string, number: string) {
    if (!session?.token) return;

    const remote = {
      url: kind === 'invoice'
        ? buildOfficeInvoicePdfUrl({ token: session.token, orgId: session.orgId }, id)
        : buildOfficeQuotePdfUrl({ token: session.token, orgId: session.orgId }, id),
      fileName: `${kind}-${number}.pdf`,
      mimeType: 'application/pdf',
    };

    await shareRemoteFileFromDevice(remote);
  }

  async function handleSendInvoiceEmail() {
    if (!session?.token || billingPreview?.kind !== 'invoice') {
      return;
    }

    setInvoiceEmailSending(true);
    setActionMessage('');

    try {
      const response = await sendOfficeInvoiceEmail(
        { token: session.token, orgId: session.orgId },
        {
          invoice_id: billingPreview.invoice.id,
          to_email: invoiceEmailTo.trim() || undefined,
          message_optional: invoiceEmailMessage.trim() || undefined,
        },
      );
      setInvoiceEmailTo(response.to_email);
      setActionMessage(`تم إرسال الفاتورة ${billingPreview.invoice.number} إلى ${response.to_email}`);
    } catch (nextError) {
      setActionMessage(nextError instanceof Error ? nextError.message : 'تعذر إرسال الفاتورة بالبريد.');
    } finally {
      setInvoiceEmailSending(false);
    }
  }

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!session?.token) return;

      setLoading(true);
      setError('');

      try {
        const [tasksRes, documentsRes, billingRes, notificationsRes] = await Promise.all([
          fetchOfficeTasks(session.token, { page: 1, limit: 6, mine: 1 }),
          fetchOfficeDocuments(session.token, { page: 1, limit: 6 }),
          fetchOfficeBilling(session.token, { page: 1, limit: 6 }),
          fetchOfficeNotifications(session.token, { page: 1, limit: 6 }),
        ]);

        if (mounted) {
          setTasks(tasksRes.data);
          setDocuments(documentsRes.data);
          setBilling(billingRes);
          setNotifications(notificationsRes.data);
        }
      } catch (nextError) {
        if (mounted) {
          setError(nextError instanceof Error ? nextError.message : 'تعذر تحميل الوحدات الإضافية.');
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
  }, [isFocused, session?.token]);

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
        eyebrow="مركز العمليات"
        title="الوحدات التشغيلية"
        subtitle="العمل الآن مقسّم إلى شرائح أصغر: المهام، المستندات، الفوترة، والنشاط."
        aside={<StatusChip label="مربوط بالموقع" tone="success" />}
      />

      <Card>
        <SectionTitle title="إجراءات سريعة" subtitle="تنفيذ مباشر بدل القراءة فقط." />
        <View style={styles.quickActionsGrid}>
          <Pressable style={styles.actionTile} onPress={() => navigation.navigate('OfficeTaskForm', { mode: 'create' })}>
            <Text style={styles.actionTileTitle}>مهمة جديدة</Text>
            <Text style={styles.actionTileMeta}>إنشاء من البداية</Text>
          </Pressable>
          <Pressable style={styles.actionTile} onPress={() => navigation.navigate('OfficeDocumentForm', { mode: 'create' })}>
            <Text style={styles.actionTileTitle}>مستند جديد</Text>
            <Text style={styles.actionTileMeta}>رفع مباشر</Text>
          </Pressable>
          <Pressable style={styles.actionTile} onPress={() => navigation.navigate('OfficeClientForm', { mode: 'create' })}>
            <Text style={styles.actionTileTitle}>عميل جديد</Text>
            <Text style={styles.actionTileMeta}>ملف موكل</Text>
          </Pressable>
          <Pressable style={styles.actionTile} onPress={() => navigation.navigate('OfficeMatterForm', { mode: 'create' })}>
            <Text style={styles.actionTileTitle}>قضية جديدة</Text>
            <Text style={styles.actionTileMeta}>ربط بعميل</Text>
          </Pressable>
          <Pressable style={styles.actionTile} onPress={() => navigation.navigate('OfficeBillingForm', { mode: 'quote' })}>
            <Text style={styles.actionTileTitle}>عرض سعر</Text>
            <Text style={styles.actionTileMeta}>مسودة جاهزة</Text>
          </Pressable>
          <Pressable style={styles.actionTile} onPress={() => navigation.navigate('OfficeBillingForm', { mode: 'invoice' })}>
            <Text style={styles.actionTileTitle}>فاتورة</Text>
            <Text style={styles.actionTileMeta}>إصدار جديد</Text>
          </Pressable>
          <Pressable style={styles.actionTile} onPress={() => navigation.navigate('OfficeSettingsHome')}>
            <Text style={styles.actionTileTitle}>إدارة المكتب</Text>
            <Text style={styles.actionTileMeta}>الهوية، الفريق، والخطة الحالية</Text>
          </Pressable>
        </View>
        {actionMessage ? <Text style={styles.formMessage}>{actionMessage}</Text> : null}
      </Card>

      <Card>
        <SectionTitle title="إعدادات المكتب" subtitle="الوصول السريع إلى الهوية والفريق والخطة الحالية." />
        <View style={styles.quickActionsGrid}>
          <Pressable style={styles.actionTile} onPress={() => navigation.navigate('OfficeSettings', { section: 'identity' })}>
            <Text style={styles.actionTileTitle}>الهوية</Text>
            <Text style={styles.actionTileMeta}>الاسم والشعار</Text>
          </Pressable>
          <Pressable style={styles.actionTile} onPress={() => navigation.navigate('OfficeSettings', { section: 'team' })}>
            <Text style={styles.actionTileTitle}>الفريق</Text>
            <Text style={styles.actionTileMeta}>الأعضاء والدعوات</Text>
          </Pressable>
          <Pressable style={styles.actionTile} onPress={() => navigation.navigate('OfficeSettings', { section: 'subscription' })}>
            <Text style={styles.actionTileTitle}>الخطة الحالية</Text>
            <Text style={styles.actionTileMeta}>عرض فقط</Text>
          </Pressable>
        </View>
      </Card>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Card>
        <SectionTitle title="تنظيم العرض" subtitle="اختر القسم الذي تريد العمل عليه الآن." />
        <SegmentedControl
          value={section}
          onChange={(next) => {
            setSection(next as typeof section);
            if (next !== 'billing') {
              setBillingPreview(null);
            }
          }}
          options={[
            { key: 'tasks', label: 'المهام', count: tasks.length },
            { key: 'documents', label: 'المستندات', count: documents.length },
            {
              key: 'billing',
              label: 'الفوترة',
              count: (billing?.invoices.data.length || 0) + (billing?.quotes.data.length || 0),
            },
            { key: 'activity', label: 'النشاط', count: notifications.length },
          ]}
        />
      </Card>

      {section === 'tasks' ? (
        <Card>
          <SectionTitle title="مهامي الحالية" subtitle="المسندة لك أو الأقرب للاستحقاق." />
          {tasks.length ? (
            tasks.map((task) => (
              <View key={task.id} style={styles.controlRow}>
                <Pressable
                  style={styles.controlRowMain}
                  onPress={() =>
                    navigation.navigate('OfficeTaskForm', {
                      mode: 'edit',
                      task: {
                        id: task.id,
                        title: task.title,
                        description: task.description,
                        matter_id: task.matter_id,
                        due_at: task.due_at,
                        priority: task.priority as OfficeTaskWritePayload['priority'],
                        status: task.status as OfficeTaskWritePayload['status'],
                      },
                    })
                  }
                >
                  <View style={styles.rowText}>
                    <Text style={styles.rowTitle}>{task.title}</Text>
                    <Text style={styles.rowMeta}>
                      {[task.matter_title || 'بدون قضية', task.due_at ? `الاستحقاق ${formatDate(task.due_at)}` : 'بدون تاريخ'].join(' · ')}
                    </Text>
                  </View>
                  <StatusChip label={task.is_overdue ? 'متأخرة' : task.status} tone={taskTone(task)} />
                </Pressable>
                <View style={styles.inlineActionRow}>
                  <Pressable
                    style={styles.inlineAction}
                    onPress={async () => {
                      if (!session?.token) return;
                      try {
                        await setOfficeTaskStatus({ token: session.token, orgId: session.orgId }, { id: task.id, status: 'done' });
                        setTasks((current) => current.map((item) => (item.id === task.id ? { ...item, status: 'done', is_overdue: false } : item)));
                        setActionMessage(`تم إغلاق المهمة: ${task.title}`);
                      } catch (nextError) {
                        setActionMessage(nextError instanceof Error ? nextError.message : 'تعذر تحديث المهمة.');
                      }
                    }}
                  >
                    <Text style={styles.inlineActionText}>تم</Text>
                  </Pressable>
                  <Pressable
                    style={styles.inlineAction}
                    onPress={async () => {
                      if (!session?.token) return;
                      try {
                        await archiveOfficeTask({ token: session.token, orgId: session.orgId }, { id: task.id, archived: true });
                        setTasks((current) => current.filter((item) => item.id !== task.id));
                        setActionMessage(`تمت أرشفة المهمة: ${task.title}`);
                      } catch (nextError) {
                        setActionMessage(nextError instanceof Error ? nextError.message : 'تعذر أرشفة المهمة.');
                      }
                    }}
                  >
                    <Text style={styles.inlineActionText}>أرشفة</Text>
                  </Pressable>
                </View>
              </View>
            ))
          ) : (
            <EmptyState title="لا توجد مهام" message="لا توجد مهام إضافية معروضة لك حاليًا." />
          )}
        </Card>
      ) : null}

      {section === 'documents' ? (
        <Card>
          <SectionTitle title="المستندات" subtitle="آخر الملفات المتاحة على مستوى المكتب." />
          {documents.length ? (
            documents.map((document) => (
              <View key={document.id} style={styles.controlRow}>
                <View style={styles.controlRowMain}>
                  <View style={styles.rowText}>
                    <Text style={styles.rowTitle}>{document.title}</Text>
                    <Text style={styles.rowMeta}>
                      {[document.client_name || 'بدون عميل', document.latest_version?.file_name || 'بدون نسخة'].join(' · ')}
                    </Text>
                  </View>
                  <StatusChip label={document.folder || 'مستند'} tone="default" />
                </View>
                <View style={styles.inlineActionRow}>
                  <Pressable
                    style={styles.inlineAction}
                    onPress={async () => {
                      try {
                        await handleViewOfficeDocument(document);
                        setActionMessage(`تم فتح المستند: ${document.title}`);
                      } catch (nextError) {
                        setActionMessage(nextError instanceof Error ? nextError.message : 'تعذر فتح المستند.');
                      }
                    }}
                  >
                    <Text style={styles.inlineActionText}>عرض</Text>
                  </Pressable>
                  <Pressable
                    style={styles.inlineAction}
                    onPress={async () => {
                      try {
                        await handleDownloadOfficeDocument(document);
                        setActionMessage(`تم تجهيز تنزيل المستند: ${document.title}`);
                      } catch (nextError) {
                        setActionMessage(nextError instanceof Error ? nextError.message : 'تعذر تنزيل المستند.');
                      }
                    }}
                  >
                    <Text style={styles.inlineActionText}>تحميل</Text>
                  </Pressable>
                  <Pressable
                    style={styles.inlineAction}
                    onPress={async () => {
                      try {
                        await handleShareOfficeDocument(document);
                        setActionMessage(`تمت مشاركة المستند: ${document.title}`);
                      } catch (nextError) {
                        setActionMessage(nextError instanceof Error ? nextError.message : 'تعذر مشاركة المستند.');
                      }
                    }}
                  >
                    <Text style={styles.inlineActionText}>مشاركة</Text>
                  </Pressable>
                  <Pressable
                    style={styles.inlineAction}
                    onPress={async () => {
                      if (!session?.token) return;
                      try {
                        const picked = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false });
                        if (picked.canceled) return;
                        const asset = picked.assets[0];
                        await addOfficeDocumentVersion(
                          { token: session.token, orgId: session.orgId },
                          {
                            document_id: document.id,
                            file: {
                              uri: asset.uri,
                              name: asset.name,
                              mimeType: asset.mimeType ?? null,
                            },
                          },
                        );
                        setActionMessage(`تمت إضافة نسخة جديدة إلى: ${document.title}`);
                      } catch (nextError) {
                        setActionMessage(nextError instanceof Error ? nextError.message : 'تعذر رفع النسخة الجديدة.');
                      }
                    }}
                  >
                    <Text style={styles.inlineActionText}>نسخة</Text>
                  </Pressable>
                  <Pressable
                    style={styles.inlineAction}
                    onPress={async () => {
                      if (!session?.token) return;
                      try {
                        await archiveOfficeDocument({ token: session.token, orgId: session.orgId }, { id: document.id, archived: !document.is_archived });
                        setDocuments((current) =>
                          current.map((item) =>
                            item.id === document.id ? { ...item, is_archived: !item.is_archived } : item,
                          ),
                        );
                        setActionMessage(document.is_archived ? `تم استرجاع المستند: ${document.title}` : `تمت أرشفة المستند: ${document.title}`);
                      } catch (nextError) {
                        setActionMessage(nextError instanceof Error ? nextError.message : 'تعذر تحديث المستند.');
                      }
                    }}
                  >
                    <Text style={styles.inlineActionText}>{document.is_archived ? 'استرجاع' : 'أرشفة'}</Text>
                  </Pressable>
                </View>
              </View>
            ))
          ) : (
            <EmptyState title="لا توجد مستندات" message="لا توجد مستندات معروضة حاليًا." />
          )}
        </Card>
      ) : null}

      {section === 'billing' ? (
        <Card>
          <SectionTitle title="الفوترة والعروض" subtitle="آخر الفواتير وعروض الأسعار داخل نفس النظام." />
          {billing?.invoices.data.slice(0, 3).map((invoice) => (
            <View key={invoice.id} style={styles.controlRow}>
              <View style={styles.controlRowMain}>
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>{`فاتورة ${invoice.number}`}</Text>
                  <Text style={styles.rowMeta}>
                    {[
                      invoice.client_name || 'بدون عميل',
                      formatCurrency(invoice.total, invoice.currency),
                    ].join(' · ')}
                  </Text>
                </View>
                <StatusChip label={invoice.status} tone={billingTone(invoice.status)} />
              </View>
              <View style={styles.inlineActionRow}>
                <Pressable
                  style={styles.inlineAction}
                  onPress={async () => {
                    if (!session?.token) return;
                    try {
                      setBillingPreviewLoading(true);
                      const details = await fetchOfficeInvoiceDetails({ token: session.token, orgId: session.orgId }, invoice.id);
                      setBillingPreview({ kind: 'invoice', invoice: details.invoice, payments: details.payments });
                      setActionMessage(`تم فتح الفاتورة ${invoice.number}`);
                    } catch (nextError) {
                      setActionMessage(nextError instanceof Error ? nextError.message : 'تعذر فتح الفاتورة.');
                    } finally {
                      setBillingPreviewLoading(false);
                    }
                  }}
                >
                  <Text style={styles.inlineActionText}>عرض</Text>
                </Pressable>
                <Pressable
                  style={styles.inlineAction}
                  onPress={async () => {
                    try {
                      await handleViewBillingPdf('invoice', invoice.id, invoice.number);
                    } catch (nextError) {
                      setActionMessage(nextError instanceof Error ? nextError.message : 'تعذر فتح PDF الفاتورة.');
                    }
                  }}
                >
                  <Text style={styles.inlineActionText}>PDF</Text>
                </Pressable>
                <Pressable
                  style={styles.inlineAction}
                  onPress={async () => {
                    if (!session?.token) return;
                    try {
                      const nextArchived = !(invoice.is_archived ?? false);
                      const updated = await archiveOfficeInvoice(
                        { token: session.token, orgId: session.orgId },
                        { id: invoice.id, archived: nextArchived },
                      );
                      setBilling((current) =>
                        current
                          ? {
                              ...current,
                              invoices: {
                                ...current.invoices,
                                data: current.invoices.data.map((item) =>
                                  item.id === invoice.id ? updated : item,
                                ),
                              },
                            }
                          : current,
                      );
                      setActionMessage(nextArchived ? `تمت أرشفة الفاتورة ${invoice.number}` : `تم استرجاع الفاتورة ${invoice.number}`);
                    } catch (nextError) {
                      setActionMessage(nextError instanceof Error ? nextError.message : 'تعذر تحديث حالة الفاتورة.');
                    }
                  }}
                >
                  <Text style={styles.inlineActionText}>{invoice.is_archived ? 'استرجاع' : 'أرشفة'}</Text>
                </Pressable>
              </View>
            </View>
          ))}
          {billing?.quotes.data.slice(0, 3).map((quote) => (
            <View key={quote.id} style={styles.controlRow}>
              <View style={styles.controlRowMain}>
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>{`عرض ${quote.number}`}</Text>
                  <Text style={styles.rowMeta}>
                    {[quote.client_name || 'بدون عميل', formatCurrency(quote.total, quote.currency)].join(' · ')}
                  </Text>
                </View>
                <StatusChip label={quote.status} tone={billingTone(quote.status)} />
              </View>
              <View style={styles.inlineActionRow}>
                <Pressable
                  style={styles.inlineAction}
                  onPress={async () => {
                    if (!session?.token) return;
                    try {
                      setBillingPreviewLoading(true);
                      const details = await fetchOfficeQuoteDetails({ token: session.token, orgId: session.orgId }, quote.id);
                      setBillingPreview({ kind: 'quote', quote: details.quote });
                      setActionMessage(`تم فتح عرض السعر ${quote.number}`);
                    } catch (nextError) {
                      setActionMessage(nextError instanceof Error ? nextError.message : 'تعذر فتح عرض السعر.');
                    } finally {
                      setBillingPreviewLoading(false);
                    }
                  }}
                >
                  <Text style={styles.inlineActionText}>عرض</Text>
                </Pressable>
                <Pressable
                  style={styles.inlineAction}
                  onPress={async () => {
                    try {
                      await handleViewBillingPdf('quote', quote.id, quote.number);
                    } catch (nextError) {
                      setActionMessage(nextError instanceof Error ? nextError.message : 'تعذر فتح PDF العرض.');
                    }
                  }}
                >
                  <Text style={styles.inlineActionText}>PDF</Text>
                </Pressable>
              </View>
            </View>
          ))}
          {billingPreviewLoading ? <LoadingBlock /> : null}
          {billingPreview?.kind === 'invoice' ? (
            <View style={styles.itemBlock}>
              <SectionTitle
                title={`تفاصيل الفاتورة ${billingPreview.invoice.number}`}
                subtitle={[
                  billingPreview.invoice.client?.name || billingPreview.invoice.client_name || 'بدون عميل',
                  formatCurrency(billingPreview.invoice.total, billingPreview.invoice.currency),
                ].join(' · ')}
              />
              {billingPreview.invoice.items.map((item, index) => (
                <SummaryRow
                  key={`${billingPreview.invoice.id}-item-${index}`}
                  title={item.desc}
                  subtitle={`الكمية ${item.qty} · سعر الوحدة ${formatCurrency(item.unit_price, billingPreview.invoice.currency)}`}
                  status={formatCurrency(item.qty * item.unit_price, billingPreview.invoice.currency)}
                  tone="gold"
                />
              ))}
              <View style={styles.metaGrid}>
                <Meta label="الإجمالي قبل الضريبة" value={formatCurrency(billingPreview.invoice.subtotal, billingPreview.invoice.currency)} />
                <Meta label="الضريبة" value={formatCurrency(billingPreview.invoice.tax, billingPreview.invoice.currency)} />
                <Meta label="تاريخ الإصدار" value={formatDate(billingPreview.invoice.issued_at)} />
                <Meta label="الاستحقاق" value={formatDate(billingPreview.invoice.due_at)} />
              </View>
              <View style={styles.inlineActionRow}>
                <Pressable
                  style={styles.inlineAction}
                  onPress={async () => {
                    try {
                      await handleViewBillingPdf('invoice', billingPreview.invoice.id, billingPreview.invoice.number);
                    } catch (nextError) {
                      setActionMessage(nextError instanceof Error ? nextError.message : 'تعذر فتح PDF الفاتورة.');
                    }
                  }}
                >
                  <Text style={styles.inlineActionText}>عرض PDF</Text>
                </Pressable>
                <Pressable
                  style={styles.inlineAction}
                  onPress={async () => {
                    try {
                      await handleDownloadBillingPdf('invoice', billingPreview.invoice.id, billingPreview.invoice.number);
                      setActionMessage(`تم تجهيز تنزيل الفاتورة ${billingPreview.invoice.number}`);
                    } catch (nextError) {
                      setActionMessage(nextError instanceof Error ? nextError.message : 'تعذر تنزيل الفاتورة.');
                    }
                  }}
                >
                  <Text style={styles.inlineActionText}>تحميل</Text>
                </Pressable>
                <Pressable
                  style={styles.inlineAction}
                  onPress={async () => {
                    try {
                      await handleShareBillingPdf('invoice', billingPreview.invoice.id, billingPreview.invoice.number);
                    } catch (nextError) {
                      setActionMessage(nextError instanceof Error ? nextError.message : 'تعذر مشاركة الفاتورة.');
                    }
                  }}
                >
                  <Text style={styles.inlineActionText}>مشاركة</Text>
                </Pressable>
              </View>
              <View style={styles.formBlock}>
                <Text style={styles.formTitle}>إرسال الفاتورة بالبريد</Text>
                <Field
                  label="البريد الإلكتروني"
                  value={invoiceEmailTo}
                  onChangeText={setInvoiceEmailTo}
                  placeholder="client@example.com"
                  keyboardType="email-address"
                />
                <Text style={styles.fieldLabel}>رسالة إضافية</Text>
                <TextInput
                  value={invoiceEmailMessage}
                  onChangeText={setInvoiceEmailMessage}
                  placeholder="يمكن تركها فارغة لاستخدام الرسالة الاحترافية الافتراضية"
                  placeholderTextColor={colors.textMuted}
                  style={styles.multiline}
                  multiline
                />
                <PrimaryButton
                  title={invoiceEmailSending ? 'جارٍ الإرسال...' : 'إرسال الفاتورة للعميل'}
                  onPress={() => void handleSendInvoiceEmail()}
                  disabled={invoiceEmailSending}
                />
              </View>
              {billingPreview.payments.length ? (
                billingPreview.payments.map((payment) => (
                  <SummaryRow
                    key={payment.id}
                    title={`دفعة ${formatCurrency(payment.amount, billingPreview.invoice.currency)}`}
                    subtitle={[
                      payment.method || 'طريقة غير محددة',
                      formatDateTime(payment.paid_at || payment.created_at),
                      payment.note || 'بدون ملاحظة',
                    ].join(' · ')}
                    status="مسجل"
                    tone="success"
                  />
                ))
              ) : (
                <EmptyState title="لا توجد دفعات" message="لم يتم تسجيل أي دفعة على هذه الفاتورة حتى الآن." />
              )}
            </View>
          ) : null}
          {billingPreview?.kind === 'quote' ? (
            <View style={styles.itemBlock}>
              <SectionTitle
                title={`تفاصيل العرض ${billingPreview.quote.number}`}
                subtitle={[
                  billingPreview.quote.client?.name || billingPreview.quote.client_name || 'بدون عميل',
                  formatCurrency(billingPreview.quote.total, billingPreview.quote.currency),
                ].join(' · ')}
              />
              {billingPreview.quote.items.map((item, index) => (
                <SummaryRow
                  key={`${billingPreview.quote.id}-item-${index}`}
                  title={item.desc}
                  subtitle={`الكمية ${item.qty} · سعر الوحدة ${formatCurrency(item.unit_price, billingPreview.quote.currency)}`}
                  status={formatCurrency(item.qty * item.unit_price, billingPreview.quote.currency)}
                  tone="gold"
                />
              ))}
              <View style={styles.metaGrid}>
                <Meta label="الإجمالي قبل الضريبة" value={formatCurrency(billingPreview.quote.subtotal, billingPreview.quote.currency)} />
                <Meta label="الضريبة" value={formatCurrency(billingPreview.quote.tax, billingPreview.quote.currency)} />
                <Meta label="الحالة" value={billingPreview.quote.status} />
                <Meta label="تاريخ الإنشاء" value={formatDate(billingPreview.quote.created_at)} />
              </View>
              <View style={styles.inlineActionRow}>
                <Pressable
                  style={styles.inlineAction}
                  onPress={async () => {
                    try {
                      await handleViewBillingPdf('quote', billingPreview.quote.id, billingPreview.quote.number);
                    } catch (nextError) {
                      setActionMessage(nextError instanceof Error ? nextError.message : 'تعذر فتح PDF العرض.');
                    }
                  }}
                >
                  <Text style={styles.inlineActionText}>عرض PDF</Text>
                </Pressable>
                <Pressable
                  style={styles.inlineAction}
                  onPress={async () => {
                    try {
                      await handleDownloadBillingPdf('quote', billingPreview.quote.id, billingPreview.quote.number);
                      setActionMessage(`تم تجهيز تنزيل عرض السعر ${billingPreview.quote.number}`);
                    } catch (nextError) {
                      setActionMessage(nextError instanceof Error ? nextError.message : 'تعذر تنزيل عرض السعر.');
                    }
                  }}
                >
                  <Text style={styles.inlineActionText}>تحميل</Text>
                </Pressable>
                <Pressable
                  style={styles.inlineAction}
                  onPress={async () => {
                    try {
                      await handleShareBillingPdf('quote', billingPreview.quote.id, billingPreview.quote.number);
                    } catch (nextError) {
                      setActionMessage(nextError instanceof Error ? nextError.message : 'تعذر مشاركة عرض السعر.');
                    }
                  }}
                >
                  <Text style={styles.inlineActionText}>مشاركة</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
          {!billing?.invoices.data.length && !billing?.quotes.data.length ? (
            <EmptyState title="لا توجد حركة فوترة" message="ستظهر هنا الفواتير والعروض عندما تتوفر." />
          ) : null}
        </Card>
      ) : null}

      {section === 'activity' ? (
        <Card>
          <SectionTitle title="النشاط الأخير" subtitle="الإشعارات الحديثة التي تحتاج مراجعة." />
          {notifications.slice(0, 3).map((item) => (
            <SummaryRow
              key={item.id}
              title={item.title}
              subtitle={[item.body || 'بدون تفاصيل', formatDateTime(item.created_at)].join(' · ')}
              status={item.category || item.source || 'نظام'}
              tone={notificationTone(item.category)}
            />
          ))}
          {!notifications.length ? (
            <EmptyState title="لا توجد إشعارات" message="ستظهر هنا آخر التنبيهات عندما تتوفر." />
          ) : null}
        </Card>
      ) : null}

      <Card>
        <SectionTitle title="الحساب" subtitle="إنهاء الجلسة الحالية من هذا الجهاز." />
        <SummaryRow title={session?.email || '—'} subtitle={officeRoleLabel(session?.role || null)} />
        {session?.isAdmin ? (
          <Pressable
            onPress={() => {
              void switchPortal('admin').catch((nextError) => {
                setActionMessage(nextError instanceof Error ? nextError.message : 'تعذر فتح لوحة الإدارة.');
              });
            }}
            style={[styles.signOutButton, styles.adminSwitchButton]}
          >
            <Text style={[styles.signOutText, styles.adminSwitchText]}>الانتقال إلى لوحة الإدارة</Text>
          </Pressable>
        ) : null}
        <Pressable onPress={() => void signOut()} style={styles.signOutButton}>
          <Text style={styles.signOutText}>تسجيل الخروج</Text>
        </Pressable>
        <View style={styles.accountActionsRow}>
          <PrimaryButton title="الدعم" onPress={() => void openSupportPage()} secondary />
          <PrimaryButton title="الشروط" onPress={() => void openTermsOfService()} secondary />
        </View>
        <View style={styles.accountActionsRow}>
          <PrimaryButton title="الخصوصية" onPress={() => void openPrivacyPolicy()} secondary />
          <PrimaryButton
            title={session?.role === 'owner' ? 'طلب حذف الحساب والبيانات' : 'طلب حذف الحساب'}
            onPress={() =>
              Alert.alert(
                'طلب حذف الحساب',
                'سيتم إرسال طلب حذف الحساب للمراجعة مع التحقق من الهوية قبل التنفيذ. هل تريد المتابعة؟',
                [
                  { text: 'إلغاء', style: 'cancel' },
                  {
                    text: 'إرسال الطلب',
                    style: 'destructive',
                    onPress: () => {
                      if (!session?.token) return;
                      void requestSignedInAccountDeletion(session.token)
                        .then((response) => {
                          setActionMessage(response.message || 'تم إرسال طلب حذف الحساب.');
                        })
                        .catch((nextError) => {
                          setActionMessage(nextError instanceof Error ? nextError.message : 'تعذر إرسال الطلب.');
                        });
                    },
                  },
                ],
              )
            }
            secondary
          />
        </View>
      </Card>
    </Page>
  );
}

type SelectOption = {
  id: string;
  label: string;
  subtitle?: string | null;
};

function useOfficeDirectory(token: string | undefined) {
  const isFocused = useIsFocused();
  const [clients, setClients] = useState<OfficeClient[]>([]);
  const [matters, setMatters] = useState<MatterSummary[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!token) return;
      setLoading(true);
      try {
        const [mattersPayload, clientsPayload] = await Promise.all([
          fetchOfficeMatters(token),
          fetchOfficeClients(token, { page: 1, limit: 50, status: 'all' }),
        ]);
        if (mounted) {
          setMatters(mattersPayload.data);
          setClients(clientsPayload.data);
        }
      } catch {
        if (mounted) {
          setMatters([]);
          setClients([]);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void load();
    return () => {
      mounted = false;
    };
  }, [isFocused, token]);

  const clientOptions = useMemo<SelectOption[]>(() => {
    return clients.map((client) => ({
      id: client.id,
      label: client.name,
      subtitle: [client.email || 'بدون بريد', client.phone || 'بدون جوال'].join(' · '),
    }));
  }, [clients]);

  const matterOptions = useMemo<SelectOption[]>(() => {
    return matters.map((matter) => ({
      id: matter.id,
      label: matter.title,
      subtitle: [matter.client?.name || 'بدون عميل', matter.case_type || 'قضية عامة'].join(' · '),
    }));
  }, [matters]);

  return { clientOptions, matterOptions, loading };
}

function SelectionList({
  label,
  selectedId,
  query,
  onQueryChange,
  onSelect,
  options,
  placeholder,
}: {
  label: string;
  selectedId: string;
  query: string;
  onQueryChange: (value: string) => void;
  onSelect: (value: string) => void;
  options: SelectOption[];
  placeholder: string;
}) {
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return options;
    return options.filter((option) => `${option.label} ${option.subtitle || ''}`.toLowerCase().includes(needle));
  }, [options, query]);

  return (
    <View style={styles.selectionBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={query}
        onChangeText={onQueryChange}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        style={styles.search}
        textAlign="right"
      />
      <View style={styles.selectionList}>
        {filtered.slice(0, 8).map((option) => (
          <Pressable
            key={option.id}
            onPress={() => {
              onSelect(option.id);
              onQueryChange(option.label);
            }}
            style={styles.selectionItem}
          >
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>{option.label}</Text>
              {option.subtitle ? <Text style={styles.rowMeta}>{option.subtitle}</Text> : null}
            </View>
            <StatusChip label={selectedId === option.id ? 'مختار' : 'اختر'} tone={selectedId === option.id ? 'success' : 'default'} />
          </Pressable>
        ))}
        {!filtered.length ? <Text style={styles.rowMeta}>لا توجد نتائج.</Text> : null}
      </View>
    </View>
  );
}

function FormHeader({
  eyebrow,
  title,
  subtitle,
  tone = 'default',
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  tone?: 'default' | 'success' | 'warning' | 'gold';
}) {
  return (
    <HeroCard
      eyebrow={eyebrow}
      title={title}
      subtitle={subtitle}
      aside={<StatusChip label={eyebrow} tone={tone} />}
    />
  );
}

function FormFooter({
  saving,
  onSubmit,
  onCancel,
  submitLabel,
}: {
  saving: boolean;
  onSubmit: () => void;
  onCancel?: () => void;
  submitLabel: string;
}) {
  return (
    <View style={styles.formFooter}>
      <PrimaryButton title={submitLabel} onPress={onSubmit} disabled={saving} />
      {onCancel ? <PrimaryButton title="رجوع" onPress={onCancel} secondary /> : null}
    </View>
  );
}

type OfficeClientFormProps = NativeStackScreenProps<OfficeStackParamList, 'OfficeClientForm'>;
type OfficeMatterFormProps = NativeStackScreenProps<OfficeStackParamList, 'OfficeMatterForm'>;
type OfficeTaskFormProps = NativeStackScreenProps<OfficeStackParamList, 'OfficeTaskForm'>;
type OfficeDocumentFormProps = NativeStackScreenProps<OfficeStackParamList, 'OfficeDocumentForm'>;
type OfficeBillingFormProps = NativeStackScreenProps<OfficeStackParamList, 'OfficeBillingForm'>;

export function OfficeClientFormScreen({ route, navigation }: OfficeClientFormProps) {
  const { session } = useAuth();
  const draft = route.params.client ?? {};
  const [type, setType] = useState<OfficeClientWritePayload['type']>(draft.type === 'company' ? 'company' : 'person');
  const [name, setName] = useState(String(draft.name ?? ''));
  const [email, setEmail] = useState(String(draft.email ?? ''));
  const [phone, setPhone] = useState(String(draft.phone ?? ''));
  const [identityNo, setIdentityNo] = useState(String(draft.identity_no ?? ''));
  const [commercialNo, setCommercialNo] = useState(String(draft.commercial_no ?? ''));
  const [address, setAddress] = useState(String(draft.address ?? ''));
  const [agencyNumber, setAgencyNumber] = useState(String(draft.agency_number ?? ''));
  const [notes, setNotes] = useState(String(draft.notes ?? ''));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  async function submit() {
    if (!session?.token) return;
    setSaving(true);
    setMessage('');
    try {
      const payload: OfficeClientWritePayload = {
        type,
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || null,
        identity_no: identityNo.trim() || null,
        commercial_no: commercialNo.trim() || null,
        address: address.trim() || null,
        agency_number: agencyNumber.trim() || null,
        notes: notes.trim() || null,
      };
      route.params.mode === 'edit' && draft.id
        ? await updateOfficeClient({ token: session.token, orgId: session.orgId }, { ...payload, id: draft.id })
        : await createOfficeClient({ token: session.token, orgId: session.orgId }, payload);
      setMessage(`تم حفظ العميل: ${name.trim()}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'تعذر حفظ العميل.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Page>
      <FormHeader
        eyebrow={route.params.mode === 'edit' ? 'تعديل عميل' : 'عميل جديد'}
        title={route.params.mode === 'edit' ? 'تحديث بيانات العميل' : 'إضافة عميل جديد'}
        subtitle="هذا النموذج يحفظ مباشرة في قاعدة البيانات نفسها المرتبطة بالموقع."
        tone={route.params.mode === 'edit' ? 'warning' : 'success'}
      />
      <Card>
        <SectionTitle title="البيانات الأساسية" />
        <View style={styles.typeRow}>
          {(['person', 'company'] as const).map((item) => (
            <Pressable key={item} onPress={() => setType(item)} style={[styles.typeChip, type === item && styles.typeChipActive]}>
              <Text style={[styles.typeChipText, type === item && styles.typeChipTextActive]}>{item === 'person' ? 'فرد' : 'شركة'}</Text>
            </Pressable>
          ))}
        </View>
        <Field label="الاسم" value={name} onChangeText={setName} placeholder="اسم العميل" />
        <Field label="البريد" value={email} onChangeText={setEmail} placeholder="client@example.com" keyboardType="email-address" />
        <Field label="الجوال" value={phone} onChangeText={setPhone} placeholder="05xxxxxxxx" keyboardType="default" />
        <Field label="رقم الهوية / السجل" value={identityNo} onChangeText={setIdentityNo} placeholder="رقم الهوية" />
        <Field label="الرقم التجاري" value={commercialNo} onChangeText={setCommercialNo} placeholder="الرقم التجاري" />
        <Field label="رقم الوكالة" value={agencyNumber} onChangeText={setAgencyNumber} placeholder="اختياري" />
        <Field label="العنوان" value={address} onChangeText={setAddress} placeholder="العنوان" />
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>ملاحظات</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="ملاحظات داخلية"
            placeholderTextColor={colors.textMuted}
            multiline
            style={styles.multiline}
            textAlign="right"
          />
        </View>
        {message ? <Text style={styles.formMessage}>{message}</Text> : null}
        {route.params.mode === 'edit' && draft.id ? (
          <PrimaryButton
            title="حذف العميل"
            secondary
            onPress={async () => {
              if (!session?.token || !draft.id) return;
              setSaving(true);
              setMessage('');
              try {
                await deleteOfficeClient({ token: session.token, orgId: session.orgId }, { id: draft.id });
                navigation.goBack();
              } catch (error) {
                setMessage(error instanceof Error ? error.message : 'تعذر حذف العميل.');
              } finally {
                setSaving(false);
              }
            }}
          />
        ) : null}
        <FormFooter saving={saving} onSubmit={submit} onCancel={() => navigation.goBack()} submitLabel={route.params.mode === 'edit' ? 'حفظ التعديل' : 'إنشاء العميل'} />
      </Card>
    </Page>
  );
}

export function OfficeMatterFormScreen({ route, navigation }: OfficeMatterFormProps) {
  const { session } = useAuth();
  const draft = route.params.matter ?? {};
  const { clientOptions } = useOfficeDirectory(session?.token);
  const [clientId, setClientId] = useState(String(draft.client_id ?? ''));
  const [clientQuery, setClientQuery] = useState('');
  const [title, setTitle] = useState(String(draft.title ?? ''));
  const [status, setStatus] = useState<NonNullable<OfficeMatterWritePayload['status']>>(draft.status ?? 'new');
  const [summary, setSummary] = useState(String(draft.summary ?? ''));
  const [najizCaseNumber, setNajizCaseNumber] = useState(String(draft.najiz_case_number ?? ''));
  const [caseType, setCaseType] = useState(String(draft.case_type ?? ''));
  const [claims, setClaims] = useState(String(draft.claims ?? ''));
  const [privacy, setPrivacy] = useState(Boolean(draft.is_private));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  async function submit() {
    if (!session?.token) return;
    setSaving(true);
    setMessage('');
    try {
      const payload: OfficeMatterWritePayload = {
        client_id: clientId.trim() || null,
        title: title.trim(),
        status,
        summary: summary.trim() || null,
        najiz_case_number: najizCaseNumber.trim() || null,
        case_type: caseType.trim() || null,
        claims: claims.trim() || null,
        is_private: privacy,
      };
      route.params.mode === 'edit' && draft.id
        ? await updateOfficeMatter({ token: session.token, orgId: session.orgId }, { ...payload, id: draft.id })
        : await createOfficeMatter({ token: session.token, orgId: session.orgId }, payload);
      setMessage(`تم حفظ القضية: ${title.trim()}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'تعذر حفظ القضية.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Page>
      <FormHeader
        eyebrow={route.params.mode === 'edit' ? 'تعديل قضية' : 'قضية جديدة'}
        title={route.params.mode === 'edit' ? 'تحديث ملف قانوني' : 'إنشاء ملف قانوني جديد'}
        subtitle="اختر عميلًا من الدليل الحالي ثم أضف وصفًا وحالة وتفاصيل ناجز."
        tone={route.params.mode === 'edit' ? 'warning' : 'success'}
      />
      <Card>
        <SectionTitle title="العميل والقضية" />
        <SelectionList
          label="العميل"
          selectedId={clientId}
          query={clientQuery}
          onQueryChange={setClientQuery}
          onSelect={setClientId}
          options={clientOptions}
          placeholder="ابحث برقم أو اسم العميل"
        />
        <Field label="عنوان القضية" value={title} onChangeText={setTitle} placeholder="مثال: نزاع تجاري" />
        <View style={styles.selectionListInline}>
          {(['new', 'in_progress', 'on_hold', 'closed', 'archived'] as const).map((item) => (
            <Pressable key={item} onPress={() => setStatus(item)} style={[styles.typeChip, status === item && styles.typeChipActive]}>
              <Text style={[styles.typeChipText, status === item && styles.typeChipTextActive]}>{item}</Text>
            </Pressable>
          ))}
        </View>
        <Field label="رقم ناجز" value={najizCaseNumber} onChangeText={setNajizCaseNumber} placeholder="اختياري" />
        <Field label="نوع القضية" value={caseType} onChangeText={setCaseType} placeholder="مثال: تجاري / عمالي" />
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>الملخص</Text>
          <TextInput value={summary} onChangeText={setSummary} placeholder="ملخص مختصر" placeholderTextColor={colors.textMuted} multiline style={styles.multiline} textAlign="right" />
        </View>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>الطلبات / المطالبات</Text>
          <TextInput value={claims} onChangeText={setClaims} placeholder="تفاصيل المطالبات" placeholderTextColor={colors.textMuted} multiline style={styles.multiline} textAlign="right" />
        </View>
        <Pressable onPress={() => setPrivacy((current) => !current)} style={styles.toggleRow}>
          <Text style={styles.rowTitle}>{privacy ? 'قضية خاصة' : 'قضية عامة'}</Text>
          <StatusChip label={privacy ? 'خاص' : 'عام'} tone={privacy ? 'gold' : 'success'} />
        </Pressable>
        {message ? <Text style={styles.formMessage}>{message}</Text> : null}
        {route.params.mode === 'edit' && draft.id ? (
          <PrimaryButton
            title="حذف القضية"
            secondary
            onPress={async () => {
              if (!session?.token || !draft.id) return;
              setSaving(true);
              setMessage('');
              try {
                await deleteOfficeMatter({ token: session.token, orgId: session.orgId }, { id: draft.id });
                navigation.goBack();
              } catch (error) {
                setMessage(error instanceof Error ? error.message : 'تعذر حذف القضية.');
              } finally {
                setSaving(false);
              }
            }}
          />
        ) : null}
        <FormFooter saving={saving} onSubmit={submit} onCancel={() => navigation.goBack()} submitLabel={route.params.mode === 'edit' ? 'حفظ القضية' : 'إنشاء القضية'} />
      </Card>
    </Page>
  );
}

export function OfficeTaskFormScreen({ route, navigation }: OfficeTaskFormProps) {
  const { session } = useAuth();
  const draft = route.params.task ?? {};
  const { matterOptions } = useOfficeDirectory(session?.token);
  const [title, setTitle] = useState(String(draft.title ?? ''));
  const [description, setDescription] = useState(String(draft.description ?? ''));
  const [matterId, setMatterId] = useState(String(draft.matter_id ?? ''));
  const [matterQuery, setMatterQuery] = useState('');
  const [dueAt, setDueAt] = useState(String(draft.due_at ? String(draft.due_at).slice(0, 10) : ''));
  const [priority, setPriority] = useState<NonNullable<OfficeTaskWritePayload['priority']>>(draft.priority === 'low' || draft.priority === 'high' ? draft.priority : 'medium');
  const [status, setStatus] = useState<NonNullable<OfficeTaskWritePayload['status']>>(draft.status ?? 'todo');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  async function submit() {
    if (!session?.token) return;
    setSaving(true);
    setMessage('');
    try {
      const payload: OfficeTaskWritePayload = {
        title: title.trim(),
        description: description.trim() || null,
        matter_id: matterId.trim() || null,
        due_at: dueAt.trim() || null,
        priority,
        status,
      };
      const result = route.params.mode === 'edit' && draft.id
        ? await updateOfficeTask({ token: session.token, orgId: session.orgId }, { ...payload, id: draft.id })
        : await createOfficeTask({ token: session.token, orgId: session.orgId }, payload);
      setMessage(`تم حفظ المهمة: ${result.task.title}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'تعذر حفظ المهمة.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Page>
      <FormHeader
        eyebrow={route.params.mode === 'edit' ? 'تعديل مهمة' : 'مهمة جديدة'}
        title={route.params.mode === 'edit' ? 'تحديث مهمة قائمة' : 'إنشاء مهمة جديدة'}
        subtitle="المهام هنا مرتبطة فعليًا بنفس النظام الحالي وتظهر فورًا في الموقع."
        tone={route.params.mode === 'edit' ? 'warning' : 'success'}
      />
      <Card>
        <SectionTitle title="تفاصيل المهمة" />
        <Field label="عنوان المهمة" value={title} onChangeText={setTitle} placeholder="مثال: مراجعة الرد" />
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>الوصف</Text>
          <TextInput value={description} onChangeText={setDescription} placeholder="تفاصيل المهمة" placeholderTextColor={colors.textMuted} multiline style={styles.multiline} textAlign="right" />
        </View>
        <SelectionList
          label="القضية المرتبطة"
          selectedId={matterId}
          query={matterQuery}
          onQueryChange={setMatterQuery}
          onSelect={setMatterId}
          options={matterOptions}
          placeholder="ابحث أو اختر القضية"
        />
        <Field label="تاريخ الاستحقاق" value={dueAt} onChangeText={setDueAt} placeholder="YYYY-MM-DD" />
        <View style={styles.selectionListInline}>
          {(['low', 'medium', 'high'] as const).map((item) => (
            <Pressable key={item} onPress={() => setPriority(item)} style={[styles.typeChip, priority === item && styles.typeChipActive]}>
              <Text style={[styles.typeChipText, priority === item && styles.typeChipTextActive]}>{item}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.selectionListInline}>
          {(['todo', 'doing', 'done', 'canceled'] as const).map((item) => (
            <Pressable key={item} onPress={() => setStatus(item)} style={[styles.typeChip, status === item && styles.typeChipActive]}>
              <Text style={[styles.typeChipText, status === item && styles.typeChipTextActive]}>{item}</Text>
            </Pressable>
          ))}
        </View>
        {message ? <Text style={styles.formMessage}>{message}</Text> : null}
        {route.params.mode === 'edit' && draft.id ? (
          <PrimaryButton
            title="حذف المهمة"
            secondary
            onPress={async () => {
              if (!session?.token || !draft.id) return;
              setSaving(true);
              setMessage('');
              try {
                await deleteOfficeTask({ token: session.token, orgId: session.orgId }, { id: draft.id });
                navigation.goBack();
              } catch (error) {
                setMessage(error instanceof Error ? error.message : 'تعذر حذف المهمة.');
              } finally {
                setSaving(false);
              }
            }}
          />
        ) : null}
        <FormFooter saving={saving} onSubmit={submit} onCancel={() => navigation.goBack()} submitLabel={route.params.mode === 'edit' ? 'حفظ المهمة' : 'إنشاء المهمة'} />
      </Card>
    </Page>
  );
}

export function OfficeDocumentFormScreen({ route, navigation }: OfficeDocumentFormProps) {
  const { session } = useAuth();
  const draft = route.params.draft ?? {};
  const { clientOptions, matterOptions } = useOfficeDirectory(session?.token);
  const [title, setTitle] = useState(String(draft.title ?? ''));
  const [matterId, setMatterId] = useState(String(draft.matter_id ?? ''));
  const [clientId, setClientId] = useState(String(draft.client_id ?? ''));
  const [matterQuery, setMatterQuery] = useState('');
  const [clientQuery, setClientQuery] = useState('');
  const [folder, setFolder] = useState(String(draft.folder ?? '/'));
  const [tagsText, setTagsText] = useState(Array.isArray(draft.tags) ? draft.tags.join(', ') : String(draft.tags ?? ''));
  const [file, setFile] = useState<{ uri: string; name: string; mimeType?: string | null; size: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  async function pickFile() {
    const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false });
    if (result.canceled) return;
    const asset = result.assets[0];
    setFile({
      uri: asset.uri,
      name: asset.name,
      mimeType: asset.mimeType ?? null,
      size: asset.size ?? 0,
    });
  }

  async function submit() {
    if (!session?.token) return;
    setSaving(true);
    setMessage('');
    try {
      const result = await uploadOfficeDocumentFile({ token: session.token, orgId: session.orgId }, {
        title: title.trim(),
        matterId: matterId.trim() || null,
        clientId: clientId.trim() || null,
        folder: folder.trim() || '/',
        tags: tagsText
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
        file,
      });
      setMessage(result.uploaded ? `تم رفع المستند: ${result.document.title}` : `تم إنشاء المستند: ${result.document.title}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'تعذر حفظ المستند.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Page>
      <FormHeader
        eyebrow="مستند جديد"
        title="إنشاء أو رفع مستند"
        subtitle="المستندات يمكن رفعها الآن فعليًا عبر روابط التحميل الموقعة من نفس الموقع."
        tone="success"
      />
      <Card>
        <SectionTitle title="بيانات المستند" />
        <Field label="العنوان" value={title} onChangeText={setTitle} placeholder="اسم المستند" />
        <SelectionList
          label="القضية"
          selectedId={matterId}
          query={matterQuery}
          onQueryChange={setMatterQuery}
          onSelect={setMatterId}
          options={matterOptions}
          placeholder="ابحث أو اختر القضية"
        />
        <SelectionList
          label="العميل"
          selectedId={clientId}
          query={clientQuery}
          onQueryChange={setClientQuery}
          onSelect={setClientId}
          options={clientOptions}
          placeholder="ابحث أو اختر العميل"
        />
        <Field label="المجلد" value={folder} onChangeText={setFolder} placeholder="/contracts" />
        <Field label="الوسوم" value={tagsText} onChangeText={setTagsText} placeholder="agreement, urgent" />
        <Pressable onPress={pickFile} style={styles.filePicker}>
          <Text style={styles.rowTitle}>{file ? file.name : 'اختيار ملف من الجهاز'}</Text>
          <Text style={styles.rowMeta}>{file ? `${Math.round(file.size / 1024)} KB` : 'PDF أو صورة أو أي ملف مناسب'}</Text>
        </Pressable>
        {message ? <Text style={styles.formMessage}>{message}</Text> : null}
        <FormFooter saving={saving} onSubmit={submit} onCancel={() => navigation.goBack()} submitLabel="حفظ المستند" />
      </Card>
    </Page>
  );
}

export function OfficeBillingFormScreen({ route, navigation }: OfficeBillingFormProps) {
  const { session } = useAuth();
  const draft = route.params.draft ?? {};
  const { clientOptions, matterOptions } = useOfficeDirectory(session?.token);
  const [clientId, setClientId] = useState(String(draft.client_id ?? ''));
  const [matterId, setMatterId] = useState(String(draft.matter_id ?? ''));
  const [clientQuery, setClientQuery] = useState('');
  const [matterQuery, setMatterQuery] = useState('');
  const [items, setItems] = useState<OfficeBillingItem[]>(draft.items?.length ? draft.items : [{ desc: '', qty: 1, unit_price: 0 }]);
  const [taxEnabled, setTaxEnabled] = useState(false);
  const [tax, setTax] = useState('0');
  const [taxNumber, setTaxNumber] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  function updateItem(index: number, key: keyof OfficeBillingItem, value: string) {
    setItems((current) =>
      current.map((item, itemIndex) => {
        if (itemIndex !== index) return item;
        if (key === 'qty' || key === 'unit_price') {
          return { ...item, [key]: Number(value) || 0 };
        }
        return { ...item, [key]: value };
      }),
    );
  }

  async function submit(kind: 'quote' | 'invoice') {
    if (!session?.token) return;
    setSaving(true);
    setMessage('');
    try {
      if (kind === 'quote') {
        const result = await createOfficeQuote({ token: session.token, orgId: session.orgId }, {
          client_id: clientId.trim(),
          matter_id: matterId.trim() || null,
          items,
          tax_enabled: taxEnabled,
          tax: Number(tax) || 0,
          tax_number: taxNumber.trim() || null,
          status: 'draft',
        });
        setMessage(`تم إنشاء عرض السعر: ${result.number}`);
      } else {
        const result = await createOfficeInvoice({ token: session.token, orgId: session.orgId }, {
          client_id: clientId.trim(),
          matter_id: matterId.trim() || null,
          items,
          tax_enabled: taxEnabled,
          tax: Number(tax) || 0,
          tax_number: taxNumber.trim() || null,
          due_at: dueAt.trim() || null,
        });
        setMessage(`تم إنشاء الفاتورة: ${result.number}`);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'تعذر حفظ الفاتورة أو العرض.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Page>
      <FormHeader
        eyebrow={route.params.mode === 'quote' ? 'عرض سعر جديد' : 'فاتورة جديدة'}
        title={route.params.mode === 'quote' ? 'إنشاء عرض سعر' : 'إنشاء فاتورة'}
        subtitle="العروض والفواتير تُنشأ الآن مباشرة على نفس النظام المحاسبي المرتبط بالموقع."
        tone="gold"
      />
      <Card>
        <SectionTitle title="العميل والقضية" />
        <SelectionList
          label="العميل"
          selectedId={clientId}
          query={clientQuery}
          onQueryChange={setClientQuery}
          onSelect={setClientId}
          options={clientOptions}
          placeholder="اختر العميل"
        />
        <SelectionList
          label="القضية"
          selectedId={matterId}
          query={matterQuery}
          onQueryChange={setMatterQuery}
          onSelect={setMatterId}
          options={matterOptions}
          placeholder="اختر القضية (اختياري)"
        />
        <Field label="الرقم الضريبي" value={taxNumber} onChangeText={setTaxNumber} placeholder="اختياري" />
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>الضريبة</Text>
          <TextInput value={tax} onChangeText={setTax} placeholder="0" placeholderTextColor={colors.textMuted} keyboardType="numeric" style={styles.input} textAlign="right" />
        </View>
        <Pressable onPress={() => setTaxEnabled((current) => !current)} style={styles.toggleRow}>
          <Text style={styles.rowTitle}>تفعيل الضريبة</Text>
          <StatusChip label={taxEnabled ? 'مفعّل' : 'متوقف'} tone={taxEnabled ? 'success' : 'default'} />
        </Pressable>
        {route.params.mode === 'invoice' ? (
          <Field label="تاريخ الاستحقاق" value={dueAt} onChangeText={setDueAt} placeholder="YYYY-MM-DD" />
        ) : null}
      </Card>
      <Card>
        <SectionTitle title="بنود المحتوى" subtitle="أضف سطرًا واحدًا أو أكثر قبل الحفظ." />
        {items.map((item, index) => (
          <View key={`${index}-${item.desc}`} style={styles.itemBlock}>
            <Field label={`الوصف ${index + 1}`} value={item.desc} onChangeText={(value) => updateItem(index, 'desc', value)} placeholder="خدمة أو بند" />
            <Field label="الكمية" value={String(item.qty)} onChangeText={(value) => updateItem(index, 'qty', value)} placeholder="1" keyboardType="numeric" />
            <Field label="سعر الوحدة" value={String(item.unit_price)} onChangeText={(value) => updateItem(index, 'unit_price', value)} placeholder="0" keyboardType="numeric" />
          </View>
        ))}
        <PrimaryButton
          title="إضافة بند"
          secondary
          onPress={() => setItems((current) => [...current, { desc: '', qty: 1, unit_price: 0 }])}
        />
      </Card>
      <Card>
        {message ? <Text style={styles.formMessage}>{message}</Text> : null}
        <FormFooter
          saving={saving}
          onSubmit={() => submit(route.params.mode)}
          onCancel={() => navigation.goBack()}
          submitLabel={route.params.mode === 'quote' ? 'حفظ العرض' : 'حفظ الفاتورة'}
        />
      </Card>
    </Page>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.xl,
  },
  statsGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  summaryStrip: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  pillCard: {
    flex: 1,
    minWidth: 140,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  pillLabel: {
    color: colors.textMuted,
    fontFamily: fonts.arabicMedium,
    fontSize: 12,
    textAlign: 'right',
  },
  search: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 15,
    color: colors.text,
    fontFamily: fonts.arabicMedium,
    fontSize: 15,
  },
  list: {
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  listItem: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  rowCard: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    padding: spacing.md,
  },
  rowText: {
    flex: 1,
    gap: 4,
  },
  rowTitle: {
    color: colors.text,
    fontFamily: fonts.arabicBold,
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'right',
  },
  rowMeta: {
    color: colors.textMuted,
    fontFamily: fonts.arabicRegular,
    fontSize: 12,
    lineHeight: 20,
    textAlign: 'right',
  },
  rightMeta: {
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  error: {
    color: colors.danger,
    fontFamily: fonts.arabicMedium,
    fontSize: 13,
    lineHeight: 22,
    textAlign: 'right',
  },
  metaGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  metaItem: {
    flex: 1,
    minWidth: 140,
    gap: 4,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    padding: spacing.md,
  },
  metaLabel: {
    color: colors.textMuted,
    fontFamily: fonts.arabicMedium,
    fontSize: 12,
    textAlign: 'right',
  },
  metaValue: {
    color: colors.primary,
    fontFamily: fonts.arabicBold,
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'right',
  },
  timelineItem: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.gold,
    marginTop: 8,
  },
  timelineText: {
    flex: 1,
    gap: 4,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  body: {
    color: colors.text,
    fontFamily: fonts.arabicRegular,
    fontSize: 13,
    lineHeight: 22,
    textAlign: 'right',
  },
  field: {
    gap: spacing.sm,
  },
  fieldLabel: {
    color: colors.text,
    fontFamily: fonts.arabicSemiBold,
    fontSize: 13,
    textAlign: 'right',
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 15,
    color: colors.text,
    fontFamily: fonts.arabicMedium,
    fontSize: 15,
  },
  quickActionsGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  segmentedTabs: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  segmentTab: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  segmentTabActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  segmentTabLabel: {
    color: colors.primary,
    fontFamily: fonts.arabicSemiBold,
    fontSize: 12,
    textAlign: 'right',
  },
  segmentTabLabelActive: {
    color: '#fffaf2',
  },
  calendarDayCard: {
    gap: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    padding: spacing.md,
  },
  calendarDayHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  calendarDayTitle: {
    color: colors.primary,
    fontFamily: fonts.arabicBold,
    fontSize: 15,
    lineHeight: 24,
    textAlign: 'right',
  },
  calendarDayList: {
    gap: spacing.sm,
  },
  calendarEntry: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  actionTile: {
    flex: 1,
    minWidth: 140,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    padding: spacing.md,
    gap: 4,
  },
  actionTileTitle: {
    color: colors.primary,
    fontFamily: fonts.arabicBold,
    fontSize: 14,
    textAlign: 'right',
  },
  actionTileMeta: {
    color: colors.textMuted,
    fontFamily: fonts.arabicRegular,
    fontSize: 12,
    textAlign: 'right',
  },
  formMessage: {
    color: colors.primary,
    fontFamily: fonts.arabicMedium,
    fontSize: 13,
    lineHeight: 22,
    textAlign: 'right',
  },
  formBlock: {
    gap: spacing.md,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  formTitle: {
    color: colors.primary,
    fontFamily: fonts.arabicBold,
    fontSize: 15,
    textAlign: 'right',
  },
  formFooter: {
    gap: spacing.sm,
    paddingTop: spacing.sm,
  },
  typeRow: {
    flexDirection: 'row-reverse',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  typeChip: {
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  typeChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  typeChipText: {
    color: colors.primary,
    fontFamily: fonts.arabicSemiBold,
    fontSize: 12,
    textAlign: 'right',
  },
  typeChipTextActive: {
    color: '#fffaf2',
  },
  multiline: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 15,
    color: colors.text,
    fontFamily: fonts.arabicMedium,
    fontSize: 15,
    minHeight: 96,
    textAlign: 'right',
    textAlignVertical: 'top',
  },
  selectionBlock: {
    gap: spacing.sm,
  },
  selectionList: {
    gap: spacing.sm,
  },
  selectionListInline: {
    flexDirection: 'row-reverse',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  selectionItem: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
  },
  toggleRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    padding: spacing.md,
  },
  filePicker: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    padding: spacing.md,
  },
  controlRow: {
    gap: spacing.sm,
  },
  controlRowMain: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    padding: spacing.md,
  },
  inlineActionRow: {
    flexDirection: 'row-reverse',
    gap: spacing.sm,
    justifyContent: 'flex-end',
  },
  inlineAction: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  inlineActionText: {
    color: colors.primary,
    fontFamily: fonts.arabicSemiBold,
    fontSize: 12,
    textAlign: 'right',
  },
  itemBlock: {
    gap: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    padding: spacing.md,
  },
  signOutButton: {
    marginTop: spacing.sm,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  accountActionsRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  adminSwitchButton: {
    backgroundColor: colors.surfaceMuted,
  },
  signOutText: {
    color: colors.danger,
    fontFamily: fonts.arabicBold,
    fontSize: 14,
  },
  adminSwitchText: {
    color: colors.primary,
  },
});
