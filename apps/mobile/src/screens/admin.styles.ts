import { StyleSheet } from 'react-native';
import { colors, fonts, radius, spacing } from '../theme';

export const styles = StyleSheet.create({
  heroBadges: {
    gap: spacing.sm,
  },
  entries: {
    gap: spacing.md,
  },
  entryCard: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    backgroundColor: colors.surfaceMuted,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  entryText: {
    flex: 1,
    gap: spacing.xs,
  },
  entryTitle: {
    color: colors.primary,
    fontFamily: fonts.arabicBold,
    fontSize: 16,
    textAlign: 'right',
  },
  entrySubtitle: {
    color: colors.textMuted,
    fontFamily: fonts.arabicRegular,
    fontSize: 12,
    lineHeight: 20,
    textAlign: 'right',
  },
  statsGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  buttonRow: {
    flexDirection: 'row-reverse',
    gap: spacing.md,
    flexWrap: 'wrap',
  },
  buttonColumn: {
    gap: spacing.md,
  },
  rowBetween: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  gapXs: {
    gap: spacing.xs,
    flex: 1,
  },
  cardTitle: {
    color: colors.primary,
    fontFamily: fonts.arabicBold,
    fontSize: 16,
    textAlign: 'right',
  },
  cardMeta: {
    color: colors.textMuted,
    fontFamily: fonts.arabicRegular,
    fontSize: 12,
    lineHeight: 20,
    textAlign: 'right',
  },
  infoGrid: {
    gap: spacing.xs,
  },
  groupLabel: {
    color: colors.primary,
    fontFamily: fonts.arabicSemiBold,
    fontSize: 13,
    textAlign: 'right',
    marginBottom: spacing.sm,
  },
  message: {
    color: colors.textMuted,
    fontFamily: fonts.arabicMedium,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'right',
    marginTop: spacing.sm,
  },
  error: {
    color: colors.danger,
    fontFamily: fonts.arabicMedium,
    fontSize: 12,
    lineHeight: 20,
    textAlign: 'right',
    marginTop: spacing.sm,
  },
  accountBlock: {
    gap: spacing.xs,
  },
  accountLabel: {
    color: colors.textMuted,
    fontFamily: fonts.arabicRegular,
    fontSize: 12,
    textAlign: 'right',
  },
  accountValue: {
    color: colors.primary,
    fontFamily: fonts.arabicSemiBold,
    fontSize: 14,
    textAlign: 'right',
  },
  signOutWrap: {
    marginTop: spacing.md,
    alignItems: 'flex-end',
  },
  signOutButton: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.danger,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  signOutText: {
    color: colors.danger,
    fontFamily: fonts.arabicBold,
    fontSize: 13,
    textAlign: 'center',
  },
});
