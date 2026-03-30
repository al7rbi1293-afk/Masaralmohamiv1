import { Alert, Pressable, Text, View } from 'react-native';
import { Card, PrimaryButton, SectionTitle, SegmentedControl } from '../components/ui';
import { styles } from './office.styles';
import { SummaryRow } from './office';

type OfficeMoreQuickActionsCardProps = {
  actionMessage: string;
  onNewTask: () => void;
  onNewDocument: () => void;
  onNewClient: () => void;
  onNewMatter: () => void;
  onNewQuote: () => void;
  onNewInvoice: () => void;
  onOpenSettingsHome: () => void;
};

export function OfficeMoreQuickActionsCard({
  actionMessage,
  onNewTask,
  onNewDocument,
  onNewClient,
  onNewMatter,
  onNewQuote,
  onNewInvoice,
  onOpenSettingsHome,
}: OfficeMoreQuickActionsCardProps) {
  return (
    <Card>
      <SectionTitle title="إجراءات سريعة" subtitle="تنفيذ مباشر بدل القراءة فقط." />
      <View style={styles.quickActionsGrid}>
        <Pressable style={styles.actionTile} onPress={onNewTask}>
          <Text style={styles.actionTileTitle}>مهمة جديدة</Text>
          <Text style={styles.actionTileMeta}>إنشاء من البداية</Text>
        </Pressable>
        <Pressable style={styles.actionTile} onPress={onNewDocument}>
          <Text style={styles.actionTileTitle}>مستند جديد</Text>
          <Text style={styles.actionTileMeta}>رفع مباشر</Text>
        </Pressable>
        <Pressable style={styles.actionTile} onPress={onNewClient}>
          <Text style={styles.actionTileTitle}>عميل جديد</Text>
          <Text style={styles.actionTileMeta}>ملف موكل</Text>
        </Pressable>
        <Pressable style={styles.actionTile} onPress={onNewMatter}>
          <Text style={styles.actionTileTitle}>قضية جديدة</Text>
          <Text style={styles.actionTileMeta}>ربط بعميل</Text>
        </Pressable>
        <Pressable style={styles.actionTile} onPress={onNewQuote}>
          <Text style={styles.actionTileTitle}>عرض سعر</Text>
          <Text style={styles.actionTileMeta}>مسودة جاهزة</Text>
        </Pressable>
        <Pressable style={styles.actionTile} onPress={onNewInvoice}>
          <Text style={styles.actionTileTitle}>فاتورة</Text>
          <Text style={styles.actionTileMeta}>إصدار جديد</Text>
        </Pressable>
        <Pressable style={styles.actionTile} onPress={onOpenSettingsHome}>
          <Text style={styles.actionTileTitle}>إدارة المكتب</Text>
          <Text style={styles.actionTileMeta}>الهوية، الفريق، والخطة الحالية</Text>
        </Pressable>
      </View>
      {actionMessage ? <Text style={styles.formMessage}>{actionMessage}</Text> : null}
    </Card>
  );
}

type OfficeMoreSettingsShortcutsCardProps = {
  onIdentity: () => void;
  onTeam: () => void;
  onSubscription: () => void;
};

export function OfficeMoreSettingsShortcutsCard({
  onIdentity,
  onTeam,
  onSubscription,
}: OfficeMoreSettingsShortcutsCardProps) {
  return (
    <Card>
      <SectionTitle title="إعدادات المكتب" subtitle="الوصول السريع إلى الهوية والفريق والخطة الحالية." />
      <View style={styles.quickActionsGrid}>
        <Pressable style={styles.actionTile} onPress={onIdentity}>
          <Text style={styles.actionTileTitle}>الهوية</Text>
          <Text style={styles.actionTileMeta}>الاسم والشعار</Text>
        </Pressable>
        <Pressable style={styles.actionTile} onPress={onTeam}>
          <Text style={styles.actionTileTitle}>الفريق</Text>
          <Text style={styles.actionTileMeta}>الأعضاء والدعوات</Text>
        </Pressable>
        <Pressable style={styles.actionTile} onPress={onSubscription}>
          <Text style={styles.actionTileTitle}>الخطة الحالية</Text>
          <Text style={styles.actionTileMeta}>عرض فقط</Text>
        </Pressable>
      </View>
    </Card>
  );
}

type OfficeMoreSectionControlCardProps = {
  section: 'tasks' | 'documents' | 'billing' | 'activity';
  counts: {
    tasks: number;
    documents: number;
    billing: number;
    activity: number;
  };
  onSectionChange: (section: 'tasks' | 'documents' | 'billing' | 'activity') => void;
};

export function OfficeMoreSectionControlCard({
  section,
  counts,
  onSectionChange,
}: OfficeMoreSectionControlCardProps) {
  return (
    <Card>
      <SectionTitle title="تنظيم العرض" subtitle="اختر القسم الذي تريد العمل عليه الآن." />
      <SegmentedControl
        value={section}
        onChange={(next) => onSectionChange(next as typeof section)}
        options={[
          { key: 'tasks', label: 'المهام', count: counts.tasks },
          { key: 'documents', label: 'المستندات', count: counts.documents },
          { key: 'billing', label: 'الفوترة', count: counts.billing },
          { key: 'activity', label: 'النشاط', count: counts.activity },
        ]}
      />
    </Card>
  );
}

type OfficeMoreAccountCardProps = {
  email: string;
  roleLabel: string;
  isAdmin: boolean;
  deleteButtonTitle: string;
  onSwitchAdmin: () => void;
  onSignOut: () => void;
  onOpenSupport: () => void;
  onOpenTerms: () => void;
  onOpenPrivacy: () => void;
  onRequestDelete: () => void;
};

export function OfficeMoreAccountCard({
  email,
  roleLabel,
  isAdmin,
  deleteButtonTitle,
  onSwitchAdmin,
  onSignOut,
  onOpenSupport,
  onOpenTerms,
  onOpenPrivacy,
  onRequestDelete,
}: OfficeMoreAccountCardProps) {
  return (
    <Card>
      <SectionTitle title="الحساب" subtitle="إنهاء الجلسة الحالية من هذا الجهاز." />
      <SummaryRow title={email} subtitle={roleLabel} />
      {isAdmin ? (
        <Pressable onPress={onSwitchAdmin} style={[styles.signOutButton, styles.adminSwitchButton]}>
          <Text style={[styles.signOutText, styles.adminSwitchText]}>الانتقال إلى لوحة الإدارة</Text>
        </Pressable>
      ) : null}
      <Pressable onPress={onSignOut} style={styles.signOutButton}>
        <Text style={styles.signOutText}>تسجيل الخروج</Text>
      </Pressable>
      <View style={styles.accountActionsRow}>
        <PrimaryButton title="الدعم" onPress={onOpenSupport} secondary />
        <PrimaryButton title="الشروط" onPress={onOpenTerms} secondary />
      </View>
      <View style={styles.accountActionsRow}>
        <PrimaryButton title="الخصوصية" onPress={onOpenPrivacy} secondary />
        <PrimaryButton
          title={deleteButtonTitle}
          onPress={() =>
            Alert.alert(
              'طلب حذف الحساب',
              'سيتم إرسال طلب حذف الحساب للمراجعة مع التحقق من الهوية قبل التنفيذ. هل تريد المتابعة؟',
              [
                { text: 'إلغاء', style: 'cancel' },
                {
                  text: 'إرسال الطلب',
                  style: 'destructive',
                  onPress: onRequestDelete,
                },
              ],
            )
          }
          secondary
        />
      </View>
    </Card>
  );
}
