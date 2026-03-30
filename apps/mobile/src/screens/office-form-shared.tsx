import { useIsFocused } from '@react-navigation/native';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import {
  fetchOfficeClients,
  type OfficeClient,
} from '../features/office/api';
import {
  fetchOfficeMatters,
  type MatterSummary,
} from '../lib/api';
import { colors } from '../theme';
import { HeroCard, PrimaryButton, StatusChip } from '../components/ui';
import { styles } from './office.styles';

export type SelectOption = {
  id: string;
  label: string;
  subtitle?: string | null;
};

export function useOfficeDirectory(token: string | undefined) {
  const isFocused = useIsFocused();
  const [clients, setClients] = useState<OfficeClient[]>([]);
  const [matters, setMatters] = useState<MatterSummary[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!token) return;
      setLoading(true);
      try {
        const [mattersPayload, clientsPayload] = await Promise.all([
          fetchOfficeMatters(token),
          fetchOfficeClients(token, { page: 1, limit: 50, status: 'all' }),
        ]);

        if (mounted) {
          setMatters(mattersPayload.data);
          setClients(clientsPayload.data);
        }
      } catch {
        if (mounted) {
          setMatters([]);
          setClients([]);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void load();

    return () => {
      mounted = false;
    };
  }, [isFocused, token]);

  const clientOptions = useMemo<SelectOption[]>(() => {
    return clients.map((client) => ({
      id: client.id,
      label: client.name,
      subtitle: [client.email || 'بدون بريد', client.phone || 'بدون جوال'].join(' · '),
    }));
  }, [clients]);

  const matterOptions = useMemo<SelectOption[]>(() => {
    return matters.map((matter) => ({
      id: matter.id,
      label: matter.title,
      subtitle: [matter.client?.name || 'بدون عميل', matter.case_type || 'قضية عامة'].join(' · '),
    }));
  }, [matters]);

  return { clientOptions, matterOptions, loading };
}

export function SelectionList({
  label,
  selectedId,
  query,
  onQueryChange,
  onSelect,
  options,
  placeholder,
}: {
  label: string;
  selectedId: string;
  query: string;
  onQueryChange: (value: string) => void;
  onSelect: (value: string) => void;
  options: SelectOption[];
  placeholder: string;
}) {
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return options;
    return options.filter((option) => `${option.label} ${option.subtitle || ''}`.toLowerCase().includes(needle));
  }, [options, query]);

  return (
    <View style={styles.selectionBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={query}
        onChangeText={onQueryChange}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        style={styles.search}
        textAlign="right"
      />
      <View style={styles.selectionList}>
        {filtered.slice(0, 8).map((option) => (
          <Pressable
            key={option.id}
            onPress={() => {
              onSelect(option.id);
              onQueryChange(option.label);
            }}
            style={styles.selectionItem}
          >
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>{option.label}</Text>
              {option.subtitle ? <Text style={styles.rowMeta}>{option.subtitle}</Text> : null}
            </View>
            <StatusChip
              label={selectedId === option.id ? 'مختار' : 'اختر'}
              tone={selectedId === option.id ? 'success' : 'default'}
            />
          </Pressable>
        ))}
        {!filtered.length ? <Text style={styles.rowMeta}>لا توجد نتائج.</Text> : null}
      </View>
    </View>
  );
}

export function FormHeader({
  eyebrow,
  title,
  subtitle,
  tone = 'default',
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  tone?: 'default' | 'success' | 'warning' | 'gold';
}) {
  return (
    <HeroCard
      eyebrow={eyebrow}
      title={title}
      subtitle={subtitle}
      aside={<StatusChip label={eyebrow} tone={tone} />}
    />
  );
}

export function FormFooter({
  saving,
  onSubmit,
  onCancel,
  submitLabel,
}: {
  saving: boolean;
  onSubmit: () => void;
  onCancel?: () => void;
  submitLabel: string;
}) {
  return (
    <View style={styles.formFooter}>
      <PrimaryButton title={submitLabel} onPress={onSubmit} disabled={saving} />
      {onCancel ? <PrimaryButton title="رجوع" onPress={onCancel} secondary /> : null}
    </View>
  );
}
