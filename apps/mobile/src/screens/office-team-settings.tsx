import { useIsFocused } from '@react-navigation/native';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import {
  addOfficeTeamMember,
  changeOfficeTeamMemberRole,
  createOfficeTeamInvitation,
  fetchOfficeTeamOverview,
  removeOfficeTeamMember,
  revokeOfficeTeamInvitation,
  updateOfficeTeamMember,
  type OfficeTeamInvitation,
  type OfficeTeamMember,
  type OfficeTeamOverview,
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
import { formatDate } from '../lib/format';
import { styles } from './office-settings.styles';
import {
  PermissionToggleGroup,
  ensureOfficeSession,
  roleLabel,
  roleOptions,
} from './office-settings.shared';

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

  const seatLimitLabel = overview?.seat_summary.seat_limit === null ? 'مفتوح' : String(overview?.seat_summary.seat_limit || 0);
  const remainingSeatsLabel = overview?.seat_summary.remaining_seats === null ? 'مفتوح' : String(overview?.seat_summary.remaining_seats || 0);
  const seatSummaryLabel =
    overview?.seat_summary.seat_limit === null
      ? `${overview?.seat_summary.member_count || 0}/مفتوح`
      : `${overview?.seat_summary.member_count || 0}/${overview?.seat_summary.seat_limit || 0} مقعد`;

  return (
    <Page>
      <HeroCard
        eyebrow="الفريق"
        title="إدارة أعضاء المكتب"
        subtitle="الأعضاء، الدعوات، والإضافة المباشرة كلها من التطبيق نفسه."
        aside={<StatusChip label={seatSummaryLabel} tone="gold" />}
      />

      <Card>
        <SectionTitle title="سعة الفريق" subtitle="مرتبطة مباشرة بخطة الاشتراك الحالية." />
        <View style={styles.statsRow}>
          <StatCard label="المستخدم" value={String(overview?.seat_summary.member_count || 0)} tone="success" />
          <StatCard label="المتاح" value={remainingSeatsLabel} tone="gold" />
          <StatCard label="الحد" value={seatLimitLabel} tone="default" />
        </View>
        {overview?.seat_summary.seat_limit === null ? (
          <Text style={styles.cardMeta}>
            الحساب التجريبي يسمح حاليًا بإضافة أعضاء بدون حد ثابت.
          </Text>
        ) : overview?.seat_summary.remaining_seats === 0 ? (
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
