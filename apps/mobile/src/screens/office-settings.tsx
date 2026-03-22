import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as DocumentPicker from 'expo-document-picker';
import { useIsFocused } from '@react-navigation/native';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  addOfficeTeamMember,
  changeOfficeTeamMemberRole,
  createOfficeTeamInvitation,
  fetchOfficeSettings,
  fetchOfficeSubscriptionOverview,
  fetchOfficeTeamOverview,
  removeOfficeTeamMember,
  revokeOfficeTeamInvitation,
  saveOfficeSettings,
  updateOfficeTeamMember,
  type OfficeSettings,
  type OfficeSubscriptionOverview,
  type OfficeTeamOverview,
  type OfficeTeamInvitation,
  type OfficeTeamMember,
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
  SegmentedControl,
  StatCard,
  StatusChip,
} from '../components/ui';
import { useAuth } from '../context/auth-context';
import { formatCurrency, formatDate } from '../lib/format';
import { colors, fonts, radius, spacing } from '../theme';
import type { OfficeStackParamList } from './office';

type SettingsHubProps = NativeStackScreenProps<OfficeStackParamList, 'OfficeSettingsHome'>;
type SettingsRouteProps = NativeStackScreenProps<OfficeStackParamList, 'OfficeSettings'>;
type OfficeSubscriptionRequestItem = OfficeSubscriptionOverview['recent_requests'][number];
const ENABLE_MOBILE_SUBSCRIPTION_REQUESTS = false;

const permissionOptions = [
  { key: 'matters', label: 'القضايا' },
  { key: 'clients', label: 'العملاء' },
  { key: 'billing', label: 'الفوترة' },
  { key: 'settings', label: 'الإعدادات' },
] as const;

const roleOptions: Array<{ key: OfficeTeamMember['role']; label: string }> = [
  { key: 'owner', label: 'مالك' },
  { key: 'lawyer', label: 'محامٍ' },
  { key: 'assistant', label: 'مساعد' },
];

function roleLabel(value: string | null | undefined) {
  switch (String(value ?? '').toLowerCase()) {
    case 'owner':
      return 'مالك';
    case 'lawyer':
      return 'محامٍ';
    case 'assistant':
      return 'مساعد';
    default:
      return value || '—';
  }
}

function requestStatusLabel(value: string | null | undefined) {
  switch (String(value ?? '').toLowerCase()) {
    case 'pending':
      return 'قيد المراجعة';
    case 'approved':
      return 'مقبول';
    case 'rejected':
      return 'مرفوض';
    case 'active':
      return 'نشط';
    case 'trial':
      return 'تجريبي';
    case 'expired':
      return 'منتهي';
    default:
      return value || '—';
  }
}

function requestTone(value: string | null | undefined): 'default' | 'success' | 'warning' | 'danger' | 'gold' {
  switch (String(value ?? '').toLowerCase()) {
    case 'approved':
    case 'active':
      return 'success';
    case 'pending':
    case 'trial':
      return 'warning';
    case 'rejected':
    case 'expired':
      return 'danger';
    default:
      return 'gold';
  }
}

function ensureOfficeSession(session: ReturnType<typeof useAuth>['session']) {
  if (!session || session.kind !== 'office') {
    throw new Error('يجب تسجيل الدخول بحساب المكتب أولاً.');
  }

  if (session.portal !== 'office') {
    throw new Error('هذه الشاشة متاحة من بوابة المكتب فقط.');
  }

  return {
    token: session.token,
    orgId: session.orgId,
    role: session.role,
  };
}

function PermissionToggleGroup({
  value,
  onToggle,
}: {
  value: Record<string, boolean>;
  onToggle: (key: string) => void;
}) {
  return (
    <View style={styles.permissionsRow}>
      {permissionOptions.map((permission) => {
        const active = Boolean(value[permission.key]);
        return (
          <Pressable
            key={permission.key}
            onPress={() => onToggle(permission.key)}
            style={[styles.permissionChip, active && styles.permissionChipActive]}
          >
            <Text style={[styles.permissionChipText, active && styles.permissionChipTextActive]}>
              {permission.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
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

export function OfficeTeamSettingsScreen() {
  const { session } = useAuth();
  const isFocused = useIsFocused();
  const [overview, setOverview] = useState<OfficeTeamOverview | null>(null);
  const [section, setSection] = useState<'members' | 'invitations' | 'add'>('members');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [selectedMemberId, setSelectedMemberId] = useState<string>('');
  const [editFullName, setEditFullName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editLicense, setEditLicense] = useState('');
  const [editPermissions, setEditPermissions] = useState<Record<string, boolean>>({});
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<OfficeTeamMember['role']>('lawyer');
  const [inviteExpiry, setInviteExpiry] = useState<'24h' | '7d'>('7d');
  const [addFullName, setAddFullName] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [addPassword, setAddPassword] = useState('');
  const [addLicense, setAddLicense] = useState('');
  const [addRole, setAddRole] = useState<OfficeTeamMember['role']>('lawyer');
  const [addPermissions, setAddPermissions] = useState<Record<string, boolean>>({
    matters: true,
    clients: true,
    billing: false,
    settings: false,
  });

  const selectedMember = useMemo(
    () => overview?.members.find((member) => member.user_id === selectedMemberId) ?? null,
    [overview?.members, selectedMemberId],
  );

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const activeSession = ensureOfficeSession(session);
        setLoading(true);
        setError('');
        const next = await fetchOfficeTeamOverview(activeSession);
        if (!mounted) return;
        setOverview(next);
        if (!selectedMemberId && next.members[0]) {
          primeEditState(next.members[0]);
        }
      } catch (nextError) {
        if (mounted) {
          setError(nextError instanceof Error ? nextError.message : 'تعذر تحميل أعضاء الفريق.');
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

  function primeEditState(member: OfficeTeamMember) {
    setSelectedMemberId(member.user_id);
    setEditFullName(member.full_name || '');
    setEditEmail(member.email || '');
    setEditPhone(member.phone || '');
    setEditLicense(member.license_number || '');
    setEditPermissions(member.permissions || {});
  }

  function togglePermissions(
    current: Record<string, boolean>,
    setter: (value: Record<string, boolean>) => void,
    key: string,
  ) {
    setter({
      ...current,
      [key]: !current[key],
    });
  }

  async function reloadOverview() {
    const activeSession = ensureOfficeSession(session);
      const next = await fetchOfficeTeamOverview(activeSession);
      setOverview(next);
    if (selectedMemberId) {
      const refreshed = next.members.find((member) => member.user_id === selectedMemberId);
      if (refreshed) {
        primeEditState(refreshed);
      }
    }
  }

  async function handleInvite() {
    try {
      const activeSession = ensureOfficeSession(session);
      setSaving(true);
      setMessage('');
      setError('');
      const response = await createOfficeTeamInvitation(activeSession, {
        email: inviteEmail.trim().toLowerCase(),
        role: inviteRole,
        expiresIn: inviteExpiry,
      });
      setInviteEmail('');
      await reloadOverview();
      setSection('invitations');
      setMessage(`تم إنشاء الدعوة ويمكن مشاركتها الآن. ${response.inviteUrl}`);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'تعذر إنشاء الدعوة.');
    } finally {
      setSaving(false);
    }
  }

  async function handleAddMember() {
    try {
      const activeSession = ensureOfficeSession(session);
      setSaving(true);
      setMessage('');
      setError('');
      await addOfficeTeamMember(activeSession, {
        fullName: addFullName.trim(),
        email: addEmail.trim().toLowerCase(),
        password: addPassword,
        licenseNumber: addLicense.trim() || null,
        role: addRole,
        permissions: addPermissions,
      });
      setAddFullName('');
      setAddEmail('');
      setAddPassword('');
      setAddLicense('');
      setAddRole('lawyer');
      setAddPermissions({ matters: true, clients: true, billing: false, settings: false });
      await reloadOverview();
      setSection('members');
      setMessage('تمت إضافة العضو بنجاح.');
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'تعذر إضافة العضو.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveMember() {
    if (!selectedMember) return;
    try {
      const activeSession = ensureOfficeSession(session);
      setSaving(true);
      setMessage('');
      setError('');
      await updateOfficeTeamMember(activeSession, selectedMember.user_id, {
        fullName: editFullName.trim(),
        email: editEmail.trim().toLowerCase(),
        phone: editPhone.trim() || null,
        licenseNumber: editLicense.trim() || null,
        permissions: editPermissions,
      });
      await reloadOverview();
      setMessage('تم تحديث بيانات العضو.');
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'تعذر تحديث بيانات العضو.');
    } finally {
      setSaving(false);
    }
  }

  async function handleChangeRole(member: OfficeTeamMember, role: OfficeTeamMember['role']) {
    try {
      const activeSession = ensureOfficeSession(session);
      setSaving(true);
      setMessage('');
      setError('');
      await changeOfficeTeamMemberRole(activeSession, member.user_id, role);
      await reloadOverview();
      setMessage(`تم تحديث دور ${member.full_name}.`);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'تعذر تحديث الدور.');
    } finally {
      setSaving(false);
    }
  }

  async function handleRemoveMember(member: OfficeTeamMember) {
    Alert.alert('إزالة عضو', `هل تريد إزالة ${member.full_name} من المكتب؟`, [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'إزالة',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              const activeSession = ensureOfficeSession(session);
              setSaving(true);
              setMessage('');
              setError('');
              await removeOfficeTeamMember(activeSession, member.user_id);
              await reloadOverview();
              setMessage(`تمت إزالة ${member.full_name}.`);
            } catch (nextError) {
              setError(nextError instanceof Error ? nextError.message : 'تعذر إزالة العضو.');
            } finally {
              setSaving(false);
            }
          })();
        },
      },
    ]);
  }

  async function handleRevoke(invitation: OfficeTeamInvitation) {
    try {
      const activeSession = ensureOfficeSession(session);
      setSaving(true);
      setMessage('');
      setError('');
      await revokeOfficeTeamInvitation(activeSession, invitation.id);
      await reloadOverview();
      setMessage(`تم إلغاء دعوة ${invitation.email}.`);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'تعذر إلغاء الدعوة.');
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
        eyebrow="الفريق"
        title="إدارة أعضاء المكتب"
        subtitle="الأعضاء، الدعوات، والإضافة المباشرة كلها من التطبيق نفسه."
        aside={<StatusChip label={`${overview?.seat_summary.member_count || 0}/${overview?.seat_summary.seat_limit || 0} مقعد`} tone="gold" />}
      />

      <Card>
        <SectionTitle title="سعة الفريق" subtitle="مرتبطة مباشرة بخطة الاشتراك الحالية." />
        <View style={styles.statsRow}>
          <StatCard label="المستخدم" value={String(overview?.seat_summary.member_count || 0)} tone="success" />
          <StatCard label="المتاح" value={String(overview?.seat_summary.remaining_seats || 0)} tone="gold" />
          <StatCard label="الحد" value={String(overview?.seat_summary.seat_limit || 0)} tone="default" />
        </View>
        {overview?.seat_summary.remaining_seats === 0 ? (
          <Text style={styles.cardMeta}>
            المقاعد الحالية ممتلئة على باقة {overview.seat_summary.plan_label || overview.seat_summary.plan_code || 'المكتب'}.
            افتح الاشتراك للترقية ثم أعد إرسال الدعوات أو إضافة الأعضاء.
          </Text>
        ) : null}
      </Card>

      <Card>
        <SectionTitle title="تنظيم الفريق" subtitle="قسّم الإدارة بين الأعضاء، الدعوات، والإضافة المباشرة." />
        <SegmentedControl
          value={section}
          onChange={(next) => setSection(next as typeof section)}
          options={[
            { key: 'members', label: `الأعضاء (${overview?.members.length || 0})` },
            { key: 'invitations', label: `الدعوات (${overview?.invitations.length || 0})` },
            { key: 'add', label: 'إضافة مباشرة' },
          ]}
        />
      </Card>

      {section === 'members' ? (
        <>
          <Card>
            <SectionTitle title="الأعضاء الحاليون" subtitle="غيّر الدور أو افتح العضو للتعديل الكامل." />
            {overview?.members.length ? (
              overview.members.map((member) => (
                <Pressable
                  key={member.user_id}
                  style={[styles.memberCard, selectedMemberId === member.user_id && styles.memberCardActive]}
                  onPress={() => primeEditState(member)}
                >
                  <View style={styles.rowBetween}>
                    <View style={styles.gapXs}>
                      <Text style={styles.cardTitle}>{member.full_name || member.email || member.user_id}</Text>
                      <Text style={styles.cardMeta}>{member.email || '—'}</Text>
                    </View>
                    <StatusChip label={roleLabel(member.role)} tone={member.role === 'owner' ? 'gold' : 'default'} />
                  </View>
                  <Text style={styles.cardMeta}>الجوال: {member.phone || '—'}</Text>
                  <Text style={styles.cardMeta}>الرخصة: {member.license_number || '—'}</Text>
                  <View style={styles.roleSelectorRow}>
                    {roleOptions.map((option) => (
                      <Pressable
                        key={option.key}
                        style={[styles.roleSelector, member.role === option.key && styles.roleSelectorActive]}
                        onPress={() => void handleChangeRole(member, option.key)}
                      >
                        <Text style={[styles.roleSelectorText, member.role === option.key && styles.roleSelectorTextActive]}>
                          {option.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  {!member.is_current_user ? (
                    <View style={styles.buttonRow}>
                      <PrimaryButton title="تحرير" onPress={() => primeEditState(member)} secondary />
                      <PrimaryButton title="إزالة" onPress={() => void handleRemoveMember(member)} disabled={saving} />
                    </View>
                  ) : null}
                </Pressable>
              ))
            ) : (
              <EmptyState title="لا يوجد أعضاء" message="ابدأ بدعوة أول عضو أو أضفه مباشرة." />
            )}
          </Card>

          {selectedMember ? (
            <Card>
              <SectionTitle title="تعديل العضو" subtitle="حدّث الاسم والبريد والصلاحيات للعضو المحدد." />
              <Field label="الاسم الكامل" value={editFullName} onChangeText={setEditFullName} placeholder="الاسم الكامل" />
              <Field label="البريد الإلكتروني" value={editEmail} onChangeText={setEditEmail} placeholder="mail@example.com" keyboardType="email-address" />
              <Field label="رقم الجوال" value={editPhone} onChangeText={setEditPhone} placeholder="05..." keyboardType="numeric" />
              <Field label="رقم الرخصة" value={editLicense} onChangeText={setEditLicense} placeholder="اختياري" />
              <Text style={styles.fieldLabel}>صلاحيات العضو</Text>
              <PermissionToggleGroup value={editPermissions} onToggle={(key) => togglePermissions(editPermissions, setEditPermissions, key)} />
              <PrimaryButton title={saving ? 'جارٍ الحفظ...' : 'حفظ التعديلات'} onPress={() => void handleSaveMember()} disabled={saving} />
            </Card>
          ) : null}
        </>
      ) : null}

      {section === 'invitations' ? (
        <>
          <Card>
            <SectionTitle title="دعوة عضو" subtitle="أرسل رابط الانضمام بالبريد ليكمل العضو إنشاء حسابه." />
            <Field label="البريد الإلكتروني" value={inviteEmail} onChangeText={setInviteEmail} placeholder="member@example.com" keyboardType="email-address" />
            <Text style={styles.fieldLabel}>الدور</Text>
            <View style={styles.roleSelectorRow}>
              {roleOptions.map((option) => (
                <Pressable
                  key={option.key}
                  style={[styles.roleSelector, inviteRole === option.key && styles.roleSelectorActive]}
                  onPress={() => setInviteRole(option.key)}
                >
                  <Text style={[styles.roleSelectorText, inviteRole === option.key && styles.roleSelectorTextActive]}>
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.fieldLabel}>مدة صلاحية الدعوة</Text>
            <SegmentedControl
              value={inviteExpiry}
              onChange={(next) => setInviteExpiry(next as '24h' | '7d')}
              options={[
                { key: '24h', label: '24 ساعة' },
                { key: '7d', label: '7 أيام' },
              ]}
            />
            <PrimaryButton title={saving ? 'جارٍ الإرسال...' : 'إرسال الدعوة'} onPress={() => void handleInvite()} disabled={saving} />
          </Card>

          <Card>
            <SectionTitle title="الدعوات الحالية" subtitle="تابع الدعوات المرسلة وألغِ أي دعوة غير مطلوبة." />
            {overview?.invitations.length ? (
              overview.invitations.map((invitation) => (
                <View key={invitation.id} style={styles.memberCard}>
                  <View style={styles.rowBetween}>
                    <View style={styles.gapXs}>
                      <Text style={styles.cardTitle}>{invitation.email}</Text>
                      <Text style={styles.cardMeta}>تنتهي في {formatDate(invitation.expires_at)}</Text>
                    </View>
                    <StatusChip label={roleLabel(invitation.role)} tone="gold" />
                  </View>
                  <PrimaryButton title="إلغاء الدعوة" onPress={() => void handleRevoke(invitation)} disabled={saving} secondary />
                </View>
              ))
            ) : (
              <EmptyState title="لا توجد دعوات" message="كل دعوات الفريق ستظهر هنا لحين قبولها أو إلغائها." />
            )}
          </Card>
        </>
      ) : null}

      {section === 'add' ? (
        <Card>
          <SectionTitle title="إضافة مباشرة" subtitle="أنشئ عضوًا جديدًا مباشرة داخل المكتب بدون انتظار الدعوة." />
          <Field label="الاسم الكامل" value={addFullName} onChangeText={setAddFullName} placeholder="اسم العضو" />
          <Field label="البريد الإلكتروني" value={addEmail} onChangeText={setAddEmail} placeholder="member@example.com" keyboardType="email-address" />
          <Field label="كلمة المرور" value={addPassword} onChangeText={setAddPassword} placeholder="كلمة مرور مؤقتة" secureTextEntry />
          <Field label="رقم الرخصة" value={addLicense} onChangeText={setAddLicense} placeholder="اختياري" />
          <Text style={styles.fieldLabel}>الدور</Text>
          <View style={styles.roleSelectorRow}>
            {roleOptions.map((option) => (
              <Pressable
                key={option.key}
                style={[styles.roleSelector, addRole === option.key && styles.roleSelectorActive]}
                onPress={() => setAddRole(option.key)}
              >
                <Text style={[styles.roleSelectorText, addRole === option.key && styles.roleSelectorTextActive]}>
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.fieldLabel}>الصلاحيات الأولية</Text>
          <PermissionToggleGroup value={addPermissions} onToggle={(key) => togglePermissions(addPermissions, setAddPermissions, key)} />
          <PrimaryButton title={saving ? 'جارٍ الإضافة...' : 'إضافة العضو'} onPress={() => void handleAddMember()} disabled={saving} />
        </Card>
      ) : null}

      {message ? <Text style={styles.message}>{message}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </Page>
  );
}

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
        title={overview?.current_plan_card?.title || 'خطة المكتب'}
        subtitle="عرض حالة الاشتراك الحالية والمقاعد المتاحة في نسخة الجوال."
        aside={<StatusChip label={requestStatusLabel(overview?.subscription?.status)} tone={requestTone(overview?.subscription?.status)} />}
      />

      <Card>
        <SectionTitle title="الوضع الحالي" subtitle="هذه المعلومات مرتبطة بنفس خطة الموقع." />
        <View style={styles.statsRow}>
          <StatCard label="المقاعد" value={String(overview?.seat_usage.limit || 0)} tone="gold" />
          <StatCard label="المستخدم" value={String(overview?.seat_usage.used || 0)} tone="success" />
          <StatCard label="المتاح" value={String(overview?.seat_usage.available || 0)} tone="default" />
        </View>
        <Text style={styles.cardMeta}>الخطة الحالية: {overview?.current_plan_card?.title || overview?.subscription?.plan_code || '—'}</Text>
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

const styles = StyleSheet.create({
  hubGrid: {
    gap: spacing.sm,
  },
  hubCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs,
    backgroundColor: colors.surfaceMuted,
  },
  hubTitle: {
    fontFamily: fonts.arabicBold,
    fontSize: 18,
    color: colors.primary,
    textAlign: 'right',
  },
  hubSubtitle: {
    fontFamily: fonts.arabicRegular,
    fontSize: 13,
    lineHeight: 22,
    color: colors.textMuted,
    textAlign: 'right',
  },
  rowBetween: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  gapXs: {
    gap: spacing.xs,
  },
  statsRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  message: {
    fontFamily: fonts.arabicMedium,
    color: colors.primary,
    textAlign: 'right',
  },
  error: {
    fontFamily: fonts.arabicMedium,
    color: colors.danger,
    textAlign: 'right',
  },
  fieldLabel: {
    fontFamily: fonts.arabicSemiBold,
    fontSize: 13,
    color: colors.text,
    textAlign: 'right',
  },
  logoBlock: {
    gap: spacing.sm,
    alignItems: 'flex-end',
  },
  logoPreview: {
    width: 84,
    height: 84,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
  },
  cardTitle: {
    fontFamily: fonts.arabicBold,
    fontSize: 16,
    color: colors.text,
    textAlign: 'right',
  },
  cardMeta: {
    fontFamily: fonts.arabicRegular,
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'right',
  },
  bodyText: {
    fontFamily: fonts.arabicRegular,
    fontSize: 14,
    lineHeight: 24,
    color: colors.text,
    textAlign: 'right',
  },
  memberCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    padding: spacing.md,
    gap: spacing.sm,
  },
  memberCardActive: {
    borderColor: colors.gold,
    backgroundColor: '#fff8ec',
  },
  roleSelectorRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  roleSelector: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surface,
  },
  roleSelectorActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  roleSelectorText: {
    fontFamily: fonts.arabicMedium,
    color: colors.text,
  },
  roleSelectorTextActive: {
    color: '#fff',
  },
  permissionsRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  permissionChip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surface,
  },
  permissionChipActive: {
    backgroundColor: colors.goldSoft,
    borderColor: colors.gold,
  },
  permissionChipText: {
    fontFamily: fonts.arabicMedium,
    color: colors.text,
  },
  permissionChipTextActive: {
    color: colors.primary,
  },
  planList: {
    gap: spacing.sm,
  },
  planCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs,
    backgroundColor: colors.surfaceMuted,
  },
  planCardActive: {
    borderColor: colors.primary,
    backgroundColor: '#f0f7f5',
  },
  buttonRow: {
    flexDirection: 'row-reverse',
    gap: spacing.sm,
  },
});
