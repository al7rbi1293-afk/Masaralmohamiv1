import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import {
  Card,
  EmptyState,
  HeroCard,
  Page,
  PrimaryButton,
  StatusChip,
} from '../components/ui';
import { useAuth } from '../context/auth-context';
import { fetchAdminAudit, type AdminAuditLog } from '../features/admin/api';
import { AuditLogCard } from './admin-shared';
import { styles } from './admin.styles';

export function AdminAuditScreen() {
  const { session } = useAuth();
  const [logs, setLogs] = useState<AdminAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    if (!session?.token) return;
    setLoading(true);
    setError('');
    try {
      const data = await fetchAdminAudit(session.token);
      setLogs(data.logs);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'تعذر تحميل سجل التدقيق.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [session?.token]);

  return (
    <Page>
      <HeroCard
        eyebrow="الإدارة"
        title="سجل التدقيق"
        subtitle="آخر العمليات الإدارية داخل النظام."
        aside={<StatusChip label={String(logs.length)} tone="default" />}
      />

      <Card>
        <View style={styles.buttonRow}>
          <PrimaryButton title="تحديث" onPress={() => void load()} secondary />
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </Card>

      {loading ? (
        <Card><Text style={styles.message}>جارٍ تحميل السجل...</Text></Card>
      ) : logs.length ? (
        logs.map((log) => <AuditLogCard key={log.id} log={log} />)
      ) : (
        <EmptyState title="لا يوجد سجل" message="لم يتم العثور على عمليات تدقيق بعد." />
      )}
    </Page>
  );
}

