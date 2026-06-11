import { Ionicons } from '@expo/vector-icons'
import { StyleSheet, Text, View } from 'react-native'

import { colors, radius, spacing, typography } from '@/styles/theme'

/** On-brand empty/placeholder state used while a feature is being built. */
export function EmptyState({
  icon = 'sparkles-outline',
  title,
  hint,
}: {
  icon?: keyof typeof Ionicons.glyphMap
  title: string
  hint?: string
}) {
  return (
    <View style={styles.root}>
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={28} color={colors.accent} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  title: { color: colors.text, fontSize: typography.headline, fontWeight: '600' },
  hint: { color: colors.textFaint, fontSize: typography.label, textAlign: 'center', maxWidth: 260 },
})
