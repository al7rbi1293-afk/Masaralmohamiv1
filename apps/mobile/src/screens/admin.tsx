import { useEffect, useMemo, useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Card, EmptyState, HeroCard, Page, PrimaryButton, SectionTitle, StatCard, StatusChip } from '../components/ui';
import { useAuth } from '../context/auth-context';
import { buildMobileAuthBridgeUrl, fetchAdminBootstrap, type AdminBootstrap } from '../lib/api';
import { colors, fonts, radius, spacing } from '../theme';

export type AdminStackParamList = {
  AdminHome: undefined;
};

type AdminEntry = {
  title: string;
  subtitle: string;
  path: string;
  tone: 'default' | 'success' | 'warning' | 'danger' | 'gold';
};

const adminEntries: AdminEntry[] = [
  {
    title: 'لوحة الإدارة الرئيسية',
    subtitle: 'الرؤية العامة وبقية التبويبات الإدارية',
    path: '/admin',
    tone: 'danger',
  },
  {
    title: 'طلبات الاشتراك',
    subtitle: 'مراجعة الطلبات والموافقات السريعة',
    path: '/admin/requests',
    tone: 'gold',
  },
  {
    title: 'المستخدمون',
    subtitle: 'إدارة الحسابات والصلاحيات',
    path: '/admin/users',
    tone: 'success',
  },
  {
    title: 'المكاتب',
    subtitle: 'الاشتراكات والمنظمات والحالات',
    path: '/admin/orgs',
    tone: 'warning',
  },
  {
    title: 'سجل التدقيق',
    subtitle: 'العمليات والإجراءات السابقة',
    path: '/admin/audit',
    tone: 'default',
  },
];

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

export function AdminHomeScreen() {
  const { session, signOut, switchPortal } = useAuth();
  const [message, setMessage] = useState('');
  const [bootstrap, setBootstrap] = useState<AdminBootstrap | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!session?.token) {
        if (mounted) {
          setLoading(false);
        }
        return;
      }

      try {
        const payload = await fetchAdminBootstrap(session.token);
        if (mounted) {
          setBootstrap(payload);
        }
      } catch (error) {
        if (mounted) {
          setMessage(error instanceof Error ? error.message : 'تعذر تحميل لوحة الإدارة.');
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
  }, [session?.token]);

  const adminLinks = useMemo(() => bootstrap?.links || adminEntries.map(({ title, path }) => ({ label: title, path })), [bootstrap]);

  async function openAdminPath(path: string) {
    if (!session?.token) {
      setMessage('جلسة الأدمن غير متاحة حالياً.');
      return;
    }

    try {
      const url = buildMobileAuthBridgeUrl(session.token, path);
      await Linking.openURL(url);
      setMessage('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'تعذر فتح لوحة الإدارة.');
    }
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

  function confirmSignOut() {
    Alert.alert('تسجيل الخروج', 'هل تريد إنهاء جلسة الإدارة الحالية؟', [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'تسجيل الخروج',
        style: 'destructive',
        onPress: () => void signOut(),
      },
    ]);
  }

  return (
    <Page>
      <HeroCard
        eyebrow="إدارة النظام"
        title="لوحة الإدارة الكاملة"
        subtitle="تعمل هذه الشاشة كنقطة تحكم سريعة، ويمكن منها فتح جميع أقسام الإدارة الحالية في الموقع بنفس جلسة التطبيق."
        aside={
          <View style={styles.heroBadges}>
            <StatusChip label="صلاحيات عليا" tone="danger" />
            <StatusChip label={session?.email || '—'} tone="gold" />
          </View>
        }
      />

      <Card>
        <SectionTitle title="نظرة عامة" subtitle="ملخص حي لحالة النظام من حساب الأدمن." />
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
          <EmptyState title="تعذر تحميل الإحصاءات" message="ما زال بإمكانك فتح لوحة الإدارة مباشرة من الأزرار أدناه." />
        )}
      </Card>

      <Card>
        <SectionTitle title="الفتح السريع" subtitle="افتح الواجهة الكاملة ثم انتقل إلى القسم المطلوب." />
        <View style={styles.primaryActions}>
          <PrimaryButton title="فتح لوحة الإدارة" onPress={() => void openAdminPath('/admin')} />
          <PrimaryButton title="طلبات الاشتراك" onPress={() => void openAdminPath('/admin/requests')} secondary />
        </View>
        {message ? <Text style={styles.message}>{message}</Text> : null}
      </Card>

      <Card>
        <SectionTitle title="أقسام الإدارة" subtitle="هذه الروابط تفتح الصفحات الحالية داخل الموقع بنفس جلسة التطبيق." />
        <View style={styles.entries}>
          {adminLinks.map((entry) => (
            <AdminRouteCard
              key={entry.path}
              entry={{
                title: entry.label,
                subtitle: adminEntries.find((item) => item.path === entry.path)?.subtitle || 'فتح القسم مباشرة',
                path: entry.path,
                tone: adminEntries.find((item) => item.path === entry.path)?.tone || 'default',
              }}
              onPress={() => void openAdminPath(entry.path)}
            />
          ))}
        </View>
      </Card>

      <Card>
        <SectionTitle title="التنقل بين البوابات" subtitle="إذا كان نفس الحساب يملك وصولًا إضافيًا يمكنك الانتقال بدون تسجيل دخول جديد." />
        <View style={styles.primaryActions}>
          {session?.hasOfficeAccess ? (
            <PrimaryButton title="الانتقال إلى المكتب" onPress={() => void handleSwitchToOffice()} secondary />
          ) : null}
          {session?.hasPartnerAccess ? (
            <PrimaryButton title="الانتقال إلى الشريك" onPress={() => void handleSwitchToPartner()} secondary />
          ) : null}
        </View>
      </Card>

      <Card>
        <SectionTitle title="حساب الإدارة" subtitle="إنهاء الجلسة الحالية من هذا الجهاز." />
        <View style={styles.accountBlock}>
          <Text style={styles.accountLabel}>البريد</Text>
          <Text style={styles.accountValue}>{session?.email || '—'}</Text>
          <Text style={styles.accountLabel}>المسار الافتراضي</Text>
          <Text style={styles.accountValue}>{bootstrap?.role.default_path || session?.defaultPath || '/admin'}</Text>
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

const styles = StyleSheet.create({
  heroBadges: {
    gap: spacing.sm,
  },
  primaryActions: {
    gap: spacing.md,
  },
  statsGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  message: {
    color: colors.textMuted,
    fontFamily: fonts.arabicMedium,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'right',
    marginTop: spacing.sm,
  },
  entries: {
    gap: spacing.md,
  },
  entryCard: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
  },
  entryText: {
    flex: 1,
    gap: 4,
  },
  entryTitle: {
    color: colors.text,
    fontFamily: fonts.arabicBold,
    fontSize: 15,
    textAlign: 'right',
  },
  entrySubtitle: {
    color: colors.textMuted,
    fontFamily: fonts.arabicRegular,
    fontSize: 12,
    lineHeight: 19,
    textAlign: 'right',
  },
  accountBlock: {
    gap: 6,
  },
  accountLabel: {
    color: colors.textMuted,
    fontFamily: fonts.arabicMedium,
    fontSize: 12,
    textAlign: 'right',
  },
  accountValue: {
    color: colors.text,
    fontFamily: fonts.arabicBold,
    fontSize: 14,
    textAlign: 'right',
    marginBottom: spacing.sm,
  },
  signOutWrap: {
    marginTop: spacing.sm,
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
