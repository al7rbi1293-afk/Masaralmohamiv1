import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as DocumentPicker from 'expo-document-picker';
import { useState } from 'react';
import { Pressable, Text } from 'react-native';
import { Card, Field, Page, SectionTitle } from '../components/ui';
import { useAuth } from '../context/auth-context';
import { uploadOfficeDocumentFile } from '../features/office/api';
import { FormFooter, FormHeader, SelectionList, useOfficeDirectory } from './office-form-shared';
import { styles } from './office.styles';
import type { OfficeStackParamList } from './office';

type OfficeDocumentFormProps = NativeStackScreenProps<OfficeStackParamList, 'OfficeDocumentForm'>;

export function OfficeDocumentFormScreen({ route, navigation }: OfficeDocumentFormProps) {
  const { session } = useAuth();
  const draft = route.params.draft ?? {};
  const { clientOptions, matterOptions } = useOfficeDirectory(session?.token);
  const [title, setTitle] = useState(String(draft.title ?? ''));
  const [matterId, setMatterId] = useState(String(draft.matter_id ?? ''));
  const [clientId, setClientId] = useState(String(draft.client_id ?? ''));
  const [matterQuery, setMatterQuery] = useState('');
  const [clientQuery, setClientQuery] = useState('');
  const [folder, setFolder] = useState(String(draft.folder ?? '/'));
  const [tagsText, setTagsText] = useState(Array.isArray(draft.tags) ? draft.tags.join(', ') : String(draft.tags ?? ''));
  const [file, setFile] = useState<{ uri: string; name: string; mimeType?: string | null; size: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  async function pickFile() {
    const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false });
    if (result.canceled) return;
    const asset = result.assets[0];
    setFile({
      uri: asset.uri,
      name: asset.name,
      mimeType: asset.mimeType ?? null,
      size: asset.size ?? 0,
    });
  }

  async function submit() {
    if (!session?.token) return;
    setSaving(true);
    setMessage('');
    try {
      const result = await uploadOfficeDocumentFile(
        { token: session.token, orgId: session.orgId },
        {
          title: title.trim(),
          matterId: matterId.trim() || null,
          clientId: clientId.trim() || null,
          folder: folder.trim() || '/',
          tags: tagsText
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean),
          file,
        },
      );
      setMessage(result.uploaded ? `تم رفع المستند: ${result.document.title}` : `تم إنشاء المستند: ${result.document.title}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'تعذر حفظ المستند.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Page>
      <FormHeader
        eyebrow="مستند جديد"
        title="إنشاء أو رفع مستند"
        subtitle="المستندات يمكن رفعها الآن فعليًا عبر روابط التحميل الموقعة من نفس الموقع."
        tone="success"
      />
      <Card>
        <SectionTitle title="بيانات المستند" />
        <Field label="العنوان" value={title} onChangeText={setTitle} placeholder="اسم المستند" />
        <SelectionList
          label="القضية"
          selectedId={matterId}
          query={matterQuery}
          onQueryChange={setMatterQuery}
          onSelect={setMatterId}
          options={matterOptions}
          placeholder="ابحث أو اختر القضية"
        />
        <SelectionList
          label="العميل"
          selectedId={clientId}
          query={clientQuery}
          onQueryChange={setClientQuery}
          onSelect={setClientId}
          options={clientOptions}
          placeholder="ابحث أو اختر العميل"
        />
        <Field label="المجلد" value={folder} onChangeText={setFolder} placeholder="/contracts" />
        <Field label="الوسوم" value={tagsText} onChangeText={setTagsText} placeholder="agreement, urgent" />
        <Pressable onPress={pickFile} style={styles.filePicker}>
          <Text style={styles.rowTitle}>{file ? file.name : 'اختيار ملف من الجهاز'}</Text>
          <Text style={styles.rowMeta}>{file ? `${Math.round(file.size / 1024)} KB` : 'PDF أو صورة أو أي ملف مناسب'}</Text>
        </Pressable>
        {message ? <Text style={styles.formMessage}>{message}</Text> : null}
        <FormFooter saving={saving} onSubmit={submit} onCancel={() => navigation.goBack()} submitLabel="حفظ المستند" />
      </Card>
    </Page>
  );
}
