import { useEffect, useMemo, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import {
  Card,
  EmptyState,
  Field,
  HeroCard,
  Page,
  PrimaryButton,
  SectionTitle,
  StatusChip,
} from '../components/ui';
import { useAuth } from '../context/auth-context';
import {
  fetchAdminUsers,
  updateAdminUsers,
  type AdminPendingUser,
  type AdminUser,
} from '../features/admin/api';
import { AdminPendingUserCard, AdminUserCard } from './admin-shared';
import { styles } from './admin.styles';

export function AdminUsersScreen() {
  const { session } = useAuth();
  const [draftQuery, setDraftQuery] = useState('');
  const [query, setQuery] = useState('');
  const [payload, setPayload] = useState<{ users: AdminUser[]; pending: AdminPendingUser[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionId, setActionId] = useState<string | null>(null);

  async function load(nextQuery = query) {
    if (!session?.token) return;
    setLoading(true);
    setError('');
    try {
      const data = await fetchAdminUsers(session.token, nextQuery, 1, 50);
      setPayload({ users: data.users, pending: data.pending });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'تعذر تحميل المستخدمين.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [session?.token]);

  function confirmUserAction(title: string, onConfirm: () => void, destructive = false) {
    Alert.alert(title, 'هل تريد المتابعة؟', [
      { text: 'إلغاء', style: 'cancel' },
      { text: title, style: destructive ? 'destructive' : 'default', onPress: onConfirm },
    ]);
  }

  async function handleUserAction(payloadAction: { action: 'suspend' | 'activate' | 'delete_pending' | 'delete'; user_id?: string; user_ids?: string[] }, busyId: string) {
    if (!session?.token) return;
    setActionId(busyId);
    setError('');
    try {
      await updateAdminUsers(session.token, payloadAction);
      await load();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'تعذر تنفيذ العملية.');
    } finally {
      setActionId(null);
    }
  }

  const olderPendingIds = useMemo(() => (payload?.pending ?? []).filter((item) => item.older_than_3h).map((item) => item.user_id), [payload?.pending]);

  return (
    <Page>
      <HeroCard
        eyebrow="الإدارة"
        title="المستخدمون"
        subtitle="إدارة الحسابات المفعلة وغير المفعلة."
        aside={<StatusChip label={String((payload?.users.length || 0) + (payload?.pending.length || 0))} tone="gold" />}
      />

      <Card>
        <Field label="البحث" value={draftQuery} onChangeText={setDraftQuery} placeholder="الاسم أو البريد أو الجوال" />
        <View style={styles.buttonRow}>
          <PrimaryButton
            title="بحث"
            onPress={() => {
              setQuery(draftQuery.trim());
              void load(draftQuery.trim());
            }}
          />
          <PrimaryButton
            title="مسح"
            onPress={() => {
              setDraftQuery('');
              setQuery('');
              void load('');
            }}
            secondary
          />
        </View>
        {olderPendingIds.length ? (
          <PrimaryButton
            title={`حذف غير المفعلة الأقدم (${olderPendingIds.length})`}
            onPress={() =>
              confirmUserAction('حذف الحسابات غير المفعلة', () => {
                void handleUserAction({ action: 'delete_pending', user_ids: olderPendingIds }, 'bulk-pending');
              }, true)
            }
            secondary
          />
        ) : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </Card>

      {loading ? (
        <Card><Text style={styles.message}>جارٍ تحميل المستخدمين...</Text></Card>
      ) : (
        <>
          <Card>
            <SectionTitle title="الحسابات غير المفعلة" subtitle={query ? `نتائج البحث: ${query}` : 'الحسابات التي لم تُفعّل بعد'} />
            {payload?.pending.length ? (
              payload.pending.map((user) => (
                <AdminPendingUserCard
                  key={user.user_id}
                  user={user}
                  actionId={actionId}
                  onDelete={() =>
                    confirmUserAction('حذف الحساب', () => {
                      void handleUserAction({ action: 'delete_pending', user_id: user.user_id }, user.user_id);
                    }, true)
                  }
                />
              ))
            ) : (
              <EmptyState title="لا توجد حسابات معلقة" message="كل الحسابات الحالية مفعلة أو لا توجد نتائج." />
            )}
          </Card>

          <Card>
            <SectionTitle title="الحسابات المفعلة" subtitle="إدارة التعليق والتفعيل والحذف." />
            {payload?.users.length ? (
              payload.users.map((user) => (
                <AdminUserCard
                  key={user.user_id}
                  user={user}
                  actionId={actionId}
                  onToggleStatus={() =>
                    confirmUserAction(user.status === 'suspended' ? 'تفعيل المستخدم' : 'تعليق المستخدم', () => {
                      void handleUserAction(
                        { action: user.status === 'suspended' ? 'activate' : 'suspend', user_id: user.user_id },
                        user.user_id,
                      );
                    })
                  }
                  onDelete={() =>
                    confirmUserAction('حذف المستخدم', () => {
                      void handleUserAction({ action: 'delete', user_id: user.user_id }, user.user_id);
                    }, true)
                  }
                />
              ))
            ) : (
              <EmptyState title="لا توجد حسابات" message="لم يتم العثور على مستخدمين مطابقين." />
            )}
          </Card>
        </>
      )}
    </Page>
  );
}
