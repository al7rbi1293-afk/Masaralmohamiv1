import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusChip } from '../components/ui';
import { useAuth } from '../context/auth-context';
import {
  fetchClientPortalOverview,
  submitClientPortalCommunication,
} from '../features/client/api';
import type {
  ClientPortalNotificationItem,
  ClientPortalOverview,
} from '../features/client/types';
import { colors, fonts, radius, spacing } from '../theme';

export function statusTone(status: string) {
  if (status === 'paid' || status === 'closed' || status === 'accepted') return 'success' as const;
  if (status === 'unpaid' || status === 'partial' || status === 'in_progress' || status === 'sent') return 'warning' as const;
  if (status === 'rejected' || status === 'void') return 'danger' as const;
  return 'default' as const;
}

export function notificationTone(kind: ClientPortalNotificationItem['kind']) {
  if (kind === 'invoice') return 'warning' as const;
  if (kind === 'document') return 'success' as const;
  if (kind === 'request') return 'gold' as const;
  return 'default' as const;
}

export function requestSourceLabel(source: string) {
  switch (source) {
    case 'contact':
      return 'تواصل';
    case 'support':
      return 'دعم';
    default:
      return source || 'طلب';
  }
}

export function useClientOverviewData() {
  const { session } = useAuth();
  const [data, setData] = useState<ClientPortalOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshIndex, setRefreshIndex] = useState(0);

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!session?.token) return;

      setLoading(true);
      setError('');
      try {
        const payload = await fetchClientPortalOverview(session.token);
        if (mounted) {
          setData(payload);
        }
      } catch (nextError) {
        if (mounted) {
          setError(nextError instanceof Error ? nextError.message : 'تعذر تحميل بوابة العميل.');
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
  }, [refreshIndex, session?.token]);

  return {
    data,
    loading,
    error,
    refresh: () => setRefreshIndex((value) => value + 1),
    token: session?.token || null,
  };
}

export function SummaryRow({
  title,
  subtitle,
  status,
  tone = 'default',
  action,
}: {
  title: string;
  subtitle: string;
  status?: string;
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'gold';
  action?: React.ReactNode;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.meta}>{subtitle}</Text>
      </View>
      <View style={styles.rowActions}>
        {status ? <StatusChip label={status} tone={tone} /> : null}
        {action}
      </View>
    </View>
  );
}

export function QuickButton({
  title,
  onPress,
  secondary = false,
}: {
  title: string;
  onPress: () => void;
  secondary?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.actionButton, secondary && styles.actionButtonSecondary]}>
      <Text style={[styles.actionText, secondary && styles.actionTextSecondary]}>{title}</Text>
    </Pressable>
  );
}

export { submitClientPortalCommunication };

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.xl,
  },
  stats: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  row: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  rowText: {
    flex: 1,
    gap: 4,
  },
  rowActions: {
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  title: {
    color: colors.text,
    fontFamily: fonts.arabicBold,
    fontSize: 15,
    lineHeight: 24,
    textAlign: 'right',
  },
  body: {
    color: colors.text,
    fontFamily: fonts.arabicRegular,
    fontSize: 13,
    lineHeight: 24,
    textAlign: 'right',
  },
  meta: {
    color: colors.textMuted,
    fontFamily: fonts.arabicRegular,
    fontSize: 12,
    lineHeight: 20,
    textAlign: 'right',
  },
  list: {
    paddingBottom: 120,
    gap: spacing.md,
  },
  listItem: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  logout: {
    marginTop: spacing.md,
    backgroundColor: colors.dangerSoft,
    paddingVertical: 14,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  logoutText: {
    color: colors.danger,
    fontFamily: fonts.arabicBold,
    fontSize: 15,
  },
  actionRow: {
    flexDirection: 'row-reverse',
    gap: spacing.md,
  },
  actionButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  actionButtonSecondary: {
    backgroundColor: colors.surfaceMuted,
  },
  actionText: {
    color: '#fff7e2',
    fontFamily: fonts.arabicBold,
    fontSize: 14,
  },
  actionTextSecondary: {
    color: colors.primary,
  },
  linkButton: {
    color: colors.primarySoft,
    fontFamily: fonts.arabicBold,
    fontSize: 13,
  },
  linkGroup: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  search: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 15,
    color: colors.text,
    fontFamily: fonts.arabicMedium,
    fontSize: 15,
  },
  multilineInput: {
    minHeight: 104,
    textAlignVertical: 'top',
  },
  error: {
    color: colors.danger,
    fontFamily: fonts.arabicMedium,
    fontSize: 13,
    lineHeight: 22,
    textAlign: 'right',
  },
  compose: {
    gap: spacing.md,
  },
  fieldLabel: {
    color: colors.text,
    fontFamily: fonts.arabicSemiBold,
    fontSize: 13,
    textAlign: 'right',
  },
  formBlock: {
    gap: spacing.md,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  formTitle: {
    color: colors.primary,
    fontFamily: fonts.arabicBold,
    fontSize: 15,
    textAlign: 'right',
  },
  chipsWrap: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  choiceChip: {
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  choiceChipSelected: {
    backgroundColor: colors.primary,
  },
  choiceChipText: {
    color: colors.primary,
    fontFamily: fonts.arabicMedium,
    fontSize: 12,
  },
  choiceChipTextSelected: {
    color: '#fff7e2',
  },
});
