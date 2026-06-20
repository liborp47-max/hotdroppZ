import { Ionicons } from '@expo/vector-icons'
import { Platform, StyleSheet, Text, TextInput, View } from 'react-native'
import type { TextInputProps } from 'react-native'

import { colors, radius, spacing, typography } from '@/styles/theme'

// Web-only: kill the default focus outline on inputs (RN types don't include it).
const webNoOutline = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null

export type FieldProps = TextInputProps & {
  /** Optional leading icon (Ionicons glyph). */
  icon?: keyof typeof Ionicons.glyphMap
  /** Optional label rendered above the input (Settings/Edit forms). */
  label?: string
}

/**
 * Venom text-input row with an optional leading icon and label. Extracted from
 * auth.tsx (HDUA-22) so Settings / Edit / Onboarding share one input primitive.
 * With no `label` it renders identically to the original auth field.
 */
export function Field({ icon, label, style, multiline, ...input }: FieldProps) {
  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={[styles.field, multiline && styles.fieldMultiline]}>
        {icon ? <Ionicons name={icon} size={18} color={colors.textFaint} /> : null}
        <TextInput
          {...input}
          multiline={multiline}
          style={[styles.input, webNoOutline, style]}
          placeholderTextColor={colors.textFaint}
          selectionColor={colors.accent}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  label: { color: colors.textMuted, fontSize: typography.label, fontWeight: '600', marginLeft: spacing.xs },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  // Multiline (bio etc.): top-align the icon and let the box grow.
  fieldMultiline: { alignItems: 'flex-start', paddingVertical: spacing.xs },
  input: { flex: 1, color: colors.text, fontSize: typography.body, paddingVertical: spacing.md },
})
