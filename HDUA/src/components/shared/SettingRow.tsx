import type { ReactNode } from 'react'
import { Ionicons } from '@expo/vector-icons'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { colors, radius, spacing, typography } from '@/styles/theme'

/**
 * One row in a settings / profile list (HDUA-22). Leading accent icon, title +
 * optional subtitle, and a right slot: a custom control (`right`, e.g. a Switch),
 * a `value` string, or — when pressable with neither — a chevron. `danger` tints
 * it red for destructive rows (logout / delete account).
 */
export function SettingRow({
  icon,
  title,
  subtitle,
  value,
  right,
  onPress,
  danger = false,
  disabled = false,
}: {
  icon?: keyof typeof Ionicons.glyphMap
  title: string
  subtitle?: string
  value?: string
  right?: ReactNode
  onPress?: () => void
  danger?: boolean
  disabled?: boolean
}) {
  const fg = danger ? colors.danger : colors.text
  const tail =
    right ?? (value ? <Text style={styles.value}>{value}</Text> : null) ??
    (onPress ? <Ionicons name="chevron-forward" size={18} color={colors.textFaint} /> : null)

  const body = (
    <View style={[styles.row, disabled && styles.disabled]}>
      {icon ? (
        <View style={styles.iconWrap}>
          <Ionicons name={icon} size={18} color={danger ? colors.danger : colors.accent} />
        </View>
      ) : null}
      <View style={styles.texts}>
        <Text style={[styles.title, { color: fg }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {tail}
    </View>
  )

  if (onPress && !disabled) {
    return (
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={title}>
        {body}
      </Pressable>
    )
  }
  return body
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    minHeight: 52,
  },
  disabled: { opacity: 0.45 },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texts: { flex: 1, gap: 2 },
  title: { fontSize: typography.body, fontWeight: '600' },
  subtitle: { color: colors.textFaint, fontSize: typography.label },
  value: { color: colors.textMuted, fontSize: typography.label, fontWeight: '600' },
})
