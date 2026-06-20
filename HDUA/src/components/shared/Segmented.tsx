import { Pressable, StyleSheet, Text, View } from 'react-native'

import { colors, radius, spacing, typography } from '@/styles/theme'

export type SegmentedOption<T extends string> = { value: T; label: string }

/**
 * Venom segmented control (active segment fills with accent). Extracted from
 * auth.tsx (HDUA-22). Generic over the option value so screens keep type-safe
 * `value`/`onChange` (auth mode switch, settings toggles, etc.).
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: SegmentedOption<T>[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <View style={styles.segment}>
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <Pressable
            key={opt.value}
            style={[styles.btn, active && styles.btnActive]}
            onPress={() => onChange(opt.value)}
          >
            <Text style={[styles.text, active && styles.textActive]}>{opt.label}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  segment: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 3,
    borderWidth: 1,
    borderColor: colors.border,
  },
  btn: { flex: 1, paddingVertical: spacing.sm, alignItems: 'center', borderRadius: radius.sm },
  btnActive: { backgroundColor: colors.accent },
  text: { color: colors.textMuted, fontSize: typography.label, fontWeight: '700' },
  textActive: { color: colors.bg },
})
