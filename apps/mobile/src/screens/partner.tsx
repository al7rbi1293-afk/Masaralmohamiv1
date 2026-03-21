import { Linking, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { Card, EmptyState, HeroCard, LoadingBlock, Page, SectionTitle, StatCard, StatusChip } from '../components/ui';
import { formatCurrency, formatDate, formatDateTime, formatShortNumber } from '../lib/format';
import { colors, fonts, radius, spacing } from '../theme';
import { useAuth } from '../context/auth-context';
import { PartnerActionButton, PartnerActivityItem, PartnerKeyValue, PartnerProgressRow, PartnerSection } from '../features/partner/components';
import { usePartnerOverview } from '../features/partner/hooks';
import type { PartnerCommissionStatus, PartnerLeadStatus, PartnerPayoutStatus } from '../features/partner/types';

function leadTone(status: PartnerLeadStatus) {
  if (status === 'subscribed') return 'gold' as const;
  if (status === 'trial_started') return 'warning' as const;
  if (status === 'signed_up') return 'success' as const;
  if (status === 'cancelled') return 'danger' as const;
  return 'default' as const;
}

function commissionTone(status: PartnerCommissionStatus) {
  if (status === 'paid') return 'success' as const;
  if (status === 'approved' || status === 'payable') return 'warning' as const;
  if (status === 'reversed') return 'danger' as const;
  return 'gold' as const;
}

function payoutTone(status: PartnerPayoutStatus) {
  if (status === 'paid') return 'success' as const;
  if (status === 'processing') return 'warning' as const;
  if (status === 'pending') return 'gold' as const;
  if (status === 'failed' || status === 'cancelled') return 'danger' as const;
  return 'default' as const;
}

function commissionLabel(status: PartnerCommissionStatus) {
  switch (status) {
    case 'pending':
      return 'قيد المراجعة';
    case 'approved':
      return 'معتمدة';
    case 'payable':
      return 'مستحقة';
    case 'paid':
      return 'مدفوعة';
    case 'reversed':
      return 'مسترجعة';
    default:
      return status;
  }
}

function payoutLabel(status: PartnerPayoutStatus) {
  switch (status) {
    case 'pending':
      return 'بانتظار الصرف';
    case 'processing':
      return 'جاري الصرف';
    case 'paid':
      return 'تم الصرف';
    case 'failed':
      return 'فشل';
    case 'cancelled':
      return 'ملغاة';
    default:
      return status;
  }
}

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
          <PartnerActionButton
            title="مشاركة"
            onPress={() => void Share.share({ message: data.partner.referral_link })}
          />
          <PartnerActionButton
            title="فتح الرابط"
            secondary
            onPress={() => void Linking.openURL(data.partner.referral_link)}
          />
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

export function PartnerProfileScreen() {
  const { data, loading, error, refresh } = usePartnerOverview();
  const { signOut } = useAuth();

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
        <EmptyState title="تعذر تحميل الحساب" message={error || 'لا توجد بيانات متاحة حالياً.'} />
      </Page>
    );
  }

  return (
    <Page>
      <HeroCard
        eyebrow="حساب الشريك"
        title={data.user.full_name || data.partner.full_name || 'شريك النجاح'}
        subtitle="معلومات الحساب، أذون الوصول، وحالة البرنامج في مكان واحد."
        aside={
          <View style={styles.heroBadges}>
            <StatusChip label={data.partner.is_active ? 'مفعل' : 'متوقف'} tone={data.partner.is_active ? 'success' : 'danger'} />
            <StatusChip label={formatDate(data.partner.approved_at || data.partner.created_at)} tone="gold" />
          </View>
        }
      />

      <PartnerSection
        title="بيانات الحساب"
        subtitle="هذه البيانات تعتمد على نفس سجل الشريك المرتبط بحسابك"
        action={<Pressable onPress={refresh}><Text style={styles.sectionAction}>تحديث</Text></Pressable>}
      >
        <PartnerKeyValue label="الكود" value={data.partner.partner_code} mono />
        <PartnerKeyValue label="البريد" value={data.user.email || data.partner.email || '—'} />
        <PartnerKeyValue label="الجوال" value={data.user.phone || data.partner.whatsapp_number || '—'} mono />
        <PartnerKeyValue label="الرابط" value={data.partner.referral_link} mono />
        <PartnerKeyValue label="نسبة العمولة" value={`${data.partner.commission_rate_partner}%`} />
        <PartnerKeyValue label="نسبة التسويق" value={`${data.partner.commission_rate_marketing}%`} />
      </PartnerSection>

      <View style={styles.actionRow}>
        <PartnerActionButton
          title="مشاركة الرابط"
          onPress={() => void Share.share({ message: data.partner.referral_link })}
        />
        <PartnerActionButton
          title="فتح الرابط"
          secondary
          onPress={() => void Linking.openURL(data.partner.referral_link)}
        />
      </View>

      <PartnerSection title="ملخص الأداء" subtitle="نفس لوحة الشريك لكن بقراءة مختصرة">
        <View style={styles.stats}>
          <StatCard label="الزيارات" value={formatShortNumber(data.kpis.clicks)} />
          <StatCard label="العملاء" value={formatShortNumber(data.kpis.leads)} />
          <StatCard label="الاشتراكات" value={formatShortNumber(data.kpis.subscribed)} tone="success" />
          <StatCard label="الإجمالي" value={formatCurrency(data.kpis.total_commission, data.kpis.commission_currency)} tone="gold" />
        </View>
      </PartnerSection>

      <PartnerSection title="النشاط الأخير" subtitle="أحدث الأحداث المرتبطة بحسابك">
        {data.activity.length ? (
          data.activity.slice(0, 10).map((item) => (
            <PartnerActivityItem
              key={item.id}
              title={item.title}
              subtitle={item.subtitle}
              timestamp={formatDateTime(item.created_at)}
              tone={item.tone}
            />
          ))
        ) : (
          <EmptyState title="لا يوجد نشاط" message="ستظهر هنا الإحالات والدفعات والعمولات عند حدوثها." />
        )}
      </PartnerSection>

      <PartnerSection title="الدعم" subtitle="لو احتجت شيئًا، نبدأ من هنا">
        <LedgerRow
          title="البرنامج"
          subtitle={`شريك نجاح بنسبة ${data.partner.commission_rate_partner}%`}
          tone="gold"
          status="تسويق بالعمولة"
        />
        <LedgerRow
          title="الوصول"
          subtitle={data.partner.is_active ? 'الحساب مفعل وجاهز' : 'الحساب بحاجة مراجعة'}
          tone={data.partner.is_active ? 'success' : 'danger'}
          status={data.partner.is_active ? 'نشط' : 'موقوف'}
        />
        <Pressable onPress={() => void signOut()} style={styles.signOutButton}>
          <Text style={styles.signOutText}>تسجيل الخروج</Text>
        </Pressable>
      </PartnerSection>
    </Page>
  );
}

function LedgerRow({
  title,
  subtitle,
  tone,
  status,
}: {
  title: string;
  subtitle: string;
  tone: 'default' | 'success' | 'warning' | 'danger' | 'gold';
  status: string;
}) {
  return (
    <View style={styles.ledgerRow}>
      <View style={styles.ledgerText}>
        <Text style={styles.ledgerTitle}>{title}</Text>
        <Text style={styles.ledgerSubtitle}>{subtitle}</Text>
      </View>
      <StatusChip label={status} tone={tone} />
    </View>
  );
}

function SummaryPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'default' | 'success' | 'warning' | 'danger' | 'gold';
}) {
  return (
    <View style={styles.summaryPill}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <StatusChip label={value} tone={tone} />
    </View>
  );
}

const styles = StyleSheet.create({
  heroBadges: {
    gap: spacing.sm,
  },
  stats: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  actionRow: {
    flexDirection: 'row-reverse',
    gap: spacing.md,
  },
  sectionAction: {
    color: colors.primary,
    fontFamily: fonts.arabicBold,
    fontSize: 12,
  },
  ledgerRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  ledgerText: {
    flex: 1,
    gap: 4,
  },
  ledgerTitle: {
    color: colors.text,
    fontFamily: fonts.arabicBold,
    fontSize: 15,
    textAlign: 'right',
  },
  ledgerSubtitle: {
    color: colors.textMuted,
    fontFamily: fonts.arabicRegular,
    fontSize: 12,
    lineHeight: 19,
    textAlign: 'right',
  },
  summaryStrip: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  summaryPill: {
    minWidth: 120,
    flex: 1,
    gap: 6,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
  },
  summaryLabel: {
    color: colors.textMuted,
    fontFamily: fonts.arabicMedium,
    fontSize: 12,
    textAlign: 'right',
  },
  signOutButton: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  signOutText: {
    color: colors.danger,
    fontFamily: fonts.arabicBold,
    fontSize: 14,
  },
});
