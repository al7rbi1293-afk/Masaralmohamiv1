import { useEffect, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  type AdminActivationRequest,
  type AdminLead,
  type AdminRequestItem,
  fetchAdminRequests,
  reviewAdminRequest,
} from '../features/admin/api';
import {
  AdminRequestCard,
  AdminRouteCard,
  adminEntries,
  compactText,
  formatDateTime,
} from './admin-shared';
import {
  Card,
  EmptyState,
  HeroCard,
  Page,
  PrimaryButton,
  SectionTitle,
  SegmentedControl,
  StatCard,
  StatusChip,
} from '../components/ui';
import { useAuth } from '../context/auth-context';
import { fetchAdminBootstrap, requestSignedInAccountDeletion, type AdminBootstrap } from '../lib/api';
import { openPrivacyPolicy, openSupportPage, openTermsOfService } from '../lib/legal-links';
import { styles } from './admin.styles';

export type AdminStackParamList = {
  AdminHome: undefined;
  AdminRequests: undefined;
  AdminUsers: undefined;
  AdminOrgs: undefined;
  AdminAudit: undefined;
};

export function AdminHomeScreen() {
  const navigation = useNavigation<any>();
  const { session, signOut, switchPortal } = useAuth();
  const [message, setMessage] = useState('');
  const [bootstrap, setBootstrap] = useState<AdminBootstrap | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!session?.token) {
        if (mounted) setLoading(false);
        return;
      }

      try {
        const payload = await fetchAdminBootstrap(session.token);
        if (mounted) setBootstrap(payload);
      } catch (error) {
        if (mounted) setMessage(error instanceof Error ? error.message : 'تعذر تحميل لوحة الإدارة.');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void load();
    return () => {
      mounted = false;
    };
  }, [session?.token]);

  function confirmSignOut() {
    Alert.alert('تسجيل الخروج', 'هل تريد إنهاء جلسة الإدارة الحالية؟', [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'تسجيل الخروج', style: 'destructive', onPress: () => void signOut() },
    ]);
  }

  async function handleSwitchToOffice() {
    try {
      await switchPortal('office');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'تعذر الانتقال إلى مساحة المكتب.');
    }
  }

  async function handleSwitchToPartner() {
    try {
      await switchPortal('partner');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'تعذر الانتقال إلى بوابة الشريك.');
    }
  }

  return (
    <Page>
      <HeroCard
        eyebrow="إدارة النظام"
        title="لوحة الإدارة"
        subtitle="إدارة المكاتب والمستخدمين والطلبات من داخل التطبيق."
        aside={
          <View style={styles.heroBadges}>
            <StatusChip label="صلاحيات عليا" tone="danger" />
            <StatusChip label={session?.email || '—'} tone="gold" />
          </View>
        }
      />

      <Card>
        <SectionTitle title="نظرة عامة" subtitle="ملخص مباشر لحالة النظام." />
        {loading ? (
          <Text style={styles.message}>جارٍ تحميل إحصاءات الإدارة...</Text>
        ) : bootstrap ? (
          <View style={styles.statsGrid}>
            <StatCard label="المكاتب النشطة" value={String(bootstrap.stats.active_orgs)} tone="danger" />
            <StatCard label="المستخدمون" value={String(bootstrap.stats.active_users)} tone="gold" />
            <StatCard label="الشركاء" value={String(bootstrap.stats.partners)} tone="success" />
            <StatCard label="الطلبات المعلقة" value={String(bootstrap.stats.pending_requests)} tone="warning" />
          </View>
        ) : (
          <EmptyState title="تعذر تحميل الإحصاءات" message="أعد المحاولة أو انتقل مباشرة إلى أحد الأقسام أدناه." />
        )}
      </Card>

      <Card>
        <SectionTitle title="أقسام الإدارة" subtitle="كل قسم يفتح داخل التطبيق نفسه." />
        <View style={styles.entries}>
          {adminEntries.map((entry) => (
            <AdminRouteCard key={entry.route} entry={entry} onPress={() => navigation.navigate(entry.route)} />
          ))}
        </View>
      </Card>

      <Card>
        <SectionTitle title="التنقل بين البوابات" subtitle="انتقل بين الصلاحيات المتاحة لنفس الحساب." />
        <View style={styles.buttonRow}>
          {session?.hasOfficeAccess ? (
            <PrimaryButton title="الانتقال إلى المكتب" onPress={() => void handleSwitchToOffice()} secondary />
          ) : null}
          {session?.hasPartnerAccess ? (
            <PrimaryButton title="الانتقال إلى الشريك" onPress={() => void handleSwitchToPartner()} secondary />
          ) : null}
        </View>
        {message ? <Text style={styles.message}>{message}</Text> : null}
      </Card>

      <Card>
        <SectionTitle title="جلسة الإدارة" subtitle="إنهاء الجلسة الحالية من هذا الجهاز." />
        <View style={styles.accountBlock}>
          <Text style={styles.accountLabel}>البريد</Text>
          <Text style={styles.accountValue}>{session?.email || '—'}</Text>
          <Text style={styles.accountLabel}>المسار الافتراضي</Text>
          <Text style={styles.accountValue}>{bootstrap?.role.default_path || session?.defaultPath || '/admin'}</Text>
        </View>
        <View style={styles.buttonRow}>
          <PrimaryButton title="الدعم" onPress={() => void openSupportPage()} secondary />
          <PrimaryButton title="الشروط" onPress={() => void openTermsOfService()} secondary />
        </View>
        <View style={styles.buttonRow}>
          <PrimaryButton title="الخصوصية" onPress={() => void openPrivacyPolicy()} secondary />
          <PrimaryButton
            title="طلب حذف الحساب"
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
                          setMessage(response.message || 'تم إرسال طلب حذف الحساب.');
                        })
                        .catch((nextError) => {
                          setMessage(nextError instanceof Error ? nextError.message : 'تعذر إرسال الطلب.');
                        });
                    },
                  },
                ],
              )
            }
            secondary
          />
        </View>
        <View style={styles.signOutWrap}>
          <Pressable onPress={confirmSignOut} style={styles.signOutButton}>
            <Text style={styles.signOutText}>تسجيل الخروج</Text>
          </Pressable>
        </View>
      </Card>
    </Page>
  );
}

export function AdminRequestsScreen() {
  const { session } = useAuth();
  const [tab, setTab] = useState<'subscription' | 'activation' | 'leads'>('subscription');
  const [payload, setPayload] = useState<AdminRequestsPayloadLike | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionId, setActionId] = useState<string | null>(null);

  async function load() {
    if (!session?.token) return;
    setLoading(true);
    setError('');
    try {
      const data = await fetchAdminRequests(session.token);
      setPayload(data);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'تعذر تحميل الطلبات.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [session?.token]);

  async function handleAction(item: AdminRequestItem, action: 'approve' | 'reject') {
    if (!session?.token) return;
    const label = action === 'approve' ? 'قبول' : 'رفض';
    Alert.alert(label, `هل تريد ${label} هذا الطلب؟`, [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: label,
        style: action === 'reject' ? 'destructive' : 'default',
        onPress: () => {
          setActionId(item.id);
          void reviewAdminRequest(session.token!, {
            id: item.id,
            action,
            request_kind: item.request_kind,
          })
            .then(() => load())
            .catch((nextError) => setError(nextError instanceof Error ? nextError.message : 'تعذر تنفيذ العملية.'))
            .finally(() => setActionId(null));
        },
      },
    ]);
  }

  const requests = payload?.requests ?? [];
  const activationRequests = payload?.fullVersionRequests ?? [];
  const leads = payload?.leads ?? [];

  return (
    <Page>
      <HeroCard
        eyebrow="الإدارة"
        title="طلبات الاشتراك"
        subtitle="مراجعة الطلبات والـ leads من داخل التطبيق."
        aside={<StatusChip label={String(requests.length + activationRequests.length + leads.length)} tone="gold" />}
      />

      <Card>
        <SegmentedControl
          options={[
            { key: 'subscription', label: `الاشتراك (${requests.length})` },
            { key: 'activation', label: `التفعيل (${activationRequests.length})` },
            { key: 'leads', label: `Leads (${leads.length})` },
          ]}
          value={tab}
          onChange={(value) => setTab(value as 'subscription' | 'activation' | 'leads')}
        />
        <View style={styles.buttonRow}>
          <PrimaryButton title="تحديث" onPress={() => void load()} secondary />
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </Card>

      {loading ? (
        <Card><Text style={styles.message}>جارٍ تحميل الطلبات...</Text></Card>
      ) : tab === 'subscription' ? (
        requests.length ? (
          requests.map((item) => (
            <AdminRequestCard
              key={item.id}
              item={item}
              actionId={actionId}
              onApprove={() => handleAction(item, 'approve')}
              onReject={() => handleAction(item, 'reject')}
            />
          ))
        ) : (
          <EmptyState title="لا توجد طلبات اشتراك" message="كل الطلبات تمت معالجتها حاليًا." />
        )
      ) : tab === 'activation' ? (
        activationRequests.length ? (
          activationRequests.map((item: AdminActivationRequest) => (
            <Card key={item.id} muted>
              <Text style={styles.cardTitle}>{item.full_name || item.email}</Text>
              <View style={styles.infoGrid}>
                <Text style={styles.cardMeta}>البريد: {item.email}</Text>
                <Text style={styles.cardMeta}>المكتب: {item.firm_name || '—'}</Text>
                <Text style={styles.cardMeta}>النوع: {item.type === 'delete_request' ? 'طلب حذف' : 'طلب تفعيل'}</Text>
                <Text style={styles.cardMeta}>المصدر: {item.source}</Text>
                <Text style={styles.cardMeta}>التاريخ: {formatDateTime(item.created_at)}</Text>
              </View>
              <Text style={styles.cardMeta}>الرسالة: {compactText(item.message, 180)}</Text>
            </Card>
          ))
        ) : (
          <EmptyState title="لا توجد طلبات تفعيل" message="لا توجد طلبات تفعيل أو حذف حاليًا." />
        )
      ) : leads.length ? (
        leads.map((item: AdminLead) => (
          <Card key={item.id} muted>
            <Text style={styles.cardTitle}>{item.full_name}</Text>
            <View style={styles.infoGrid}>
              <Text style={styles.cardMeta}>البريد: {item.email}</Text>
              <Text style={styles.cardMeta}>الجوال: {item.phone || '—'}</Text>
              <Text style={styles.cardMeta}>المكتب: {item.firm_name || '—'}</Text>
              <Text style={styles.cardMeta}>الموضوع: {item.topic || '—'}</Text>
              <Text style={styles.cardMeta}>المحيل: {item.referrer || '—'}</Text>
            </View>
            <Text style={styles.cardMeta}>الرسالة: {compactText(item.message, 180)}</Text>
          </Card>
        ))
      ) : (
        <EmptyState title="لا توجد Leads" message="لم تصل طلبات تسويقية جديدة بعد." />
      )}
    </Page>
  );
}

type AdminRequestsPayloadLike = {
  requests: AdminRequestItem[];
  fullVersionRequests: AdminActivationRequest[];
  leads: AdminLead[];
};

export { AdminUsersScreen } from './admin-users';

export { AdminOrgsScreen } from './admin-orgs';

export { AdminAuditScreen } from './admin-audit';
