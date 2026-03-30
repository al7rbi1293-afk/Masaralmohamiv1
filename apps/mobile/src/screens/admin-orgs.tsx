import { useEffect, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import {
  Card,
  EmptyState,
  Field,
  HeroCard,
  Page,
  PrimaryButton,
  StatusChip,
} from '../components/ui';
import { useAuth } from '../context/auth-context';
import {
  fetchAdminOrgs,
  updateAdminOrg,
  type AdminOrg,
} from '../features/admin/api';
import { AdminOrgCard } from './admin-shared';
import { styles } from './admin.styles';

export function AdminOrgsScreen() {
  const { session } = useAuth();
  const [draftQuery, setDraftQuery] = useState('');
  const [query, setQuery] = useState('');
  const [orgs, setOrgs] = useState<AdminOrg[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionId, setActionId] = useState<string | null>(null);
  const [planByOrg, setPlanByOrg] = useState<Record<string, string>>({});
  const [durationByOrg, setDurationByOrg] = useState<Record<string, string>>({});

  async function load(nextQuery = query) {
    if (!session?.token) return;
    setLoading(true);
    setError('');
    try {
      const data = await fetchAdminOrgs(session.token, nextQuery, 1, 50);
      setOrgs(data.orgs);
      setPlanByOrg((current) => {
        const next = { ...current };
        for (const org of data.orgs) {
          next[org.id] = next[org.id] || org.subscription?.plan || 'MEDIUM_OFFICE';
        }
        return next;
      });
      setDurationByOrg((current) => {
        const next = { ...current };
        for (const org of data.orgs) {
          next[org.id] = next[org.id] || 'year';
        }
        return next;
      });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'تعذر تحميل المكاتب.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [session?.token]);

  function confirmOrgAction(title: string, onConfirm: () => void, destructive = false) {
    Alert.alert(title, 'هل تريد المتابعة؟', [
      { text: 'إلغاء', style: 'cancel' },
      { text: title, style: destructive ? 'destructive' : 'default', onPress: onConfirm },
    ]);
  }

  async function handleOrgAction(
    org: AdminOrg,
    action: 'suspend' | 'activate' | 'delete' | 'extend_trial' | 'activate_subscription' | 'grant_lifetime' | 'set_plan',
  ) {
    if (!session?.token) return;
    setActionId(org.id);
    setError('');
    try {
      const extra_data =
        action === 'activate_subscription'
          ? {
              plan: planByOrg[org.id] || org.subscription?.plan || 'MEDIUM_OFFICE',
              duration_mode: durationByOrg[org.id] || 'year',
            }
          : action === 'set_plan'
            ? {
                plan: planByOrg[org.id] || org.subscription?.plan || 'MEDIUM_OFFICE',
              }
            : action === 'extend_trial'
              ? { days: 14 }
              : undefined;

      await updateAdminOrg(session.token, {
        org_id: org.id,
        action,
        extra_data,
      });
      await load();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'تعذر تنفيذ العملية.');
    } finally {
      setActionId(null);
    }
  }

  return (
    <Page>
      <HeroCard
        eyebrow="الإدارة"
        title="المكاتب"
        subtitle="إدارة المكاتب والاشتراكات والتجارب."
        aside={<StatusChip label={String(orgs.length)} tone="warning" />}
      />

      <Card>
        <Field label="البحث" value={draftQuery} onChangeText={setDraftQuery} placeholder="اسم المكتب" />
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
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </Card>

      {loading ? (
        <Card><Text style={styles.message}>جارٍ تحميل المكاتب...</Text></Card>
      ) : orgs.length ? (
        orgs.map((org) => (
          <AdminOrgCard
            key={org.id}
            org={org}
            actionId={actionId}
            planValue={planByOrg[org.id] || org.subscription?.plan || 'MEDIUM_OFFICE'}
            durationValue={durationByOrg[org.id] || 'year'}
            onPlanChange={(value) => setPlanByOrg((current) => ({ ...current, [org.id]: value }))}
            onDurationChange={(value) => setDurationByOrg((current) => ({ ...current, [org.id]: value }))}
            onAction={(action) =>
              confirmOrgAction(
                action === 'delete'
                  ? 'حذف المكتب'
                  : action === 'grant_lifetime'
                    ? 'منح اشتراك مدى الحياة'
                    : action === 'extend_trial'
                      ? 'تمديد التجربة'
                      : action === 'set_plan'
                        ? 'تغيير الخطة'
                        : action === 'activate_subscription'
                          ? 'تفعيل الاشتراك'
                          : action === 'activate'
                            ? 'تفعيل المكتب'
                            : 'تعليق المكتب',
                () => {
                  void handleOrgAction(org, action);
                },
                action === 'delete',
              )
            }
          />
        ))
      ) : (
        <EmptyState title="لا توجد مكاتب" message="لم يتم العثور على مكاتب مطابقة." />
      )}
    </Page>
  );
}
