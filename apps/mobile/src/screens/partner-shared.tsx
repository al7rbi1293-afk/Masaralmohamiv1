import { StyleSheet, Text, View } from 'react-native';
import { StatusChip } from '../components/ui';
import type { PartnerCommissionStatus, PartnerLeadStatus, PartnerPayoutStatus } from '../features/partner/types';
import { colors, fonts, radius, spacing } from '../theme';

export function leadTone(status: PartnerLeadStatus) {
  if (status === 'subscribed') return 'gold' as const;
  if (status === 'trial_started') return 'warning' as const;
  if (status === 'signed_up') return 'success' as const;
  if (status === 'cancelled') return 'danger' as const;
  return 'default' as const;
}

export function commissionTone(status: PartnerCommissionStatus) {
  if (status === 'paid') return 'success' as const;
  if (status === 'approved' || status === 'payable') return 'warning' as const;
  if (status === 'reversed') return 'danger' as const;
  return 'gold' as const;
}

export function payoutTone(status: PartnerPayoutStatus) {
  if (status === 'paid') return 'success' as const;
  if (status === 'processing') return 'warning' as const;
  if (status === 'pending') return 'gold' as const;
  if (status === 'failed' || status === 'cancelled') return 'danger' as const;
  return 'default' as const;
}

export function commissionLabel(status: PartnerCommissionStatus) {
  switch (status) {
    case 'pending':
      return 'قيد المراجعة';
    case 'approved':
      return 'معتمدة';
    case 'payable':
      return 'مستحقة';
    case 'paid':
      return 'مدفوعة';
    case 'reversed':
      return 'مسترجعة';
    default:
      return status;
  }
}

export function payoutLabel(status: PartnerPayoutStatus) {
  switch (status) {
    case 'pending':
      return 'بانتظار الصرف';
    case 'processing':
      return 'جاري الصرف';
    case 'paid':
      return 'تم الصرف';
    case 'failed':
      return 'فشل';
    case 'cancelled':
      return 'ملغاة';
    default:
      return status;
  }
}

export function LedgerRow({
  title,
  subtitle,
  tone,
  status,
}: {
  title: string;
  subtitle: string;
  tone: 'default' | 'success' | 'warning' | 'danger' | 'gold';
  status: string;
}) {
  return (
    <View style={styles.ledgerRow}>
      <View style={styles.ledgerText}>
        <Text style={styles.ledgerTitle}>{title}</Text>
        <Text style={styles.ledgerSubtitle}>{subtitle}</Text>
      </View>
      <StatusChip label={status} tone={tone} />
    </View>
  );
}

export function SummaryPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'default' | 'success' | 'warning' | 'danger' | 'gold';
}) {
  return (
    <View style={styles.summaryPill}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <StatusChip label={value} tone={tone} />
    </View>
  );
}

export const styles = StyleSheet.create({
  heroBadges: {
    gap: spacing.sm,
  },
  stats: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  actionRow: {
    flexDirection: 'row-reverse',
    gap: spacing.md,
  },
  sectionAction: {
    color: colors.primary,
    fontFamily: fonts.arabicBold,
    fontSize: 12,
  },
  ledgerRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  ledgerText: {
    flex: 1,
    gap: 4,
  },
  ledgerTitle: {
    color: colors.text,
    fontFamily: fonts.arabicBold,
    fontSize: 15,
    textAlign: 'right',
  },
  ledgerSubtitle: {
    color: colors.textMuted,
    fontFamily: fonts.arabicRegular,
    fontSize: 12,
    lineHeight: 19,
    textAlign: 'right',
  },
  summaryStrip: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  summaryPill: {
    minWidth: 120,
    flex: 1,
    gap: 6,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
  },
  summaryLabel: {
    color: colors.textMuted,
    fontFamily: fonts.arabicMedium,
    fontSize: 12,
    textAlign: 'right',
  },
  signOutButton: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  signOutText: {
    color: colors.danger,
    fontFamily: fonts.arabicBold,
    fontSize: 14,
  },
});
