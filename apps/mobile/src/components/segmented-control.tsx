import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius, spacing } from '../theme';

export type SegmentedOption = {
  key: string;
  label: string;
  disabled?: boolean;
  count?: string | number;
};

export function SegmentedControl({
  options,
  value,
  onChange,
}: {
  options: SegmentedOption[];
  value: string;
  onChange: (key: string) => void;
}) {
  return (
    <View style={styles.track} accessibilityRole="tablist">
      {options.map((option) => {
        const selected = option.key === value;
        return (
          <Pressable
            key={option.key}
            accessibilityRole="tab"
            accessibilityState={{ selected, disabled: option.disabled }}
            disabled={option.disabled}
            onPress={() => onChange(option.key)}
            style={({ pressed }) => [
              styles.segment,
              selected && styles.segmentSelected,
              option.disabled && styles.segmentDisabled,
              pressed && !selected && styles.segmentPressed,
            ]}
          >
            <View style={styles.segmentContent}>
              <Text style={[styles.segmentLabel, selected && styles.segmentLabelSelected]}>{option.label}</Text>
              {option.count !== undefined ? (
                <View style={[styles.segmentBadge, selected && styles.segmentBadgeSelected]}>
                  <Text style={[styles.segmentBadgeText, selected && styles.segmentBadgeTextSelected]}>
                    {option.count}
                  </Text>
                </View>
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: spacing.xs,
    padding: 4,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.controlBorder,
  },
  segment: {
    flexGrow: 1,
    minWidth: 96,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: 'transparent',
  },
  segmentSelected: {
    backgroundColor: colors.surfaceRaised,
    shadowColor: colors.shadow,
    shadowOpacity: 0.14,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 2,
  },
  segmentPressed: {
    backgroundColor: '#f8f3e7',
  },
  segmentDisabled: {
    opacity: 0.45,
  },
  segmentContent: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  segmentLabel: {
    color: colors.textMuted,
    fontFamily: fonts.arabicSemiBold,
    fontSize: 13,
    textAlign: 'right',
  },
  segmentLabelSelected: {
    color: colors.primary,
  },
  segmentBadge: {
    minWidth: 24,
    borderRadius: radius.pill,
    backgroundColor: colors.control,
    paddingHorizontal: 8,
    paddingVertical: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentBadgeSelected: {
    backgroundColor: colors.primary,
  },
  segmentBadgeText: {
    color: colors.textMuted,
    fontFamily: fonts.arabicSemiBold,
    fontSize: 11,
  },
  segmentBadgeTextSelected: {
    color: '#fff8e6',
  },
});
