import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Card, Field, Page, PrimaryButton, SectionTitle } from '../components/ui';
import { useAuth } from '../context/auth-context';
import {
  createOfficeTask,
  deleteOfficeTask,
  updateOfficeTask,
  type OfficeTaskWritePayload,
} from '../features/office/api';
import { colors } from '../theme';
import { FormFooter, FormHeader, SelectionList, useOfficeDirectory } from './office-form-shared';
import { styles } from './office.styles';
import type { OfficeStackParamList } from './office';

type OfficeTaskFormProps = NativeStackScreenProps<OfficeStackParamList, 'OfficeTaskForm'>;

export function OfficeTaskFormScreen({ route, navigation }: OfficeTaskFormProps) {
  const { session } = useAuth();
  const draft = route.params.task ?? {};
  const { matterOptions } = useOfficeDirectory(session?.token);
  const [title, setTitle] = useState(String(draft.title ?? ''));
  const [description, setDescription] = useState(String(draft.description ?? ''));
  const [matterId, setMatterId] = useState(String(draft.matter_id ?? ''));
  const [matterQuery, setMatterQuery] = useState('');
  const [dueAt, setDueAt] = useState(String(draft.due_at ? String(draft.due_at).slice(0, 10) : ''));
  const [priority, setPriority] = useState<NonNullable<OfficeTaskWritePayload['priority']>>(draft.priority === 'low' || draft.priority === 'high' ? draft.priority : 'medium');
  const [status, setStatus] = useState<NonNullable<OfficeTaskWritePayload['status']>>(draft.status ?? 'todo');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  async function submit() {
    if (!session?.token) return;
    setSaving(true);
    setMessage('');
    try {
      const payload: OfficeTaskWritePayload = {
        title: title.trim(),
        description: description.trim() || null,
        matter_id: matterId.trim() || null,
        due_at: dueAt.trim() || null,
        priority,
        status,
      };
      const result = route.params.mode === 'edit' && draft.id
        ? await updateOfficeTask({ token: session.token, orgId: session.orgId }, { ...payload, id: draft.id })
        : await createOfficeTask({ token: session.token, orgId: session.orgId }, payload);
      setMessage(`تم حفظ المهمة: ${result.task.title}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'تعذر حفظ المهمة.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Page>
      <FormHeader
        eyebrow={route.params.mode === 'edit' ? 'تعديل مهمة' : 'مهمة جديدة'}
        title={route.params.mode === 'edit' ? 'تحديث مهمة قائمة' : 'إنشاء مهمة جديدة'}
        subtitle="المهام هنا مرتبطة فعليًا بنفس النظام الحالي وتظهر فورًا في الموقع."
        tone={route.params.mode === 'edit' ? 'warning' : 'success'}
      />
      <Card>
        <SectionTitle title="تفاصيل المهمة" />
        <Field label="عنوان المهمة" value={title} onChangeText={setTitle} placeholder="مثال: مراجعة الرد" />
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>الوصف</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="تفاصيل المهمة"
            placeholderTextColor={colors.textMuted}
            multiline
            style={styles.multiline}
            textAlign="right"
          />
        </View>
        <SelectionList
          label="القضية المرتبطة"
          selectedId={matterId}
          query={matterQuery}
          onQueryChange={setMatterQuery}
          onSelect={setMatterId}
          options={matterOptions}
          placeholder="ابحث أو اختر القضية"
        />
        <Field label="تاريخ الاستحقاق" value={dueAt} onChangeText={setDueAt} placeholder="YYYY-MM-DD" />
        <View style={styles.selectionListInline}>
          {(['low', 'medium', 'high'] as const).map((item) => (
            <Pressable key={item} onPress={() => setPriority(item)} style={[styles.typeChip, priority === item && styles.typeChipActive]}>
              <Text style={[styles.typeChipText, priority === item && styles.typeChipTextActive]}>{item}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.selectionListInline}>
          {(['todo', 'doing', 'done', 'canceled'] as const).map((item) => (
            <Pressable key={item} onPress={() => setStatus(item)} style={[styles.typeChip, status === item && styles.typeChipActive]}>
              <Text style={[styles.typeChipText, status === item && styles.typeChipTextActive]}>{item}</Text>
            </Pressable>
          ))}
        </View>
        {message ? <Text style={styles.formMessage}>{message}</Text> : null}
        {route.params.mode === 'edit' && draft.id ? (
          <PrimaryButton
            title="حذف المهمة"
            secondary
            onPress={async () => {
              if (!session?.token || !draft.id) return;
              setSaving(true);
              setMessage('');
              try {
                await deleteOfficeTask({ token: session.token, orgId: session.orgId }, { id: draft.id });
                navigation.goBack();
              } catch (error) {
                setMessage(error instanceof Error ? error.message : 'تعذر حذف المهمة.');
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
          submitLabel={route.params.mode === 'edit' ? 'حفظ المهمة' : 'إنشاء المهمة'}
        />
      </Card>
    </Page>
  );
}
