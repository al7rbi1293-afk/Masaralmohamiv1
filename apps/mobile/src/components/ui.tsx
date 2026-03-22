import { LinearGradient } from 'expo-linear-gradient';
import { ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts, radius, spacing } from '../theme';

export { SegmentedControl } from './segmented-control';

export function Page({
  children,
  scroll = true,
}: {
  children: ReactNode;
  scroll?: boolean;
}) {
  const content = scroll ? (
    <ScrollView
      contentContainerStyle={[styles.pageContent, styles.pageContentScrollable]}
      style={styles.page}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
      removeClippedSubviews
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.page, styles.pageContent]}>{children}</View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoider}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
      >
        {content}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function HeroCard({
  eyebrow,
  title,
  subtitle,
  aside,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  aside?: ReactNode;
}) {
  return (
    <LinearGradient
      colors={[colors.primarySoft, colors.primary]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.hero}
    >
      <View style={styles.heroText}>
        <Text style={styles.heroEyebrow}>{eyebrow}</Text>
        <Text style={styles.heroTitle}>{title}</Text>
        <Text style={styles.heroSubtitle}>{subtitle}</Text>
      </View>
      {aside ? <View style={styles.heroAside}>{aside}</View> : null}
    </LinearGradient>
  );
}

export function Card({
  children,
  muted = false,
}: {
  children: ReactNode;
  muted?: boolean;
}) {
  return <View style={[styles.card, muted && styles.cardMuted]}>{children}</View>;
}

export function SectionTitle({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionText}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
      </View>
      {action}
    </View>
  );
}

export function StatCard({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: 'default' | 'gold' | 'success' | 'warning' | 'danger';
}) {
  return (
    <View
      style={[
        styles.statCard,
        tone === 'gold' && styles.statCardGold,
        tone === 'success' && styles.statCardSuccess,
        tone === 'warning' && styles.statCardWarning,
        tone === 'danger' && styles.statCardDanger,
      ]}
    >
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

export function StatusChip({
  label,
  tone = 'default',
}: {
  label: string;
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'gold';
}) {
  return (
    <View
      style={[
        styles.chip,
        tone === 'success' && styles.chipSuccess,
        tone === 'warning' && styles.chipWarning,
        tone === 'danger' && styles.chipDanger,
        tone === 'gold' && styles.chipGold,
      ]}
    >
      <Text
        style={[
          styles.chipText,
          tone === 'success' && styles.chipTextSuccess,
          tone === 'warning' && styles.chipTextWarning,
          tone === 'danger' && styles.chipTextDanger,
          tone === 'gold' && styles.chipTextGold,
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType,
  editable = true,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'numeric';
  editable?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        editable={editable}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        style={styles.input}
        autoCapitalize="none"
        textAlign="right"
      />
    </View>
  );
}

export function PrimaryButton({
  title,
  onPress,
  disabled,
  secondary = false,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        secondary && styles.buttonSecondary,
        (disabled || pressed) && styles.buttonDisabled,
      ]}
    >
      <Text style={[styles.buttonText, secondary && styles.buttonTextSecondary]}>{title}</Text>
    </Pressable>
  );
}

export function EmptyState({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <Card muted>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyMessage}>{message}</Text>
    </Card>
  );
}

export function LoadingBlock() {
  return (
    <View style={styles.loadingBlock}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardAvoider: {
    flex: 1,
  },
  page: {
    flex: 1,
    backgroundColor: colors.background,
  },
  pageContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  pageContentScrollable: {
    flexGrow: 1,
  },
  hero: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  heroText: {
    gap: spacing.sm,
  },
  heroEyebrow: {
    color: '#cfe7df',
    fontFamily: fonts.arabicSemiBold,
    fontSize: 13,
    textAlign: 'right',
  },
  heroTitle: {
    color: '#fff7e2',
    fontFamily: fonts.arabicBold,
    fontSize: 26,
    lineHeight: 36,
    textAlign: 'right',
  },
  heroSubtitle: {
    color: '#e3f1ec',
    fontFamily: fonts.arabicRegular,
    fontSize: 14,
    lineHeight: 24,
    textAlign: 'right',
  },
  heroAside: {
    alignSelf: 'flex-start',
  },
  card: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.lg,
    padding: 16,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.shadow,
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 16,
    elevation: 2,
  },
  cardMuted: {
    backgroundColor: colors.surfaceMuted,
  },
  sectionHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  sectionText: {
    flex: 1,
    gap: 4,
  },
  sectionTitle: {
    color: colors.primary,
    fontFamily: fonts.arabicBold,
    fontSize: 17,
    textAlign: 'right',
  },
  sectionSubtitle: {
    color: colors.textMuted,
    fontFamily: fonts.arabicRegular,
    fontSize: 13,
    textAlign: 'right',
  },
  statCard: {
    flex: 1,
    minWidth: 132,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    padding: 14,
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statCardGold: {
    backgroundColor: colors.goldSoft,
    borderColor: '#f0ddb0',
  },
  statCardSuccess: {
    backgroundColor: colors.successSoft,
    borderColor: '#cbe2d5',
  },
  statCardWarning: {
    backgroundColor: colors.warningSoft,
    borderColor: '#eddcaa',
  },
  statCardDanger: {
    backgroundColor: colors.dangerSoft,
    borderColor: '#ebc9c9',
  },
  statLabel: {
    color: colors.textMuted,
    fontFamily: fonts.arabicMedium,
    fontSize: 12,
    textAlign: 'right',
  },
  statValue: {
    color: colors.primary,
    fontFamily: fonts.latinExtraBold,
    fontSize: 22,
    textAlign: 'right',
  },
  chip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceTint,
  },
  chipSuccess: {
    backgroundColor: colors.successSoft,
  },
  chipWarning: {
    backgroundColor: colors.warningSoft,
  },
  chipDanger: {
    backgroundColor: colors.dangerSoft,
  },
  chipGold: {
    backgroundColor: colors.goldSoft,
  },
  chipText: {
    color: colors.primary,
    fontFamily: fonts.arabicSemiBold,
    fontSize: 12,
    textAlign: 'right',
  },
  chipTextSuccess: {
    color: colors.success,
  },
  chipTextWarning: {
    color: colors.warning,
  },
  chipTextDanger: {
    color: colors.danger,
  },
  chipTextGold: {
    color: colors.warning,
  },
  field: {
    gap: spacing.sm,
  },
  fieldLabel: {
    color: colors.text,
    fontFamily: fonts.arabicSemiBold,
    fontSize: 12,
    textAlign: 'right',
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 13,
    color: colors.text,
    fontFamily: fonts.arabicMedium,
    fontSize: 15,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 13,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonSecondary: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  buttonText: {
    color: '#fff8e6',
    fontFamily: fonts.arabicBold,
    fontSize: 15,
  },
  buttonTextSecondary: {
    color: colors.primary,
  },
  emptyTitle: {
    color: colors.primary,
    fontFamily: fonts.arabicBold,
    fontSize: 15,
    textAlign: 'right',
  },
  emptyMessage: {
    color: colors.textMuted,
    fontFamily: fonts.arabicRegular,
    fontSize: 14,
    lineHeight: 24,
    textAlign: 'right',
  },
  loadingBlock: {
    paddingVertical: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
