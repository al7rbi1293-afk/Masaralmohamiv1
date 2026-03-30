import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import {
  Card,
  EmptyState,
  HeroCard,
  LoadingBlock,
  Page,
  SectionTitle,
  StatCard,
  StatusChip,
} from '../components/ui';
import { useAuth } from '../context/auth-context';
import { fetchOfficeOverview, type OfficeOverviewResponse } from '../features/office/api';
import { formatCurrency, formatDate } from '../lib/format';
import { styles } from './office.styles';
import { billingTone, officeRoleLabel, taskTone } from './office.utils';
import { SummaryRow } from './office';

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
