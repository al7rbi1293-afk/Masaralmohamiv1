import { StyleSheet } from 'react-native';
import { colors, fonts, radius, spacing } from '../theme';

export const styles = StyleSheet.create({
  hubGrid: {
    gap: spacing.sm,
  },
  hubCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs,
    backgroundColor: colors.surfaceMuted,
  },
  hubTitle: {
    fontFamily: fonts.arabicBold,
    fontSize: 18,
    color: colors.primary,
    textAlign: 'right',
  },
  hubSubtitle: {
    fontFamily: fonts.arabicRegular,
    fontSize: 13,
    lineHeight: 22,
    color: colors.textMuted,
    textAlign: 'right',
  },
  rowBetween: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  gapXs: {
    gap: spacing.xs,
  },
  statsRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  message: {
    fontFamily: fonts.arabicMedium,
    color: colors.primary,
    textAlign: 'right',
  },
  error: {
    fontFamily: fonts.arabicMedium,
    color: colors.danger,
    textAlign: 'right',
  },
  fieldLabel: {
    fontFamily: fonts.arabicSemiBold,
    fontSize: 13,
    color: colors.text,
    textAlign: 'right',
  },
  logoBlock: {
    gap: spacing.sm,
    alignItems: 'flex-end',
  },
  logoPreview: {
    width: 84,
    height: 84,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
  },
  cardTitle: {
    fontFamily: fonts.arabicBold,
    fontSize: 16,
    color: colors.text,
    textAlign: 'right',
  },
  cardMeta: {
    fontFamily: fonts.arabicRegular,
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'right',
  },
  bodyText: {
    fontFamily: fonts.arabicRegular,
    fontSize: 14,
    lineHeight: 24,
    color: colors.text,
    textAlign: 'right',
  },
  memberCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    padding: spacing.md,
    gap: spacing.sm,
  },
  memberCardActive: {
    borderColor: colors.gold,
    backgroundColor: '#fff8ec',
  },
  roleSelectorRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  roleSelector: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surface,
  },
  roleSelectorActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  roleSelectorText: {
    fontFamily: fonts.arabicMedium,
    color: colors.text,
  },
  roleSelectorTextActive: {
    color: '#fff',
  },
  permissionsRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  permissionChip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surface,
  },
  permissionChipActive: {
    backgroundColor: colors.goldSoft,
    borderColor: colors.gold,
  },
  permissionChipText: {
    fontFamily: fonts.arabicMedium,
    color: colors.text,
  },
  permissionChipTextActive: {
    color: colors.primary,
  },
  planList: {
    gap: spacing.sm,
  },
  planCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs,
    backgroundColor: colors.surfaceMuted,
  },
  planCardActive: {
    borderColor: colors.primary,
    backgroundColor: '#f0f7f5',
  },
  buttonRow: {
    flexDirection: 'row-reverse',
    gap: spacing.sm,
  },
});
