import { Pressable, Text, View } from 'react-native';
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
import { formatCurrency, formatDate, formatDateTime } from '../lib/format';
import {
  QuickButton,
  SummaryRow,
  notificationTone,
  statusTone,
  styles,
  useClientOverviewData,
} from './client-shared';

export function ClientHomeScreen({ navigation }: { navigation: any }) {
  const { data, loading, error } = useClientOverviewData();

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
        <EmptyState title="تعذر تحميل البوابة" message={error || 'لا توجد بيانات متاحة حالياً.'} />
      </Page>
    );
  }

  const featuredMatter = data.bootstrap.matters[0];

  return (
    <Page>
      <HeroCard
        eyebrow={`مرحباً ${data.bootstrap.client.name}`}
        title="بوابة العميل"
        subtitle="متابعة القضايا، المستندات، الفواتير، والعروض من نفس نظام المكتب وبواجهة أوضح لك."
        aside={<StatusChip label={`${data.bootstrap.counts.matters} قضايا`} tone="gold" />}
      />

      <View style={styles.stats}>
        <StatCard label="القضايا" value={String(data.bootstrap.counts.matters)} />
        <StatCard label="الفواتير" value={String(data.bootstrap.counts.invoices)} tone="gold" />
        <StatCard label="العروض" value={String(data.bootstrap.counts.quotes)} />
        <StatCard label="الرصيد المستحق" value={formatCurrency(data.bootstrap.counts.outstanding_balance)} tone="success" />
      </View>

      <Card>
        <SectionTitle title="إجراءات سريعة" subtitle="أهم ما قد تحتاجه الآن." />
        <View style={styles.actionRow}>
          <QuickButton title="قضاياي" onPress={() => navigation.navigate('ClientMatters')} />
          <QuickButton title="الخدمات" secondary onPress={() => navigation.navigate('ClientCenter')} />
        </View>
      </Card>

      {featuredMatter ? (
        <Pressable onPress={() => navigation.navigate('ClientMatterDetails', { matter: featuredMatter })}>
          <Card>
            <SectionTitle title="الخطوة القادمة" subtitle="آخر ملف يحتاج انتباهك أو يحتوي على تحديث." />
            <StatusChip label={featuredMatter.status} tone={statusTone(featuredMatter.status)} />
            <Text style={styles.title}>{featuredMatter.title}</Text>
            <Text style={styles.body}>{featuredMatter.summary || 'لا يوجد ملخص إضافي في الوقت الحالي.'}</Text>
            <Text style={styles.meta}>آخر تحديث: {formatDate(featuredMatter.updated_at)}</Text>
          </Card>
        </Pressable>
      ) : null}

      <Card>
        <SectionTitle title="آخر الإشعارات" subtitle="مستجدات القضايا والفواتير والمستندات." />
        {data.notifications.length ? (
          data.notifications.slice(0, 4).map((item) => (
            <SummaryRow
              key={item.id}
              title={item.title}
              subtitle={[item.body, formatDateTime(item.created_at)].filter(Boolean).join(' · ')}
              status={item.kind}
              tone={notificationTone(item.kind)}
            />
          ))
        ) : (
          <EmptyState title="لا توجد إشعارات" message="ستظهر هنا آخر المستجدات القادمة من المكتب." />
        )}
      </Card>

      <Card>
        <SectionTitle title="الملخص المالي" subtitle="آخر الفواتير وعروض الأسعار." />
        {data.bootstrap.invoices.slice(0, 2).map((invoice) => (
          <SummaryRow
            key={invoice.id}
            title={`فاتورة ${invoice.number}`}
            subtitle={[
              invoice.matter_title || 'بدون قضية',
              `المتبقي ${formatCurrency(invoice.remaining_amount, invoice.currency || 'SAR')}`,
            ].join(' · ')}
            status={invoice.status}
            tone={statusTone(invoice.status)}
          />
        ))}
        {data.bootstrap.quotes.slice(0, 2).map((quote) => (
          <SummaryRow
            key={quote.id}
            title={`عرض ${quote.number}`}
            subtitle={[
              quote.matter_title || 'بدون قضية',
              formatCurrency(quote.total, quote.currency || 'SAR'),
            ].join(' · ')}
            status={quote.status}
            tone={statusTone(quote.status)}
          />
        ))}
        {!data.bootstrap.invoices.length && !data.bootstrap.quotes.length ? (
          <EmptyState title="لا توجد حركة مالية" message="لا توجد فواتير أو عروض أسعار مرتبطة بحسابك حالياً." />
        ) : null}
      </Card>
    </Page>
  );
}
