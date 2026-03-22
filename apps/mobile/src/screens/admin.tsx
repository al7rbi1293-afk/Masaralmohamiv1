import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  type AdminActivationRequest,
  type AdminAuditLog,
  type AdminLead,
  type AdminOrg,
  type AdminRequestItem,
  type AdminUser,
  type AdminPendingUser,
  fetchAdminAudit,
  fetchAdminOrgs,
  fetchAdminRequests,
  fetchAdminUsers,
  reviewAdminRequest,
  updateAdminOrg,
  updateAdminUsers,
} from '../features/admin/api';
import {
  Card,
  EmptyState,
  Field,
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
import { colors, fonts, radius, spacing } from '../theme';

export type AdminStackParamList = {
  AdminHome: undefined;
  AdminRequests: undefined;
  AdminUsers: undefined;
  AdminOrgs: undefined;
  AdminAudit: undefined;
};

type AdminEntry = {
  title: string;
  subtitle: string;
  route: keyof AdminStackParamList;
  tone: 'default' | 'success' | 'warning' | 'danger' | 'gold';
};

const adminEntries: AdminEntry[] = [
  {
    title: 'طلبات الاشتراك',
    subtitle: 'مراجعة الطلبات والموافقات السريعة',
    route: 'AdminRequests',
    tone: 'gold',
  },
  {
    title: 'المستخدمون',
    subtitle: 'إدارة الحسابات والصلاحيات',
    route: 'AdminUsers',
    tone: 'success',
  },
  {
    title: 'المكاتب',
    subtitle: 'الاشتراكات والمنظمات والحالات',
    route: 'AdminOrgs',
    tone: 'warning',
  },
  {
    title: 'سجل التدقيق',
    subtitle: 'العمليات والإجراءات السابقة',
    route: 'AdminAudit',
    tone: 'default',
  },
];

const planOptions = [
  { key: 'SOLO', label: 'فردي' },
  { key: 'SMALL_OFFICE', label: 'صغير' },
  { key: 'MEDIUM_OFFICE', label: 'متوسط' },
  { key: 'ENTERPRISE', label: 'شركات' },
];

const durationOptions = [
  { key: 'month', label: 'شهر' },
  { key: 'year', label: 'سنة' },
];

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleDateString('ar-SA');
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleString('ar-SA');
}

function compactText(value: string | null | undefined, max = 120) {
  const normalized = (value ?? '').trim();
  if (!normalized) return '—';
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max)}...`;
}

function statusLabel(value: string | null | undefined) {
  switch (String(value ?? '').toLowerCase()) {
    case 'active':
      return 'نشط';
    case 'suspended':
      return 'معلق';
    case 'approved':
      return 'مقبول';
    case 'rejected':
      return 'مرفوض';
    case 'pending':
      return 'قيد المراجعة';
    case 'paid':
      return 'مدفوع';
    case 'deleted':
      return 'محذوف';
    default:
      return value || '—';
  }
}

function statusTone(value: string | null | undefined): 'default' | 'success' | 'warning' | 'danger' | 'gold' {
  switch (String(value ?? '').toLowerCase()) {
    case 'active':
    case 'approved':
    case 'paid':
      return 'success';
    case 'pending':
      return 'warning';
    case 'suspended':
    case 'rejected':
      return 'danger';
    default:
      return 'gold';
  }
}

function planLabel(value: string | null | undefined) {
  switch (String(value ?? '').toUpperCase()) {
    case 'SOLO':
      return 'المحامي المستقل';
    case 'SMALL_OFFICE':
      return 'مكتب صغير';
    case 'MEDIUM_OFFICE':
      return 'مكتب متوسط';
    case 'ENTERPRISE':
      return 'نسخة الشركات';
    default:
      return value || 'تجريبي';
  }
}

function roleLabel(value: string | null | undefined) {
  switch (String(value ?? '').toLowerCase()) {
    case 'owner':
      return 'مالك';
    case 'admin':
      return 'مدير';
    case 'member':
      return 'عضو';
    case 'lawyer':
      return 'محامي';
    default:
      return value || '—';
  }
}

function AdminRouteCard({
  entry,
  onPress,
}: {
  entry: AdminEntry;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.entryCard}>
      <View style={styles.entryText}>
        <Text style={styles.entryTitle}>{entry.title}</Text>
        <Text style={styles.entrySubtitle}>{entry.subtitle}</Text>
      </View>
      <StatusChip label="فتح" tone={entry.tone} />
    </Pressable>
  );
}

function AdminRequestCard({
  item,
  actionId,
  onApprove,
  onReject,
}: {
  item: AdminRequestItem;
  actionId: string | null;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <Card muted>
      <View style={styles.rowBetween}>
        <View style={styles.gapXs}>
          <Text style={styles.cardTitle}>{item.organizations?.name || 'بدون مكتب مرتبط'}</Text>
          <Text style={styles.cardMeta}>
            {item.requester_name || '—'} • {formatDate(item.requested_at)}
          </Text>
        </View>
        <StatusChip label={statusLabel(item.status)} tone={statusTone(item.status)} />
      </View>

      <View style={styles.infoGrid}>
        <Text style={styles.cardMeta}>الخطة: {planLabel(item.plan_requested)}</Text>
        <Text style={styles.cardMeta}>المدة: {item.duration_months} شهر</Text>
        <Text style={styles.cardMeta}>المرجع: {item.payment_reference || '—'}</Text>
        {item.amount ? <Text style={styles.cardMeta}>المبلغ: {item.amount} {item.currency || ''}</Text> : null}
      </View>

      {item.status === 'pending' ? (
        <View style={styles.buttonRow}>
          <PrimaryButton title="قبول" onPress={onApprove} disabled={actionId === item.id} />
          <PrimaryButton title="رفض" onPress={onReject} disabled={actionId === item.id} secondary />
        </View>
      ) : item.notes ? (
        <Text style={styles.cardMeta}>الملاحظة: {item.notes}</Text>
      ) : null}
    </Card>
  );
}

function AdminUserCard({
  user,
  actionId,
  onToggleStatus,
  onDelete,
}: {
  user: AdminUser;
  actionId: string | null;
  onToggleStatus: () => void;
  onDelete: () => void;
}) {
  return (
    <Card muted>
      <View style={styles.rowBetween}>
        <View style={styles.gapXs}>
          <Text style={styles.cardTitle}>{user.full_name || user.email || user.user_id}</Text>
          <Text style={styles.cardMeta}>{user.email || '—'}</Text>
        </View>
        <StatusChip label={statusLabel(user.status)} tone={statusTone(user.status)} />
      </View>

      <View style={styles.infoGrid}>
        <Text style={styles.cardMeta}>الجوال: {user.phone || '—'}</Text>
        <Text style={styles.cardMeta}>تاريخ الإنشاء: {formatDate(user.created_at)}</Text>
        <Text style={styles.cardMeta}>
          العضويات: {user.memberships.map((item) => `${item.organizations?.name || '—'} (${roleLabel(item.role)})`).join(' • ') || '—'}
        </Text>
      </View>

      <View style={styles.buttonRow}>
        <PrimaryButton
          title={user.status === 'suspended' ? 'تفعيل' : 'تعليق'}
          onPress={onToggleStatus}
          disabled={actionId === user.user_id}
          secondary={user.status !== 'suspended'}
        />
        <PrimaryButton title="حذف" onPress={onDelete} disabled={actionId === user.user_id} secondary />
      </View>
    </Card>
  );
}

function AdminPendingUserCard({
  user,
  actionId,
  onDelete,
}: {
  user: AdminPendingUser;
  actionId: string | null;
  onDelete: () => void;
}) {
  return (
    <Card muted>
      <View style={styles.rowBetween}>
        <View style={styles.gapXs}>
          <Text style={styles.cardTitle}>{user.full_name || user.email || user.user_id}</Text>
          <Text style={styles.cardMeta}>{user.email || '—'}</Text>
        </View>
        <StatusChip label={user.older_than_3h ? 'أقدم من 3 ساعات' : 'جديد'} tone={user.older_than_3h ? 'warning' : 'gold'} />
      </View>
      <Text style={styles.cardMeta}>تاريخ الإنشاء: {formatDateTime(user.created_at)}</Text>
      <View style={styles.buttonRow}>
        <PrimaryButton title="حذف الحساب" onPress={onDelete} disabled={actionId === user.user_id} secondary />
      </View>
    </Card>
  );
}

function AdminOrgCard({
  org,
  actionId,
  planValue,
  durationValue,
  onPlanChange,
  onDurationChange,
  onAction,
}: {
  org: AdminOrg;
  actionId: string | null;
  planValue: string;
  durationValue: string;
  onPlanChange: (value: string) => void;
  onDurationChange: (value: string) => void;
  onAction: (action: 'suspend' | 'activate' | 'delete' | 'extend_trial' | 'activate_subscription' | 'grant_lifetime' | 'set_plan') => void;
}) {
  return (
    <Card muted>
      <View style={styles.rowBetween}>
        <View style={styles.gapXs}>
          <Text style={styles.cardTitle}>{org.name}</Text>
          <Text style={styles.cardMeta}>
            {org.primary_account?.email || 'بدون حساب رئيسي'} • {formatDate(org.created_at)}
          </Text>
        </View>
        <StatusChip label={statusLabel(org.status)} tone={statusTone(org.status)} />
      </View>

      <View style={styles.infoGrid}>
        <Text style={styles.cardMeta}>الأعضاء: {org.members_count}</Text>
        <Text style={styles.cardMeta}>الخطة الحالية: {planLabel(org.subscription?.plan)}</Text>
        <Text style={styles.cardMeta}>نهاية الاشتراك: {formatDate(org.subscription?.current_period_end)}</Text>
        <Text style={styles.cardMeta}>نهاية التجربة: {formatDate(org.trial?.ends_at)}</Text>
      </View>

      <Text style={styles.groupLabel}>الخطة الجديدة</Text>
      <SegmentedControl options={planOptions} value={planValue} onChange={onPlanChange} />

      <Text style={styles.groupLabel}>مدة التفعيل</Text>
      <SegmentedControl options={durationOptions} value={durationValue} onChange={onDurationChange} />

      <View style={styles.buttonColumn}>
        <View style={styles.buttonRow}>
          <PrimaryButton
            title={org.status === 'suspended' ? 'تفعيل المكتب' : 'تعليق المكتب'}
            onPress={() => onAction(org.status === 'suspended' ? 'activate' : 'suspend')}
            disabled={actionId === org.id}
            secondary={org.status !== 'suspended'}
          />
          <PrimaryButton
            title="تمديد التجربة 14 يوم"
            onPress={() => onAction('extend_trial')}
            disabled={actionId === org.id}
            secondary
          />
        </View>
        <View style={styles.buttonRow}>
          <PrimaryButton
            title="تفعيل الاشتراك"
            onPress={() => onAction('activate_subscription')}
            disabled={actionId === org.id}
          />
          <PrimaryButton
            title="تغيير الخطة"
            onPress={() => onAction('set_plan')}
            disabled={actionId === org.id}
            secondary
          />
        </View>
        <View style={styles.buttonRow}>
          {org.has_admin_account ? (
            <PrimaryButton
              title="منح مدى الحياة"
              onPress={() => onAction('grant_lifetime')}
              disabled={actionId === org.id}
              secondary
            />
          ) : null}
          <PrimaryButton title="حذف المكتب" onPress={() => onAction('delete')} disabled={actionId === org.id} secondary />
        </View>
      </View>
    </Card>
  );
}

function AuditLogCard({ log }: { log: AdminAuditLog }) {
  return (
    <Card muted>
      <View style={styles.rowBetween}>
        <Text style={styles.cardTitle}>{log.action}</Text>
        <StatusChip label={formatDateTime(log.created_at)} tone="default" />
      </View>
      <View style={styles.infoGrid}>
        <Text style={styles.cardMeta}>الكيان: {log.entity_type || '—'}</Text>
        <Text style={styles.cardMeta}>المعرف: {log.entity_id || '—'}</Text>
        <Text style={styles.cardMeta}>المكتب: {log.org_id || '—'}</Text>
        <Text style={styles.cardMeta}>المستخدم: {log.user_id || '—'}</Text>
      </View>
      {log.meta ? <Text style={styles.cardMeta}>تفاصيل: {compactText(JSON.stringify(log.meta), 180)}</Text> : null}
    </Card>
  );
}

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

export function AdminUsersScreen() {
  const { session } = useAuth();
  const [draftQuery, setDraftQuery] = useState('');
  const [query, setQuery] = useState('');
  const [payload, setPayload] = useState<{ users: AdminUser[]; pending: AdminPendingUser[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionId, setActionId] = useState<string | null>(null);

  async function load(nextQuery = query) {
    if (!session?.token) return;
    setLoading(true);
    setError('');
    try {
      const data = await fetchAdminUsers(session.token, nextQuery, 1, 50);
      setPayload({ users: data.users, pending: data.pending });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'تعذر تحميل المستخدمين.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [session?.token]);

  function confirmUserAction(title: string, onConfirm: () => void, destructive = false) {
    Alert.alert(title, 'هل تريد المتابعة؟', [
      { text: 'إلغاء', style: 'cancel' },
      { text: title, style: destructive ? 'destructive' : 'default', onPress: onConfirm },
    ]);
  }

  async function handleUserAction(payloadAction: { action: 'suspend' | 'activate' | 'delete_pending' | 'delete'; user_id?: string; user_ids?: string[] }, busyId: string) {
    if (!session?.token) return;
    setActionId(busyId);
    setError('');
    try {
      await updateAdminUsers(session.token, payloadAction);
      await load();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'تعذر تنفيذ العملية.');
    } finally {
      setActionId(null);
    }
  }

  const olderPendingIds = useMemo(() => (payload?.pending ?? []).filter((item) => item.older_than_3h).map((item) => item.user_id), [payload?.pending]);

  return (
    <Page>
      <HeroCard
        eyebrow="الإدارة"
        title="المستخدمون"
        subtitle="إدارة الحسابات المفعلة وغير المفعلة."
        aside={<StatusChip label={String((payload?.users.length || 0) + (payload?.pending.length || 0))} tone="gold" />}
      />

      <Card>
        <Field label="البحث" value={draftQuery} onChangeText={setDraftQuery} placeholder="الاسم أو البريد أو الجوال" />
        <View style={styles.buttonRow}>
          <PrimaryButton
            title="بحث"
            onPress={() => {
              setQuery(draftQuery.trim());
              void load(draftQuery.trim());
            }}
          />
          <PrimaryButton
            title="مسح"
            onPress={() => {
              setDraftQuery('');
              setQuery('');
              void load('');
            }}
            secondary
          />
        </View>
        {olderPendingIds.length ? (
          <PrimaryButton
            title={`حذف غير المفعلة الأقدم (${olderPendingIds.length})`}
            onPress={() =>
              confirmUserAction('حذف الحسابات غير المفعلة', () => {
                void handleUserAction({ action: 'delete_pending', user_ids: olderPendingIds }, 'bulk-pending');
              }, true)
            }
            secondary
          />
        ) : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </Card>

      {loading ? (
        <Card><Text style={styles.message}>جارٍ تحميل المستخدمين...</Text></Card>
      ) : (
        <>
          <Card>
            <SectionTitle title="الحسابات غير المفعلة" subtitle={query ? `نتائج البحث: ${query}` : 'الحسابات التي لم تُفعّل بعد'} />
            {payload?.pending.length ? (
              payload.pending.map((user) => (
                <AdminPendingUserCard
                  key={user.user_id}
                  user={user}
                  actionId={actionId}
                  onDelete={() =>
                    confirmUserAction('حذف الحساب', () => {
                      void handleUserAction({ action: 'delete_pending', user_id: user.user_id }, user.user_id);
                    }, true)
                  }
                />
              ))
            ) : (
              <EmptyState title="لا توجد حسابات معلقة" message="كل الحسابات الحالية مفعلة أو لا توجد نتائج." />
            )}
          </Card>

          <Card>
            <SectionTitle title="الحسابات المفعلة" subtitle="إدارة التعليق والتفعيل والحذف." />
            {payload?.users.length ? (
              payload.users.map((user) => (
                <AdminUserCard
                  key={user.user_id}
                  user={user}
                  actionId={actionId}
                  onToggleStatus={() =>
                    confirmUserAction(user.status === 'suspended' ? 'تفعيل المستخدم' : 'تعليق المستخدم', () => {
                      void handleUserAction(
                        { action: user.status === 'suspended' ? 'activate' : 'suspend', user_id: user.user_id },
                        user.user_id,
                      );
                    })
                  }
                  onDelete={() =>
                    confirmUserAction('حذف المستخدم', () => {
                      void handleUserAction({ action: 'delete', user_id: user.user_id }, user.user_id);
                    }, true)
                  }
                />
              ))
            ) : (
              <EmptyState title="لا توجد حسابات" message="لم يتم العثور على مستخدمين مطابقين." />
            )}
          </Card>
        </>
      )}
    </Page>
  );
}

export function AdminOrgsScreen() {
  const { session } = useAuth();
  const [draftQuery, setDraftQuery] = useState('');
  const [query, setQuery] = useState('');
  const [orgs, setOrgs] = useState<AdminOrg[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionId, setActionId] = useState<string | null>(null);
  const [planByOrg, setPlanByOrg] = useState<Record<string, string>>({});
  const [durationByOrg, setDurationByOrg] = useState<Record<string, string>>({});

  async function load(nextQuery = query) {
    if (!session?.token) return;
    setLoading(true);
    setError('');
    try {
      const data = await fetchAdminOrgs(session.token, nextQuery, 1, 50);
      setOrgs(data.orgs);
      setPlanByOrg((current) => {
        const next = { ...current };
        for (const org of data.orgs) {
          next[org.id] = next[org.id] || org.subscription?.plan || 'MEDIUM_OFFICE';
        }
        return next;
      });
      setDurationByOrg((current) => {
        const next = { ...current };
        for (const org of data.orgs) {
          next[org.id] = next[org.id] || 'year';
        }
        return next;
      });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'تعذر تحميل المكاتب.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [session?.token]);

  function confirmOrgAction(title: string, onConfirm: () => void, destructive = false) {
    Alert.alert(title, 'هل تريد المتابعة؟', [
      { text: 'إلغاء', style: 'cancel' },
      { text: title, style: destructive ? 'destructive' : 'default', onPress: onConfirm },
    ]);
  }

  async function handleOrgAction(
    org: AdminOrg,
    action: 'suspend' | 'activate' | 'delete' | 'extend_trial' | 'activate_subscription' | 'grant_lifetime' | 'set_plan',
  ) {
    if (!session?.token) return;
    setActionId(org.id);
    setError('');
    try {
      const extra_data =
        action === 'activate_subscription'
          ? {
              plan: planByOrg[org.id] || org.subscription?.plan || 'MEDIUM_OFFICE',
              duration_mode: durationByOrg[org.id] || 'year',
            }
          : action === 'set_plan'
            ? {
                plan: planByOrg[org.id] || org.subscription?.plan || 'MEDIUM_OFFICE',
              }
            : action === 'extend_trial'
              ? { days: 14 }
              : undefined;

      await updateAdminOrg(session.token, {
        org_id: org.id,
        action,
        extra_data,
      });
      await load();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'تعذر تنفيذ العملية.');
    } finally {
      setActionId(null);
    }
  }

  return (
    <Page>
      <HeroCard
        eyebrow="الإدارة"
        title="المكاتب"
        subtitle="إدارة المكاتب والاشتراكات والتجارب."
        aside={<StatusChip label={String(orgs.length)} tone="warning" />}
      />

      <Card>
        <Field label="البحث" value={draftQuery} onChangeText={setDraftQuery} placeholder="اسم المكتب" />
        <View style={styles.buttonRow}>
          <PrimaryButton
            title="بحث"
            onPress={() => {
              setQuery(draftQuery.trim());
              void load(draftQuery.trim());
            }}
          />
          <PrimaryButton
            title="مسح"
            onPress={() => {
              setDraftQuery('');
              setQuery('');
              void load('');
            }}
            secondary
          />
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </Card>

      {loading ? (
        <Card><Text style={styles.message}>جارٍ تحميل المكاتب...</Text></Card>
      ) : orgs.length ? (
        orgs.map((org) => (
          <AdminOrgCard
            key={org.id}
            org={org}
            actionId={actionId}
            planValue={planByOrg[org.id] || org.subscription?.plan || 'MEDIUM_OFFICE'}
            durationValue={durationByOrg[org.id] || 'year'}
            onPlanChange={(value) => setPlanByOrg((current) => ({ ...current, [org.id]: value }))}
            onDurationChange={(value) => setDurationByOrg((current) => ({ ...current, [org.id]: value }))}
            onAction={(action) =>
              confirmOrgAction(
                action === 'delete'
                  ? 'حذف المكتب'
                  : action === 'grant_lifetime'
                    ? 'منح اشتراك مدى الحياة'
                    : action === 'extend_trial'
                      ? 'تمديد التجربة'
                      : action === 'set_plan'
                        ? 'تغيير الخطة'
                        : action === 'activate_subscription'
                          ? 'تفعيل الاشتراك'
                          : action === 'activate'
                            ? 'تفعيل المكتب'
                            : 'تعليق المكتب',
                () => {
                  void handleOrgAction(org, action);
                },
                action === 'delete',
              )
            }
          />
        ))
      ) : (
        <EmptyState title="لا توجد مكاتب" message="لم يتم العثور على مكاتب مطابقة." />
      )}
    </Page>
  );
}

export function AdminAuditScreen() {
  const { session } = useAuth();
  const [logs, setLogs] = useState<AdminAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    if (!session?.token) return;
    setLoading(true);
    setError('');
    try {
      const data = await fetchAdminAudit(session.token);
      setLogs(data.logs);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'تعذر تحميل سجل التدقيق.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [session?.token]);

  return (
    <Page>
      <HeroCard
        eyebrow="الإدارة"
        title="سجل التدقيق"
        subtitle="آخر العمليات الإدارية داخل النظام."
        aside={<StatusChip label={String(logs.length)} tone="default" />}
      />

      <Card>
        <View style={styles.buttonRow}>
          <PrimaryButton title="تحديث" onPress={() => void load()} secondary />
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </Card>

      {loading ? (
        <Card><Text style={styles.message}>جارٍ تحميل السجل...</Text></Card>
      ) : logs.length ? (
        logs.map((log) => <AuditLogCard key={log.id} log={log} />)
      ) : (
        <EmptyState title="لا يوجد سجل" message="لم يتم العثور على عمليات تدقيق بعد." />
      )}
    </Page>
  );
}

const styles = StyleSheet.create({
  heroBadges: {
    gap: spacing.sm,
  },
  entries: {
    gap: spacing.md,
  },
  entryCard: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    backgroundColor: colors.surfaceMuted,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  entryText: {
    flex: 1,
    gap: spacing.xs,
  },
  entryTitle: {
    color: colors.primary,
    fontFamily: fonts.arabicBold,
    fontSize: 16,
    textAlign: 'right',
  },
  entrySubtitle: {
    color: colors.textMuted,
    fontFamily: fonts.arabicRegular,
    fontSize: 12,
    lineHeight: 20,
    textAlign: 'right',
  },
  statsGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  buttonRow: {
    flexDirection: 'row-reverse',
    gap: spacing.md,
    flexWrap: 'wrap',
  },
  buttonColumn: {
    gap: spacing.md,
  },
  rowBetween: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  gapXs: {
    gap: spacing.xs,
    flex: 1,
  },
  cardTitle: {
    color: colors.primary,
    fontFamily: fonts.arabicBold,
    fontSize: 16,
    textAlign: 'right',
  },
  cardMeta: {
    color: colors.textMuted,
    fontFamily: fonts.arabicRegular,
    fontSize: 12,
    lineHeight: 20,
    textAlign: 'right',
  },
  infoGrid: {
    gap: spacing.xs,
  },
  groupLabel: {
    color: colors.primary,
    fontFamily: fonts.arabicSemiBold,
    fontSize: 13,
    textAlign: 'right',
    marginBottom: spacing.sm,
  },
  message: {
    color: colors.textMuted,
    fontFamily: fonts.arabicMedium,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'right',
    marginTop: spacing.sm,
  },
  error: {
    color: colors.danger,
    fontFamily: fonts.arabicMedium,
    fontSize: 12,
    lineHeight: 20,
    textAlign: 'right',
    marginTop: spacing.sm,
  },
  accountBlock: {
    gap: spacing.xs,
  },
  accountLabel: {
    color: colors.textMuted,
    fontFamily: fonts.arabicRegular,
    fontSize: 12,
    textAlign: 'right',
  },
  accountValue: {
    color: colors.primary,
    fontFamily: fonts.arabicSemiBold,
    fontSize: 14,
    textAlign: 'right',
  },
  signOutWrap: {
    marginTop: spacing.md,
    alignItems: 'flex-end',
  },
  signOutButton: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.danger,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  signOutText: {
    color: colors.danger,
    fontFamily: fonts.arabicBold,
    fontSize: 13,
    textAlign: 'center',
  },
});
