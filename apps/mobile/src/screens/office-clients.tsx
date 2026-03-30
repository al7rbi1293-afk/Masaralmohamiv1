import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { Card, EmptyState, LoadingBlock, Page, SectionTitle, StatusChip } from '../components/ui';
import { useAuth } from '../context/auth-context';
import { fetchOfficeClients, type OfficeClient } from '../features/office/api';
import { colors } from '../theme';
import { styles } from './office.styles';

export function OfficeClientsScreen({ navigation }: { navigation: any }) {
  const { session } = useAuth();
  const isFocused = useIsFocused();
  const [items, setItems] = useState<OfficeClient[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!session?.token) return;

      setLoading(true);
      setError('');
      try {
        const payload = await fetchOfficeClients(session.token, { page: 1, limit: 50, status: 'all' });
        if (mounted) {
          setItems(payload.data);
        }
      } catch (nextError) {
        if (mounted) {
          setError(nextError instanceof Error ? nextError.message : 'تعذر تحميل العملاء.');
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
  }, [isFocused, session?.token]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return items;

    return items.filter((item) =>
      `${item.name} ${item.email || ''} ${item.phone || ''} ${item.identity_no || ''} ${item.commercial_no || ''}`
        .toLowerCase()
        .includes(normalized),
    );
  }, [items, query]);

  return (
    <Page scroll={false}>
      <View style={styles.container}>
        <Card>
          <SectionTitle title="إدارة العملاء" subtitle="إنشاء وتعديل ملفات الموكلين من نفس التطبيق." />
          <View style={styles.quickActionsGrid}>
            <Pressable style={styles.actionTile} onPress={() => navigation.navigate('OfficeClientForm', { mode: 'create' })}>
              <Text style={styles.actionTileTitle}>عميل جديد</Text>
              <Text style={styles.actionTileMeta}>ملف موكل جديد</Text>
            </Pressable>
            <Pressable style={styles.actionTile} onPress={() => navigation.navigate('OfficeMatterForm', { mode: 'create' })}>
              <Text style={styles.actionTileTitle}>قضية جديدة</Text>
              <Text style={styles.actionTileMeta}>ابدأها من العميل</Text>
            </Pressable>
          </View>
        </Card>

        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="ابحث باسم العميل أو بريده أو جواله أو رقم الهوية"
          placeholderTextColor={colors.textMuted}
          style={styles.search}
          textAlign="right"
        />

        {loading ? <LoadingBlock /> : null}
        {!loading && error ? <Text style={styles.error}>{error}</Text> : null}
        {!loading && !filtered.length ? (
          <EmptyState title="لا يوجد عملاء" message="ابدأ بإضافة عميل جديد أو عدّل كلمات البحث." />
        ) : null}

        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable
              onPress={() =>
                navigation.navigate('OfficeClientForm', {
                  mode: 'edit',
                  client: {
                    id: item.id,
                    type: item.type,
                    name: item.name,
                    email: item.email || '',
                    phone: item.phone || '',
                    identity_no: item.identity_no || '',
                    commercial_no: item.commercial_no || '',
                    agency_number: item.agency_number || '',
                    address: item.address || '',
                    notes: item.notes || '',
                  },
                })
              }
              style={styles.listItem}
            >
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{item.name}</Text>
                <Text style={styles.rowMeta}>
                  {[
                    item.type === 'company' ? 'شركة' : 'فرد',
                    item.email || 'بدون بريد',
                    item.phone || 'بدون جوال',
                  ].join(' · ')}
                </Text>
              </View>
              <View style={styles.rightMeta}>
                <StatusChip
                  label={item.status === 'archived' ? 'مؤرشف' : 'نشط'}
                  tone={item.status === 'archived' ? 'warning' : 'success'}
                />
              </View>
            </Pressable>
          )}
        />
      </View>
    </Page>
  );
}
