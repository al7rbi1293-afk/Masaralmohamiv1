import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Card, Field, Page, PrimaryButton, SectionTitle, StatusChip } from '../components/ui';
import { useAuth } from '../context/auth-context';
import {
  createOfficeInvoice,
  createOfficeQuote,
  type OfficeBillingItem,
} from '../features/office/api';
import { colors } from '../theme';
import { FormFooter, FormHeader, SelectionList, useOfficeDirectory } from './office-form-shared';
import { styles } from './office.styles';
import type { OfficeStackParamList } from './office';

type OfficeBillingFormProps = NativeStackScreenProps<OfficeStackParamList, 'OfficeBillingForm'>;

export function OfficeBillingFormScreen({ route, navigation }: OfficeBillingFormProps) {
  const { session } = useAuth();
  const draft = route.params.draft ?? {};
  const { clientOptions, matterOptions } = useOfficeDirectory(session?.token);
  const [clientId, setClientId] = useState(String(draft.client_id ?? ''));
  const [matterId, setMatterId] = useState(String(draft.matter_id ?? ''));
  const [clientQuery, setClientQuery] = useState('');
  const [matterQuery, setMatterQuery] = useState('');
  const [items, setItems] = useState<OfficeBillingItem[]>(draft.items?.length ? draft.items : [{ desc: '', qty: 1, unit_price: 0 }]);
  const [taxEnabled, setTaxEnabled] = useState(false);
  const [tax, setTax] = useState('0');
  const [taxNumber, setTaxNumber] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  function updateItem(index: number, key: keyof OfficeBillingItem, value: string) {
    setItems((current) =>
      current.map((item, itemIndex) => {
        if (itemIndex !== index) return item;
        if (key === 'qty' || key === 'unit_price') {
          return { ...item, [key]: Number(value) || 0 };
        }
        return { ...item, [key]: value };
      }),
    );
  }

  async function submit(kind: 'quote' | 'invoice') {
    if (!session?.token) return;
    setSaving(true);
    setMessage('');
    try {
      if (kind === 'quote') {
        const result = await createOfficeQuote(
          { token: session.token, orgId: session.orgId },
          {
            client_id: clientId.trim(),
            matter_id: matterId.trim() || null,
            items,
            tax_enabled: taxEnabled,
            tax: Number(tax) || 0,
            tax_number: taxNumber.trim() || null,
            status: 'draft',
          },
        );
        setMessage(`تم إنشاء عرض السعر: ${result.number}`);
      } else {
        const result = await createOfficeInvoice(
          { token: session.token, orgId: session.orgId },
          {
            client_id: clientId.trim(),
            matter_id: matterId.trim() || null,
            items,
            tax_enabled: taxEnabled,
            tax: Number(tax) || 0,
            tax_number: taxNumber.trim() || null,
            due_at: dueAt.trim() || null,
          },
        );
        setMessage(`تم إنشاء الفاتورة: ${result.number}`);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'تعذر حفظ الفاتورة أو العرض.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Page>
      <FormHeader
        eyebrow={route.params.mode === 'quote' ? 'عرض سعر جديد' : 'فاتورة جديدة'}
        title={route.params.mode === 'quote' ? 'إنشاء عرض سعر' : 'إنشاء فاتورة'}
        subtitle="العروض والفواتير تُنشأ الآن مباشرة على نفس النظام المحاسبي المرتبط بالموقع."
        tone="gold"
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
          placeholder="اختر العميل"
        />
        <SelectionList
          label="القضية"
          selectedId={matterId}
          query={matterQuery}
          onQueryChange={setMatterQuery}
          onSelect={setMatterId}
          options={matterOptions}
          placeholder="اختر القضية (اختياري)"
        />
        <Field label="الرقم الضريبي" value={taxNumber} onChangeText={setTaxNumber} placeholder="اختياري" />
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>الضريبة</Text>
          <TextInput
            value={tax}
            onChangeText={setTax}
            placeholder="0"
            placeholderTextColor={colors.textMuted}
            keyboardType="numeric"
            style={styles.input}
            textAlign="right"
          />
        </View>
        <Pressable onPress={() => setTaxEnabled((current) => !current)} style={styles.toggleRow}>
          <Text style={styles.rowTitle}>تفعيل الضريبة</Text>
          <StatusChip label={taxEnabled ? 'مفعّل' : 'متوقف'} tone={taxEnabled ? 'success' : 'default'} />
        </Pressable>
        {route.params.mode === 'invoice' ? (
          <Field label="تاريخ الاستحقاق" value={dueAt} onChangeText={setDueAt} placeholder="YYYY-MM-DD" />
        ) : null}
      </Card>
      <Card>
        <SectionTitle title="بنود المحتوى" subtitle="أضف سطرًا واحدًا أو أكثر قبل الحفظ." />
        {items.map((item, index) => (
          <View key={`${index}-${item.desc}`} style={styles.itemBlock}>
            <Field label={`الوصف ${index + 1}`} value={item.desc} onChangeText={(value) => updateItem(index, 'desc', value)} placeholder="خدمة أو بند" />
            <Field label="الكمية" value={String(item.qty)} onChangeText={(value) => updateItem(index, 'qty', value)} placeholder="1" keyboardType="numeric" />
            <Field
              label="سعر الوحدة"
              value={String(item.unit_price)}
              onChangeText={(value) => updateItem(index, 'unit_price', value)}
              placeholder="0"
              keyboardType="numeric"
            />
          </View>
        ))}
        <PrimaryButton
          title="إضافة بند"
          secondary
          onPress={() => setItems((current) => [...current, { desc: '', qty: 1, unit_price: 0 }])}
        />
      </Card>
      <Card>
        {message ? <Text style={styles.formMessage}>{message}</Text> : null}
        <FormFooter
          saving={saving}
          onSubmit={() => submit(route.params.mode)}
          onCancel={() => navigation.goBack()}
          submitLabel={route.params.mode === 'quote' ? 'حفظ العرض' : 'حفظ الفاتورة'}
        />
      </Card>
    </Page>
  );
}
