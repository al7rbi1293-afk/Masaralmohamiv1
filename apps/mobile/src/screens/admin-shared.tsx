import { Pressable, Text, View } from 'react-native';
import {
  type AdminAuditLog,
  type AdminOrg,
  type AdminPendingUser,
  type AdminRequestItem,
  type AdminUser,
} from '../features/admin/api';
import { Card, PrimaryButton, SegmentedControl, StatusChip } from '../components/ui';
import { styles } from './admin.styles';

export type AdminEntry = {
  title: string;
  subtitle: string;
  route: 'AdminRequests' | 'AdminUsers' | 'AdminOrgs' | 'AdminAudit';
  tone: 'default' | 'success' | 'warning' | 'danger' | 'gold';
};

export const adminEntries: AdminEntry[] = [
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

export const planOptions = [
  { key: 'SOLO', label: 'فردي' },
  { key: 'SMALL_OFFICE', label: 'صغير' },
  { key: 'MEDIUM_OFFICE', label: 'متوسط' },
  { key: 'ENTERPRISE', label: 'شركات' },
];

export const durationOptions = [
  { key: 'month', label: 'شهر' },
  { key: 'year', label: 'سنة' },
];

export function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleDateString('ar-SA');
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleString('ar-SA');
}

export function compactText(value: string | null | undefined, max = 120) {
  const normalized = (value ?? '').trim();
  if (!normalized) return '—';
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max)}...`;
}

export function statusLabel(value: string | null | undefined) {
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

export function statusTone(value: string | null | undefined): 'default' | 'success' | 'warning' | 'danger' | 'gold' {
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

export function planLabel(value: string | null | undefined) {
  switch (String(value ?? '').toUpperCase()) {
    case 'TRIAL':
      return 'تجربة';
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

export function roleLabel(value: string | null | undefined) {
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

export function AdminRouteCard({
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

export function AdminRequestCard({
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

export function AdminUserCard({
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

export function AdminPendingUserCard({
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

export type AdminOrgCardAction =
  | 'suspend'
  | 'activate'
  | 'delete'
  | 'extend_trial'
  | 'activate_subscription'
  | 'grant_lifetime'
  | 'set_plan';

export function AdminOrgCard({
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
  onAction: (action: AdminOrgCardAction) => void;
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

export function AuditLogCard({ log }: { log: AdminAuditLog }) {
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
