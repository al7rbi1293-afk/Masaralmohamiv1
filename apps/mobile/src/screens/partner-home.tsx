import { Linking, Pressable, Share, Text, View } from 'react-native';
import { EmptyState, HeroCard, LoadingBlock, Page, StatCard, StatusChip } from '../components/ui';
import { formatCurrency, formatDate, formatDateTime, formatShortNumber } from '../lib/format';
import { PartnerActionButton, PartnerActivityItem, PartnerKeyValue, PartnerProgressRow, PartnerSection } from '../features/partner/components';
import { usePartnerOverview } from '../features/partner/hooks';
import {
  LedgerRow,
  SummaryPill,
  commissionLabel,
  commissionTone,
  leadTone,
  payoutLabel,
  payoutTone,
  styles,
} from './partner-shared';

export function PartnerHomeScreen() {
  const { data, loading, error, refresh } = usePartnerOverview();

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
        <EmptyState title="تعذر تحميل البوابة" message={error || 'لا توجد بيانات شريك متاحة.'} />
      </Page>
    );
  }

  return (
    <Page>
      <HeroCard
        eyebrow={data.partner.partner_code}
        title={data.user.full_name || data.partner.full_name || 'شريك النجاح'}
        subtitle={`متابعة الإحالات والعمولات والدفعات من نفس النظام. معدل التحويل الحالي ${formatShortNumber(data.kpis.conversion_rate)}%.`}
        aside={
          <View style={styles.heroBadges}>
            <StatusChip label={data.partner.is_active ? 'نشط' : 'موقوف'} tone={data.partner.is_active ? 'success' : 'danger'} />
            <StatusChip label={`${data.partner.commission_rate_partner}% عمولة`} tone="gold" />
          </View>
        }
      />

      <View style={styles.stats}>
        <StatCard label="الزيارات" value={formatShortNumber(data.kpis.clicks)} />
        <StatCard label="العملاء المحتملون" value={formatShortNumber(data.kpis.leads)} />
        <StatCard label="الاشتراكات" value={formatShortNumber(data.kpis.subscribed)} tone="success" />
        <StatCard
          label="إجمالي العمولات"
          value={formatCurrency(data.kpis.total_commission, data.kpis.commission_currency)}
          tone="gold"
        />
      </View>

      <PartnerSection
        title="رابط الإحالة"
        subtitle="شاركه مباشرة مع أي جهة تريد أن تسوق لها، وسيبقى القياس مرتبطًا بك."
        action={<Pressable onPress={refresh}><Text style={styles.sectionAction}>تحديث</Text></Pressable>}
      >
        <PartnerKeyValue label="الكود" value={data.partner.partner_code} mono />
        <PartnerKeyValue label="الرابط" value={data.partner.referral_link} mono />
        <View style={styles.actionRow}>
          <PartnerActionButton title="مشاركة" onPress={() => void Share.share({ message: data.partner.referral_link })} />
          <PartnerActionButton title="فتح الرابط" secondary onPress={() => void Linking.openURL(data.partner.referral_link)} />
        </View>
      </PartnerSection>

      <PartnerSection title="قناة التحويل" subtitle="من الزيارة إلى الاشتراك المؤهل على نفس الحساب">
        {data.funnel.map((item) => (
          <PartnerProgressRow
            key={item.status}
            label={item.label}
            count={item.count}
            total={Math.max(data.kpis.clicks, data.kpis.leads, 1)}
            tone={leadTone(item.status)}
          />
        ))}
        <View style={styles.summaryStrip}>
          <SummaryPill label="التسجيلات" value={String(data.kpis.signed_up)} tone="success" />
          <SummaryPill label="التجارب" value={String(data.kpis.trial_started)} tone="warning" />
          <SummaryPill label="المشتركون" value={String(data.kpis.subscribed)} tone="gold" />
        </View>
      </PartnerSection>

      <PartnerSection title="النشاط الأخير" subtitle="أحدث التفاعلات من النقرات إلى الاشتراكات والدفعات">
        {data.activity.length ? (
          data.activity.slice(0, 6).map((item) => (
            <PartnerActivityItem
              key={item.id}
              title={item.title}
              subtitle={item.subtitle}
              timestamp={formatDateTime(item.created_at)}
              tone={item.tone}
            />
          ))
        ) : (
          <EmptyState title="لا يوجد نشاط بعد" message="ستظهر هنا أحداث الإحالة والعمولة والدفعات عندما تبدأ الحركة." />
        )}
      </PartnerSection>

      <PartnerSection title="الدفعات الأخيرة" subtitle="ملخص مختصر لآخر الدفعات الصادرة لك">
        {data.recent_payouts.length ? (
          data.recent_payouts.slice(0, 3).map((payout) => (
            <LedgerRow
              key={payout.id}
              title={formatCurrency(payout.total_amount, data.kpis.commission_currency)}
              subtitle={[
                payout.reference_number || 'بدون مرجع',
                payout.payout_method || 'طريقة غير محددة',
                formatDate(payout.created_at),
              ]
                .filter(Boolean)
                .join(' · ')}
              tone={payoutTone(payout.status)}
              status={payoutLabel(payout.status)}
            />
          ))
        ) : (
          <EmptyState title="لا توجد دفعات" message="ستظهر هنا كل دفعة صادرة للشريك عند اعتمادها." />
        )}
      </PartnerSection>
    </Page>
  );
}

export function PartnerCommissionsScreen() {
  const { data, loading, error, refresh } = usePartnerOverview();

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
        <EmptyState title="تعذر تحميل العمولات" message={error || 'لا توجد بيانات متاحة حالياً.'} />
      </Page>
    );
  }

  return (
    <Page>
      <HeroCard
        eyebrow={data.partner.partner_code}
        title="لوحة العمولات"
        subtitle="قراءة سريعة للعمولات المستحقة والمدفوعة والدفعات المرتبطة بها."
        aside={
          <View style={styles.heroBadges}>
            <StatusChip label={`${formatCurrency(data.kpis.total_commission, data.kpis.commission_currency)}`} tone="gold" />
            <StatusChip label={`${formatShortNumber(data.kpis.conversion_rate)}% تحويل`} tone="success" />
          </View>
        }
      />

      <View style={styles.stats}>
        <StatCard label="مدفوعة" value={formatCurrency(data.kpis.paid_commission, data.kpis.commission_currency)} tone="success" />
        <StatCard label="مستحقة" value={formatCurrency(data.kpis.payable_commission, data.kpis.commission_currency)} tone="gold" />
        <StatCard label="قيد المراجعة" value={formatCurrency(data.kpis.pending_commission, data.kpis.commission_currency)} />
        <StatCard label="إجمالي الدفعات" value={formatCurrency(data.kpis.payout_total, data.kpis.commission_currency)} tone="gold" />
      </View>

      <PartnerSection
        title="سجل العمولات"
        subtitle="كل حركة عمولة مؤهلة أو مسترجعة تظهر هنا حسب نفس البيانات الأساسية."
        action={<Pressable onPress={refresh}><Text style={styles.sectionAction}>تحديث</Text></Pressable>}
      >
        {data.recent_commissions.length ? (
          data.recent_commissions.slice(0, 8).map((commission) => (
            <LedgerRow
              key={commission.id}
              title={formatCurrency(commission.partner_amount, commission.currency)}
              subtitle={[
                commission.payment_id || 'بدون مرجع',
                commission.notes || 'لا توجد ملاحظات',
                formatDate(commission.created_at),
              ]
                .filter(Boolean)
                .join(' · ')}
              tone={commissionTone(commission.status)}
              status={commissionLabel(commission.status)}
            />
          ))
        ) : (
          <EmptyState title="لا توجد عمولات" message="سيظهر سجل العمولات بعد تسجيل أول إحالة مدفوعة مؤهلة." />
        )}
      </PartnerSection>

      <PartnerSection title="الدفعات" subtitle="حالة الصرف الفعلية والمبالغ المتبقية">
        {data.recent_payouts.length ? (
          data.recent_payouts.slice(0, 8).map((payout) => (
            <LedgerRow
              key={payout.id}
              title={formatCurrency(payout.total_amount, data.kpis.commission_currency)}
              subtitle={[
                payout.reference_number || 'بدون مرجع',
                payout.payout_method || 'طريقة غير محددة',
                formatDate(payout.created_at),
              ]
                .filter(Boolean)
                .join(' · ')}
              tone={payoutTone(payout.status)}
              status={payoutLabel(payout.status)}
            />
          ))
        ) : (
          <EmptyState title="لا توجد دفعات" message="سجل الدفعات سيظهر هنا بمجرد بدء اعتماد الصرف." />
        )}
      </PartnerSection>

      <PartnerSection title="الفجوة الحالية" subtitle="كمية الدخل المؤهل التي ما زالت تحتاج معالجة">
        <View style={styles.summaryStrip}>
          <SummaryPill label="المدفوع" value={formatCurrency(data.kpis.paid_commission, data.kpis.commission_currency)} tone="success" />
          <SummaryPill label="المتاح" value={formatCurrency(data.kpis.payable_commission, data.kpis.commission_currency)} tone="gold" />
          <SummaryPill label="قيد المراجعة" value={formatCurrency(data.kpis.pending_commission, data.kpis.commission_currency)} tone="warning" />
        </View>
      </PartnerSection>
    </Page>
  );
}
