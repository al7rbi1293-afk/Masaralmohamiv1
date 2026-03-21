import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Card, SectionTitle, StatusChip } from '../../components/ui';
import { colors, fonts, radius, spacing } from '../../theme';
import { PartnerLeadStatus } from './types';

export function PartnerSection({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card>
      <SectionTitle title={title} subtitle={subtitle} action={action} />
      <View style={styles.sectionBody}>{children}</View>
    </Card>
  );
}

export function PartnerKeyValue({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <View style={styles.keyValue}>
      <Text style={styles.keyLabel}>{label}</Text>
      <Text style={[styles.keyValueText, mono && styles.keyValueMono]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

export function PartnerActionButton({
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

export function PartnerProgressRow({
  label,
  count,
  total,
  tone = 'default',
}: {
  label: string;
  count: number;
  total: number;
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'gold';
}) {
  const ratio = total > 0 ? Math.max(0.05, Math.min(1, count / total)) : 0.08;

  return (
    <View style={styles.progressRow}>
      <View style={styles.progressHeader}>
        <Text style={styles.progressLabel}>{label}</Text>
        <StatusChip label={String(count)} tone={tone} />
      </View>
      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            tone === 'success' && styles.progressFillSuccess,
            tone === 'warning' && styles.progressFillWarning,
            tone === 'danger' && styles.progressFillDanger,
            tone === 'gold' && styles.progressFillGold,
            { width: `${ratio * 100}%` },
          ]}
        />
      </View>
    </View>
  );
}

export function PartnerActivityItem({
  title,
  subtitle,
  timestamp,
  tone,
}: {
  title: string;
  subtitle: string;
  timestamp: string;
  tone: 'default' | 'success' | 'warning' | 'danger' | 'gold';
}) {
  const toneLabel = {
    default: 'عادي',
    success: 'مؤكد',
    warning: 'قيد المتابعة',
    danger: 'تنبيه',
    gold: 'مستحق',
  }[tone];

  return (
    <View style={styles.activityItem}>
      <View style={styles.activityText}>
        <Text style={styles.activityTitle}>{title}</Text>
        <Text style={styles.activitySubtitle}>{subtitle}</Text>
      </View>
      <View style={styles.activityMeta}>
        <StatusChip label={toneLabel} tone={tone} />
        <Text style={styles.activityTimestamp}>{timestamp}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionBody: {
    gap: spacing.md,
  },
  keyValue: {
    gap: 4,
  },
  keyLabel: {
    color: colors.textMuted,
    fontFamily: fonts.arabicMedium,
    fontSize: 11,
    textAlign: 'right',
  },
  keyValueText: {
    color: colors.text,
    fontFamily: fonts.arabicBold,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'right',
  },
  keyValueMono: {
    fontFamily: fonts.latinBold,
    writingDirection: 'ltr',
  },
  actionButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 13,
    alignItems: 'center',
  },
  actionButtonSecondary: {
    backgroundColor: colors.surfaceMuted,
  },
  actionText: {
    color: '#fff7e2',
    fontFamily: fonts.arabicBold,
    fontSize: 13,
  },
  actionTextSecondary: {
    color: colors.primary,
  },
  progressRow: {
    gap: spacing.sm,
  },
  progressHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  progressLabel: {
    color: colors.text,
    fontFamily: fonts.arabicBold,
    fontSize: 13,
    textAlign: 'right',
  },
  progressTrack: {
    height: 10,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.textMuted,
  },
  progressFillSuccess: {
    backgroundColor: colors.success,
  },
  progressFillWarning: {
    backgroundColor: colors.warning,
  },
  progressFillDanger: {
    backgroundColor: colors.danger,
  },
  progressFillGold: {
    backgroundColor: colors.gold,
  },
  activityItem: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  activityText: {
    flex: 1,
    gap: 4,
  },
  activityTitle: {
    color: colors.text,
    fontFamily: fonts.arabicBold,
    fontSize: 14,
    textAlign: 'right',
  },
  activitySubtitle: {
    color: colors.textMuted,
    fontFamily: fonts.arabicRegular,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'right',
  },
  activityMeta: {
    alignItems: 'flex-end',
    gap: 6,
  },
  activityTimestamp: {
    color: colors.textMuted,
    fontFamily: fonts.arabicRegular,
    fontSize: 11,
    textAlign: 'right',
  },
});
