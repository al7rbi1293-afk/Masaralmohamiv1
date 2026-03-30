import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Card, Field, Page, PrimaryButton, SectionTitle, StatusChip } from '../components/ui';
import { useAuth } from '../context/auth-context';
import {
  createOfficeMatter,
  deleteOfficeMatter,
  updateOfficeMatter,
  type OfficeMatterWritePayload,
} from '../features/office/api';
import { colors } from '../theme';
import { FormFooter, FormHeader, SelectionList, useOfficeDirectory } from './office-form-shared';
import { styles } from './office.styles';
import type { OfficeStackParamList } from './office';

type OfficeMatterFormProps = NativeStackScreenProps<OfficeStackParamList, 'OfficeMatterForm'>;

export function OfficeMatterFormScreen({ route, navigation }: OfficeMatterFormProps) {
  const { session } = useAuth();
  const draft = route.params.matter ?? {};
  const { clientOptions } = useOfficeDirectory(session?.token);
  const [clientId, setClientId] = useState(String(draft.client_id ?? ''));
  const [clientQuery, setClientQuery] = useState('');
  const [title, setTitle] = useState(String(draft.title ?? ''));
  const [status, setStatus] = useState<NonNullable<OfficeMatterWritePayload['status']>>(draft.status ?? 'new');
  const [summary, setSummary] = useState(String(draft.summary ?? ''));
  const [najizCaseNumber, setNajizCaseNumber] = useState(String(draft.najiz_case_number ?? ''));
  const [caseType, setCaseType] = useState(String(draft.case_type ?? ''));
  const [claims, setClaims] = useState(String(draft.claims ?? ''));
  const [privacy, setPrivacy] = useState(Boolean(draft.is_private));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  async function submit() {
    if (!session?.token) return;
    setSaving(true);
    setMessage('');
    try {
      const payload: OfficeMatterWritePayload = {
        client_id: clientId.trim() || null,
        title: title.trim(),
        status,
        summary: summary.trim() || null,
        najiz_case_number: najizCaseNumber.trim() || null,
        case_type: caseType.trim() || null,
        claims: claims.trim() || null,
        is_private: privacy,
      };
      route.params.mode === 'edit' && draft.id
        ? await updateOfficeMatter({ token: session.token, orgId: session.orgId }, { ...payload, id: draft.id })
        : await createOfficeMatter({ token: session.token, orgId: session.orgId }, payload);
      setMessage(`تم حفظ القضية: ${title.trim()}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'تعذر حفظ القضية.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Page>
      <FormHeader
        eyebrow={route.params.mode === 'edit' ? 'تعديل قضية' : 'قضية جديدة'}
        title={route.params.mode === 'edit' ? 'تحديث ملف قانوني' : 'إنشاء ملف قانوني جديد'}
        subtitle="اختر عميلًا من الدليل الحالي ثم أضف وصفًا وحالة وتفاصيل ناجز."
        tone={route.params.mode === 'edit' ? 'warning' : 'success'}
      />
      <Card>
        <SectionTitle title="العميل والقضية" />
        <SelectionList
          label="العميل"
          selectedId={clientId}
          query={clientQuery}
          onQueryChange={setClientQuery}
          onSelect={setClientId}
          options={clientOptions}
          placeholder="ابحث برقم أو اسم العميل"
        />
        <Field label="عنوان القضية" value={title} onChangeText={setTitle} placeholder="مثال: نزاع تجاري" />
        <View style={styles.selectionListInline}>
          {(['new', 'in_progress', 'on_hold', 'closed', 'archived'] as const).map((item) => (
            <Pressable key={item} onPress={() => setStatus(item)} style={[styles.typeChip, status === item && styles.typeChipActive]}>
              <Text style={[styles.typeChipText, status === item && styles.typeChipTextActive]}>{item}</Text>
            </Pressable>
          ))}
        </View>
        <Field label="رقم ناجز" value={najizCaseNumber} onChangeText={setNajizCaseNumber} placeholder="اختياري" />
        <Field label="نوع القضية" value={caseType} onChangeText={setCaseType} placeholder="مثال: تجاري / عمالي" />
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>الملخص</Text>
          <TextInput
            value={summary}
            onChangeText={setSummary}
            placeholder="ملخص مختصر"
            placeholderTextColor={colors.textMuted}
            multiline
            style={styles.multiline}
            textAlign="right"
          />
        </View>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>الطلبات / المطالبات</Text>
          <TextInput
            value={claims}
            onChangeText={setClaims}
            placeholder="تفاصيل المطالبات"
            placeholderTextColor={colors.textMuted}
            multiline
            style={styles.multiline}
            textAlign="right"
          />
        </View>
        <Pressable onPress={() => setPrivacy((current) => !current)} style={styles.toggleRow}>
          <Text style={styles.rowTitle}>{privacy ? 'قضية خاصة' : 'قضية عامة'}</Text>
          <StatusChip label={privacy ? 'خاص' : 'عام'} tone={privacy ? 'gold' : 'success'} />
        </Pressable>
        {message ? <Text style={styles.formMessage}>{message}</Text> : null}
        {route.params.mode === 'edit' && draft.id ? (
          <PrimaryButton
            title="حذف القضية"
            secondary
            onPress={async () => {
              if (!session?.token || !draft.id) return;
              setSaving(true);
              setMessage('');
              try {
                await deleteOfficeMatter({ token: session.token, orgId: session.orgId }, { id: draft.id });
                navigation.goBack();
              } catch (error) {
                setMessage(error instanceof Error ? error.message : 'تعذر حذف القضية.');
              } finally {
                setSaving(false);
              }
            }}
          />
        ) : null}
        <FormFooter
          saving={saving}
          onSubmit={submit}
          onCancel={() => navigation.goBack()}
          submitLabel={route.params.mode === 'edit' ? 'حفظ القضية' : 'إنشاء القضية'}
        />
      </Card>
    </Page>
  );
}
