import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Card, Field, Page, PrimaryButton, SectionTitle } from '../components/ui';
import { useAuth } from '../context/auth-context';
import {
  createOfficeClient,
  deleteOfficeClient,
  updateOfficeClient,
  type OfficeClientWritePayload,
} from '../features/office/api';
import { colors } from '../theme';
import { FormFooter, FormHeader } from './office-form-shared';
import { styles } from './office.styles';
import type { OfficeStackParamList } from './office';

type OfficeClientFormProps = NativeStackScreenProps<OfficeStackParamList, 'OfficeClientForm'>;

export function OfficeClientFormScreen({ route, navigation }: OfficeClientFormProps) {
  const { session } = useAuth();
  const draft = route.params.client ?? {};
  const [type, setType] = useState<OfficeClientWritePayload['type']>(draft.type === 'company' ? 'company' : 'person');
  const [name, setName] = useState(String(draft.name ?? ''));
  const [email, setEmail] = useState(String(draft.email ?? ''));
  const [phone, setPhone] = useState(String(draft.phone ?? ''));
  const [identityNo, setIdentityNo] = useState(String(draft.identity_no ?? ''));
  const [commercialNo, setCommercialNo] = useState(String(draft.commercial_no ?? ''));
  const [address, setAddress] = useState(String(draft.address ?? ''));
  const [agencyNumber, setAgencyNumber] = useState(String(draft.agency_number ?? ''));
  const [notes, setNotes] = useState(String(draft.notes ?? ''));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  async function submit() {
    if (!session?.token) return;
    setSaving(true);
    setMessage('');
    try {
      const payload: OfficeClientWritePayload = {
        type,
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || null,
        identity_no: identityNo.trim() || null,
        commercial_no: commercialNo.trim() || null,
        address: address.trim() || null,
        agency_number: agencyNumber.trim() || null,
        notes: notes.trim() || null,
      };
      route.params.mode === 'edit' && draft.id
        ? await updateOfficeClient({ token: session.token, orgId: session.orgId }, { ...payload, id: draft.id })
        : await createOfficeClient({ token: session.token, orgId: session.orgId }, payload);
      setMessage(`تم حفظ العميل: ${name.trim()}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'تعذر حفظ العميل.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Page>
      <FormHeader
        eyebrow={route.params.mode === 'edit' ? 'تعديل عميل' : 'عميل جديد'}
        title={route.params.mode === 'edit' ? 'تحديث بيانات العميل' : 'إضافة عميل جديد'}
        subtitle="هذا النموذج يحفظ مباشرة في قاعدة البيانات نفسها المرتبطة بالموقع."
        tone={route.params.mode === 'edit' ? 'warning' : 'success'}
      />
      <Card>
        <SectionTitle title="البيانات الأساسية" />
        <View style={styles.typeRow}>
          {(['person', 'company'] as const).map((item) => (
            <Pressable key={item} onPress={() => setType(item)} style={[styles.typeChip, type === item && styles.typeChipActive]}>
              <Text style={[styles.typeChipText, type === item && styles.typeChipTextActive]}>{item === 'person' ? 'فرد' : 'شركة'}</Text>
            </Pressable>
          ))}
        </View>
        <Field label="الاسم" value={name} onChangeText={setName} placeholder="اسم العميل" />
        <Field label="البريد" value={email} onChangeText={setEmail} placeholder="client@example.com" keyboardType="email-address" />
        <Field label="الجوال" value={phone} onChangeText={setPhone} placeholder="05xxxxxxxx" keyboardType="default" />
        <Field label="رقم الهوية / السجل" value={identityNo} onChangeText={setIdentityNo} placeholder="رقم الهوية" />
        <Field label="الرقم التجاري" value={commercialNo} onChangeText={setCommercialNo} placeholder="الرقم التجاري" />
        <Field label="رقم الوكالة" value={agencyNumber} onChangeText={setAgencyNumber} placeholder="اختياري" />
        <Field label="العنوان" value={address} onChangeText={setAddress} placeholder="العنوان" />
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>ملاحظات</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="ملاحظات داخلية"
            placeholderTextColor={colors.textMuted}
            multiline
            style={styles.multiline}
            textAlign="right"
          />
        </View>
        {message ? <Text style={styles.formMessage}>{message}</Text> : null}
        {route.params.mode === 'edit' && draft.id ? (
          <PrimaryButton
            title="حذف العميل"
            secondary
            onPress={async () => {
              if (!session?.token || !draft.id) return;
              setSaving(true);
              setMessage('');
              try {
                await deleteOfficeClient({ token: session.token, orgId: session.orgId }, { id: draft.id });
                navigation.goBack();
              } catch (error) {
                setMessage(error instanceof Error ? error.message : 'تعذر حذف العميل.');
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
          submitLabel={route.params.mode === 'edit' ? 'حفظ التعديل' : 'إنشاء العميل'}
        />
      </Card>
    </Page>
  );
}
