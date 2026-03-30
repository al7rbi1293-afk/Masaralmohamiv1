import { useMemo, useState } from 'react';
import { FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { EmptyState, LoadingBlock, Page, StatusChip } from '../components/ui';
import { formatDate } from '../lib/format';
import { colors } from '../theme';
import { statusTone, styles, useClientOverviewData } from './client-shared';

export function ClientMattersScreen({ navigation }: { navigation: any }) {
  const { data, loading, error } = useClientOverviewData();
  const [query, setQuery] = useState('');

  const matters = data?.bootstrap.matters || [];
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return matters;
    return matters.filter((matter) =>
      `${matter.title} ${matter.summary || ''} ${matter.case_type || ''}`.toLowerCase().includes(normalized),
    );
  }, [matters, query]);

  return (
    <Page scroll={false}>
      <View style={styles.container}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="ابحث في القضايا أو الملخص"
          placeholderTextColor={colors.textMuted}
          style={styles.search}
          textAlign="right"
        />

        {loading ? <LoadingBlock /> : null}
        {!loading && error ? <Text style={styles.error}>{error}</Text> : null}

        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable onPress={() => navigation.navigate('ClientMatterDetails', { matter: item })} style={styles.listItem}>
              <View style={styles.rowText}>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.meta}>
                  {[item.case_type || 'ملف قانوني', `آخر تحديث ${formatDate(item.updated_at)}`].join(' · ')}
                </Text>
              </View>
              <StatusChip label={item.status} tone={statusTone(item.status)} />
            </Pressable>
          )}
          ListEmptyComponent={
            !loading ? <EmptyState title="لا توجد قضايا" message="لا توجد قضايا مرتبطة بحسابك حالياً." /> : null
          }
        />
      </View>
    </Page>
  );
}
