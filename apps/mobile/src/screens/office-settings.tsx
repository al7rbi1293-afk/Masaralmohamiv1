import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as DocumentPicker from 'expo-document-picker';
import { useIsFocused } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import {
  Image,
  Pressable,
  Text,
  View,
} from 'react-native';
import {
  fetchOfficeSettings,
  fetchOfficeSubscriptionOverview,
  saveOfficeSettings,
  type OfficeSettings,
  type OfficeSubscriptionOverview,
} from '../features/office/api';
import {
  Card,
  EmptyState,
  Field,
  HeroCard,
  LoadingBlock,
  Page,
  PrimaryButton,
  SectionTitle,
  StatCard,
  StatusChip,
} from '../components/ui';
import { useAuth } from '../context/auth-context';
import { formatCurrency, formatDate } from '../lib/format';
import type { OfficeStackParamList } from './office';
import { OfficeTeamSettingsScreen } from './office-team-settings';
import { styles } from './office-settings.styles';
import {
  ensureOfficeSession,
  requestStatusLabel,
  requestTone,
} from './office-settings.shared';

type SettingsHubProps = NativeStackScreenProps<OfficeStackParamList, 'OfficeSettingsHome'>;
type SettingsRouteProps = NativeStackScreenProps<OfficeStackParamList, 'OfficeSettings'>;
type OfficeSubscriptionRequestItem = OfficeSubscriptionOverview['recent_requests'][number];
const ENABLE_MOBILE_SUBSCRIPTION_REQUESTS = false;

function subscriptionPlanLabel(overview: OfficeSubscriptionOverview | null) {
  const code = String(overview?.subscription?.plan_code ?? '').trim().toUpperCase();
  if (code === 'TRIAL') {
    return 'تجربة';
  }

  return overview?.current_plan_card?.title || overview?.subscription?.plan_code || 'خطة المكتب';
}

function seatUsageLabel(value: number | null | undefined) {
  return value === null ? 'غير محدود' : String(value || 0);
}

export function OfficeSettingsHomeScreen({ navigation }: SettingsHubProps) {
  const { session } = useAuth();
  const isOwner = session?.kind === 'office' && session.portal === 'office' && session.role === 'owner';

  return (
    <Page>
      <HeroCard
        eyebrow="إدارة المكتب"
        title="الهوية، الفريق، والاشتراك"
        subtitle="كل إعدادات المكتب المهمة صارت داخل التطبيق نفسه وبواجهة Native مرتبة."
        aside={<StatusChip label={isOwner ? 'صلاحية كاملة' : 'قراءة فقط'} tone={isOwner ? 'success' : 'warning'} />}
      />

      {!isOwner ? (
        <EmptyState
          title="الصلاحية مطلوبة"
          message="هذه الشاشة مخصصة لمالك المكتب. استخدم حساب المالك للوصول إلى الهوية، الفريق، والاشتراك."
        />
      ) : (
        <Card>
          <SectionTitle title="المركز الإداري" subtitle="اختر القسم الذي تريد إدارته الآن." />
          <View style={styles.hubGrid}>
            <Pressable style={styles.hubCard} onPress={() => navigation.navigate('OfficeIdentitySettings')}>
              <Text style={styles.hubTitle}>هوية المكتب</Text>
              <Text style={styles.hubSubtitle}>الاسم، الشعار، الرقم الضريبي، العنوان</Text>
            </Pressable>
            <Pressable style={styles.hubCard} onPress={() => navigation.navigate('OfficeTeamSettings')}>
              <Text style={styles.hubTitle}>أعضاء الفريق</Text>
              <Text style={styles.hubSubtitle}>الدعوات، الإضافة المباشرة، الأدوار</Text>
            </Pressable>
            <Pressable style={styles.hubCard} onPress={() => navigation.navigate('OfficeSubscriptionSettings')}>
              <Text style={styles.hubTitle}>الخطة الحالية</Text>
              <Text style={styles.hubSubtitle}>عرض حالة الخطة الحالية والمقاعد المتاحة فقط</Text>
            </Pressable>
          </View>
        </Card>
      )}
    </Page>
  );
}

export function OfficeIdentitySettingsScreen() {
  const { session } = useAuth();
  const isFocused = useIsFocused();
  const [settings, setSettings] = useState<OfficeSettings | null>(null);
  const [name, setName] = useState('');
  const [taxNumber, setTaxNumber] = useState('');
  const [crNumber, setCrNumber] = useState('');
  const [address, setAddress] = useState('');
  const [logoFile, setLogoFile] = useState<{ uri: string; name: string; mimeType?: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const activeSession = ensureOfficeSession(session);
        setLoading(true);
        setError('');
        const next = await fetchOfficeSettings(activeSession);
        if (!mounted) return;
        setSettings(next.settings);
        setName(next.settings.name || '');
        setTaxNumber(next.settings.tax_number || '');
        setCrNumber(next.settings.cr_number || '');
        setAddress(next.settings.address || '');
      } catch (nextError) {
        if (mounted) {
          setError(nextError instanceof Error ? nextError.message : 'تعذر تحميل هوية المكتب.');
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
  }, [isFocused, session]);

  async function pickLogo() {
    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: false,
      type: 'image/*',
    });

    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset?.uri) return;

    setLogoFile({
      uri: asset.uri,
      name: asset.name || 'office-logo.png',
      mimeType: asset.mimeType,
    });
    setMessage(`تم اختيار الشعار: ${asset.name || 'office-logo.png'}`);
  }

  async function handleSave() {
    try {
      const activeSession = ensureOfficeSession(session);
      setSaving(true);
      setMessage('');
      setError('');
      const updated = await saveOfficeSettings(activeSession, {
        name,
        tax_number: taxNumber.trim() || null,
        cr_number: crNumber.trim() || null,
        address: address.trim() || null,
        logo_file: logoFile,
      });
      setSettings(updated.settings);
      setLogoFile(null);
      setMessage('تم حفظ هوية المكتب بنجاح.');
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'تعذر حفظ الهوية.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Page>
        <LoadingBlock />
      </Page>
    );
  }

  return (
    <Page>
      <HeroCard
        eyebrow="هوية المكتب"
        title={settings?.name || 'إعدادات المكتب'}
        subtitle="حدّث الشعار والبيانات الأساسية التي تظهر في الفواتير والمراسلات."
        aside={<StatusChip label="مربوط بالإنتاج" tone="success" />}
      />

      <Card>
        <SectionTitle title="البيانات الأساسية" subtitle="هذه البيانات مشتركة مع الموقع وتظهر مباشرة بعد الحفظ." />
        <Field label="اسم المكتب" value={name} onChangeText={setName} placeholder="اسم المكتب" />
        <Field label="الرقم الضريبي" value={taxNumber} onChangeText={setTaxNumber} placeholder="3000..." keyboardType="numeric" />
        <Field label="السجل التجاري" value={crNumber} onChangeText={setCrNumber} placeholder="1010..." keyboardType="numeric" />
        <Field label="العنوان" value={address} onChangeText={setAddress} placeholder="الرياض،..." />

        {(settings?.logo_url || logoFile) ? (
          <View style={styles.logoBlock}>
            {settings?.logo_url ? <Image source={{ uri: settings.logo_url }} style={styles.logoPreview} resizeMode="contain" /> : null}
            <Text style={styles.cardMeta}>{logoFile ? `شعار جديد: ${logoFile.name}` : 'الشعار الحالي للمكتب'}</Text>
          </View>
        ) : null}

        <View style={styles.buttonRow}>
          <PrimaryButton title="اختيار شعار" onPress={() => void pickLogo()} secondary />
          <PrimaryButton title={saving ? 'جارٍ الحفظ...' : 'حفظ الهوية'} onPress={() => void handleSave()} disabled={saving} />
        </View>
        {message ? <Text style={styles.message}>{message}</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </Card>
    </Page>
  );
}

export { OfficeTeamSettingsScreen } from './office-team-settings';

export function OfficeSubscriptionSettingsScreen() {
  const { session } = useAuth();
  const isFocused = useIsFocused();
  const [overview, setOverview] = useState<OfficeSubscriptionOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const activeSession = ensureOfficeSession(session);
        setLoading(true);
        setError('');
        const next = await fetchOfficeSubscriptionOverview(activeSession);
        if (!mounted) return;
        setOverview(next);
      } catch (nextError) {
        if (mounted) {
          setError(nextError instanceof Error ? nextError.message : 'تعذر تحميل الاشتراك.');
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
  }, [isFocused, session]);

  if (loading) {
    return (
      <Page>
        <LoadingBlock />
      </Page>
    );
  }

  return (
    <Page>
      <HeroCard
        eyebrow="الاشتراك"
        title={subscriptionPlanLabel(overview)}
        subtitle="عرض حالة الاشتراك الحالية والمقاعد المتاحة في نسخة الجوال."
        aside={<StatusChip label={requestStatusLabel(overview?.subscription?.status)} tone={requestTone(overview?.subscription?.status)} />}
      />

      <Card>
        <SectionTitle title="الوضع الحالي" subtitle="هذه المعلومات مرتبطة بنفس خطة الموقع." />
        <View style={styles.statsRow}>
          <StatCard label="المقاعد" value={seatUsageLabel(overview?.seat_usage.limit)} tone="gold" />
          <StatCard label="المستخدم" value={String(overview?.seat_usage.used || 0)} tone="success" />
          <StatCard label="المتاح" value={seatUsageLabel(overview?.seat_usage.available)} tone="default" />
        </View>
        <Text style={styles.cardMeta}>الخطة الحالية: {subscriptionPlanLabel(overview)}</Text>
        <Text style={styles.cardMeta}>نهاية الفترة: {formatDate(overview?.subscription?.current_period_end || null)}</Text>
      </Card>

      <Card>
        <SectionTitle title="إدارة الخطة" subtitle="نسخة المتجر تعرض الخطة الحالية فقط بدون شراء أو تحويل بنكي داخل التطبيق." />
        <Text style={styles.bodyText}>
          لأي تعديل على الخطة أو الاشتراك استخدم إدارة الحساب في الموقع أو تواصل مع فريق الدعم. هذا يحافظ على
          اتساق تجربة الجوال مع سياسات المتاجر.
        </Text>
        {!ENABLE_MOBILE_SUBSCRIPTION_REQUESTS ? (
          <StatusChip label="قراءة فقط" tone="warning" />
        ) : null}
      </Card>

      <Card>
        <SectionTitle title="آخر الطلبات السابقة" subtitle="عرض فقط لسجل الطلبات الموجودة سابقًا على الحساب." />
        {overview?.recent_requests.length ? (
          overview.recent_requests.map((item: OfficeSubscriptionRequestItem) => (
            <View key={item.id} style={styles.planCard}>
              <View style={styles.rowBetween}>
                <View style={styles.gapXs}>
                  <Text style={styles.cardTitle}>{item.plan_code}</Text>
                  <Text style={styles.cardMeta}>{formatDate(item.created_at)}</Text>
                </View>
                <StatusChip label={requestStatusLabel(item.status)} tone={requestTone(item.status)} />
              </View>
              <Text style={styles.cardMeta}>
                {item.amount ? `${formatCurrency(item.amount)}${item.currency ? ` ${item.currency}` : ''}` : 'بدون مبلغ مسجل'}
              </Text>
              <Text style={styles.cardMeta}>المرجع البنكي: {item.bank_reference || item.payment_reference || '—'}</Text>
              {item.review_note ? <Text style={styles.bodyText}>الملاحظة: {item.review_note}</Text> : null}
            </View>
          ))
        ) : (
          <EmptyState title="لا توجد طلبات" message="لا توجد طلبات اشتراك محفوظة لهذا المكتب حاليًا." />
        )}
      </Card>

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </Page>
  );
}

export function OfficeSettingsScreen({ route, navigation }: SettingsRouteProps) {
  const section = route.params?.section;

  useEffect(() => {
    if (section === 'identity') {
      navigation.setOptions({ title: 'هوية المكتب' });
      return;
    }

    if (section === 'team') {
      navigation.setOptions({ title: 'الفريق' });
      return;
    }

    if (section === 'subscription') {
      navigation.setOptions({ title: 'الخطة الحالية' });
      return;
    }

    navigation.setOptions({ title: 'إدارة المكتب' });
  }, [navigation, section]);

  if (section === 'identity') {
    return <OfficeIdentitySettingsScreen />;
  }

  if (section === 'team') {
    return <OfficeTeamSettingsScreen />;
  }

  if (section === 'subscription') {
    return <OfficeSubscriptionSettingsScreen />;
  }

  return <OfficeSettingsHomeScreen navigation={navigation as SettingsHubProps['navigation']} route={{ key: route.key, name: 'OfficeSettingsHome' } as SettingsHubProps['route']} />;
}
