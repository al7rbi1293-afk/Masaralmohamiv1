import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { Card, EmptyState, LoadingBlock, Page, SectionTitle, StatusChip } from '../components/ui';
import { useAuth } from '../context/auth-context';
import { fetchOfficeMatters, type MatterSummary } from '../lib/api';
import { formatDate } from '../lib/format';
import { colors } from '../theme';
import { styles } from './office.styles';
import { matterTone } from './office.utils';

export function OfficeMattersScreen({ navigation }: { navigation: any }) {
  const { session } = useAuth();
  const isFocused = useIsFocused();
  const [items, setItems] = useState<MatterSummary[]>([]);
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
        const payload = await fetchOfficeMatters(session.token);
        if (mounted) {
          setItems(payload.data);
        }
      } catch (nextError) {
        if (mounted) {
          setError(nextError instanceof Error ? nextError.message : 'تعذر تحميل القضايا.');
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
      `${item.title} ${item.client?.name || ''} ${item.case_type || ''} ${item.najiz_case_number || ''}`
        .toLowerCase()
        .includes(normalized),
    );
  }, [items, query]);

  return (
    <Page scroll={false}>
      <View style={styles.container}>
        <Card>
          <SectionTitle title="أوامر سريعة" subtitle="ابدأ من هنا إذا كنت تريد إضافة أو تعديلًا سريعًا." />
          <View style={styles.quickActionsGrid}>
            <Pressable style={styles.actionTile} onPress={() => navigation.navigate('OfficeMatterForm', { mode: 'create' })}>
              <Text style={styles.actionTileTitle}>قضية جديدة</Text>
              <Text style={styles.actionTileMeta}>إضافة ملف</Text>
            </Pressable>
            <Pressable style={styles.actionTile} onPress={() => navigation.navigate('OfficeTaskForm', { mode: 'create' })}>
              <Text style={styles.actionTileTitle}>مهمة جديدة</Text>
              <Text style={styles.actionTileMeta}>متابعة ملف</Text>
            </Pressable>
            <Pressable style={styles.actionTile} onPress={() => navigation.navigate('OfficeDocumentForm', { mode: 'create' })}>
              <Text style={styles.actionTileTitle}>مستند جديد</Text>
              <Text style={styles.actionTileMeta}>رفع ورقة</Text>
            </Pressable>
          </View>
        </Card>

        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="ابحث في القضايا أو أسماء الموكلين أو رقم ناجز"
          placeholderTextColor={colors.textMuted}
          style={styles.search}
          textAlign="right"
        />

        {loading ? <LoadingBlock /> : null}
        {!loading && error ? <Text style={styles.error}>{error}</Text> : null}
        {!loading && !filtered.length ? (
          <EmptyState title="لا توجد نتائج" message="جرّب تغيير كلمات البحث أو ابدأ بإضافة قضية جديدة من التطبيق." />
        ) : null}

        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => navigation.navigate('OfficeMatterDetails', { matterId: item.id, title: item.title })}
              style={styles.listItem}
            >
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{item.title}</Text>
                <Text style={styles.rowMeta}>
                  {[
                    item.client?.name || 'بدون موكل',
                    item.case_type || 'قضية عامة',
                    item.updated_at ? `آخر تحديث ${formatDate(item.updated_at)}` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </View>
              <View style={styles.rightMeta}>
                {item.is_private ? <StatusChip label="خاص" tone="gold" /> : null}
                <StatusChip label={item.status} tone={matterTone(item.status)} />
              </View>
            </Pressable>
          )}
        />
      </View>
    </Page>
  );
}
