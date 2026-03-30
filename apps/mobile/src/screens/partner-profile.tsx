import { Alert, Linking, Pressable, Share, Text, View } from 'react-native';
import { EmptyState, HeroCard, LoadingBlock, Page, StatCard, StatusChip } from '../components/ui';
import { useAuth } from '../context/auth-context';
import { requestSignedInAccountDeletion } from '../lib/api';
import { formatCurrency, formatDate, formatDateTime, formatShortNumber } from '../lib/format';
import { openPrivacyPolicy, openSupportPage, openTermsOfService } from '../lib/legal-links';
import { PartnerActionButton, PartnerActivityItem, PartnerKeyValue, PartnerSection } from '../features/partner/components';
import { usePartnerOverview } from '../features/partner/hooks';
import { LedgerRow, styles } from './partner-shared';

export function PartnerProfileScreen() {
  const { data, loading, error, refresh } = usePartnerOverview();
  const { session, signOut } = useAuth();

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
        <PartnerActionButton title="مشاركة الرابط" onPress={() => void Share.share({ message: data.partner.referral_link })} />
        <PartnerActionButton title="فتح الرابط" secondary onPress={() => void Linking.openURL(data.partner.referral_link)} />
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
        <View style={styles.actionRow}>
          <PartnerActionButton title="الدعم" onPress={() => void openSupportPage()} secondary />
          <PartnerActionButton title="الشروط" onPress={() => void openTermsOfService()} secondary />
        </View>
        <View style={styles.actionRow}>
          <PartnerActionButton title="الخصوصية" onPress={() => void openPrivacyPolicy()} secondary />
          <PartnerActionButton
            title="طلب حذف الحساب"
            secondary
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
                          Alert.alert('تم الإرسال', response.message || 'تم إرسال طلب حذف الحساب.');
                        })
                        .catch((nextError) => {
                          Alert.alert('تعذر الإرسال', nextError instanceof Error ? nextError.message : 'تعذر إرسال الطلب.');
                        });
                    },
                  },
                ],
              )
            }
          />
        </View>
        <Pressable onPress={() => void signOut()} style={styles.signOutButton}>
          <Text style={styles.signOutText}>تسجيل الخروج</Text>
        </Pressable>
      </PartnerSection>
    </Page>
  );
}
