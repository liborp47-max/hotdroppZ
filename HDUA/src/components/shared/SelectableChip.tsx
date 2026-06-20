import { Ionicons } from '@expo/vector-icons'
import { Pressable, StyleSheet, Text } from 'react-native'

import { colors, radius, spacing, typography } from '@/styles/theme'

/**
 * Toggleable venom chip (HDUA-22) for multi-select taste pickers — followed
 * genres / countries / artists in Settings and Onboarding. Fills with accent
 * when selected.
 */
export function SelectableChip({
  label,
  selected,
  onPress,
  icon,
}: {
  label: string
  selected: boolean
  onPress: () => void
  icon?: keyof typeof Ionicons.glyphMap
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[styles.chip, selected && styles.chipActive]}
    >
      {icon ? (
        <Ionicons name={icon} size={14} color={selected ? colors.bg : colors.textMuted} />
      ) : null}
      <Text style={[styles.label, selected && styles.labelActive]}>{label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  label: { color: colors.textMuted, fontSize: typography.label, fontWeight: '600' },
  labelActive: { color: colors.bg, fontWeight: '800' },
})
