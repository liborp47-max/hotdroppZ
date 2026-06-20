import { Ionicons } from '@expo/vector-icons'
import { StyleSheet, Text, View } from 'react-native'

import { colors, radius, spacing, typography } from '@/styles/theme'

export type NoticeTone = 'success' | 'error' | 'info'

const TONES: Record<NoticeTone, { fg: string; bg: string; border: string; icon: keyof typeof Ionicons.glyphMap }> = {
  success: { fg: colors.accent, bg: 'rgba(0,236,136,0.10)', border: 'rgba(0,236,136,0.35)', icon: 'checkmark-circle' },
  error: { fg: colors.danger, bg: 'rgba(255,90,90,0.10)', border: 'rgba(255,90,90,0.35)', icon: 'alert-circle' },
  info: { fg: colors.textMuted, bg: colors.surface, border: colors.border, icon: 'information-circle' },
}

/**
 * Inline result banner (HDUA-22) — the reusable form of the ad-hoc error/notice
 * lines in auth.tsx. Used for "Profil uložen", validation errors, e-mail-confirm
 * notices across Settings / Edit / Auth.
 */
export function ConfirmationNotice({
  tone = 'info',
  message,
  icon,
}: {
  tone?: NoticeTone
  message: string
  icon?: keyof typeof Ionicons.glyphMap
}) {
  const t = TONES[tone]
  return (
    <View style={[styles.notice, { backgroundColor: t.bg, borderColor: t.border }]} accessibilityRole="alert">
      <Ionicons name={icon ?? t.icon} size={16} color={t.fg} />
      <Text style={[styles.text, { color: t.fg }]}>{message}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  text: { flex: 1, fontSize: typography.label, fontWeight: '600', lineHeight: 18 },
})
