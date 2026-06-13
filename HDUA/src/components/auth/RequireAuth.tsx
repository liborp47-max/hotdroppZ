import { ReactNode } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useAuth } from '@/stores/auth'
import { colors, glows, radius, spacing, typography } from '@/styles/theme'

/**
 * Gates a screen behind a signed-in session (HDUA-14 sub02). While auth is
 * resolving it shows a spinner; signed-out users get an on-brand prompt that
 * routes to the `/auth` modal. The public feed is never wrapped in this — only
 * user-owned surfaces (profile, settings, create).
 */
export function RequireAuth({
  children,
  title = 'Přihlaš se',
  hint = 'Pro tuhle část potřebuješ účet — ulož si dropy, sleduj umělce a měj feed na míru.',
  icon = 'lock-closed-outline',
}: {
  children: ReactNode
  title?: string
  hint?: string
  icon?: keyof typeof Ionicons.glyphMap
}) {
  const status = useAuth((s) => s.status)
  const router = useRouter()
  const insets = useSafeAreaInsets()

  if (status === 'authed') return <>{children}</>

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.xl }]}>
      {status === 'loading' ? (
        <ActivityIndicator color={colors.accent} />
      ) : (
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Ionicons name={icon} size={30} color={colors.accent} />
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.hint}>{hint}</Text>
          <Pressable style={styles.cta} onPress={() => router.push('/auth')}>
            <Text style={styles.ctaText}>Přihlásit se</Text>
            <Ionicons name="arrow-forward" size={16} color={colors.bg} />
          </Pressable>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  card: { alignItems: 'center', gap: spacing.sm, maxWidth: 320 },
  iconWrap: {
    width: 64, height: 64, borderRadius: radius.lg,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderActive,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm,
  },
  title: { color: colors.text, fontSize: typography.headline, fontWeight: '700' },
  hint: { color: colors.textFaint, fontSize: typography.label, textAlign: 'center', lineHeight: 20 },
  cta: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.md,
    backgroundColor: colors.accent, paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
    borderRadius: radius.md, ...glows.cta,
  },
  ctaText: { color: colors.bg, fontSize: typography.body, fontWeight: '800' },
})
