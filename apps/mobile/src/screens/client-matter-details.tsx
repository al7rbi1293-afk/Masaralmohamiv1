import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Alert, Text, TextInput, View } from 'react-native';
import { Card, EmptyState, HeroCard, Page, PrimaryButton, SectionTitle, StatusChip } from '../components/ui';
import { useAuth } from '../context/auth-context';
import type { ClientPortalMatterCommunication } from '../features/client/types';
import { formatDate, formatDateTime } from '../lib/format';
import { colors } from '../theme';
import type { ClientStackParamList } from './client';
import { SummaryRow, statusTone, styles, submitClientPortalCommunication } from './client-shared';

type ClientMatterDetailsProps = NativeStackScreenProps<ClientStackParamList, 'ClientMatterDetails'>;

export function ClientMatterDetailsScreen({ route }: ClientMatterDetailsProps) {
  const { session } = useAuth();
  const matter = route.params.matter;
  const [communications, setCommunications] = useState<ClientPortalMatterCommunication[]>(matter.communications);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  async function handleSendQuestion() {
    if (!session?.token) return;

    const text = message.trim();
    if (text.length < 4) {
      setError('اكتب رسالة أو سؤالًا أوضح قبل الإرسال.');
      return;
    }

    setSending(true);
    setError('');

    try {
      const payload = await submitClientPortalCommunication(session.token, {
        matterId: matter.id,
        message: text,
      });
      setCommunications((current) => [payload.communication, ...current]);
      setMessage('');
      Alert.alert('تم الإرسال', 'تم إرسال رسالتك إلى المكتب بنجاح.');
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'تعذر إرسال الرسالة الآن.');
    } finally {
      setSending(false);
    }
  }

  return (
    <Page>
      <HeroCard
        eyebrow="تفاصيل القضية"
        title={matter.title}
        subtitle={matter.summary || 'لا يوجد ملخص إضافي حالياً.'}
        aside={<StatusChip label={matter.status} tone={statusTone(matter.status)} />}
      />

      <Card>
        <SectionTitle title="آخر التحديثات" />
        {matter.events.length ? (
          matter.events.map((event) => (
            <SummaryRow
              key={event.id}
              title={event.type}
              subtitle={[event.note || 'بدون ملاحظة', formatDateTime(event.created_at)].join(' · ')}
              status={event.event_date ? formatDate(event.event_date) : undefined}
            />
          ))
        ) : (
          <EmptyState title="لا توجد تحديثات" message="سيظهر هنا كل تحديث جديد يرسله المكتب على هذه القضية." />
        )}
      </Card>

      <Card>
        <SectionTitle title="التواصل" subtitle="الرسائل الأساسية بينك وبين المكتب." />
        {communications.length ? (
          communications.map((item) => (
            <SummaryRow
              key={item.id}
              title={item.sender === 'CLIENT' ? 'أنت' : 'المكتب'}
              subtitle={[item.message, formatDateTime(item.created_at)].join(' · ')}
              status={item.sender === 'CLIENT' ? 'مرسلة' : 'واردة'}
              tone={item.sender === 'CLIENT' ? 'gold' : 'success'}
            />
          ))
        ) : (
          <EmptyState title="لا توجد رسائل" message="لم يتم تسجيل مراسلات أساسية على هذه القضية بعد." />
        )}

        <View style={styles.compose}>
          <Text style={styles.fieldLabel}>أرسل استفسارًا للمكتب</Text>
          <TextInput
            value={message}
            onChangeText={setMessage}
            placeholder="اكتب سؤالك أو التحديث الذي تريد إرساله"
            placeholderTextColor={colors.textMuted}
            style={[styles.search, styles.multilineInput]}
            multiline
            textAlign="right"
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <PrimaryButton title={sending ? 'جارٍ الإرسال...' : 'إرسال الرسالة'} onPress={() => void handleSendQuestion()} disabled={sending} />
        </View>
      </Card>
    </Page>
  );
}
