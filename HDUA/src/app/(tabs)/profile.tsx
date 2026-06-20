import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { getProfile, getSettings } from '@/api/user'
import { RequireAuth } from '@/components/auth/RequireAuth'
import { Avatar } from '@/components/shared/Avatar'
import { useAuth } from '@/stores/auth'
import { useInteractions } from '@/stores/userInteractions'
import { colors, radius, spacing, typography } from '@/styles/theme'

/** Profile tab (HDUA-14) — gated behind auth; real profile, stats, settings, logout. */
export default function ProfileScreen() {
  return (
    <RequireAuth title="Tvůj profil" hint="Přihlas se a měj historii, uložené dropy a sledované umělce na jednom místě.">
      <ProfileContent />
    </RequireAuth>
  )
}

function ProfileContent() {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const user = useAuth((s) => s.user)
  const signOut = useAuth((s) => s.signOut)
  const likedCount = useInteractions((s) => s.liked.size)
  const savedCount = useInteractions((s) => s.saved.size)

  const { data: profile, isLoading: loadingProfile } = useQuery({ queryKey: ['profile'], queryFn: getProfile })
  const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: getSettings })

  const name = profile?.display_name || profile?.username || user?.email?.split('@')[0] || 'Profil'
  const followed =
    (settings?.followed_artists?.length ?? 0) +
    (settings?.followed_countries?.length ?? 0) +
    (settings?.followed_genres?.length ?? 0)

  return (
    <ScrollView style={styles.root} contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.lg }]}>
      <View style={styles.head}>
        <Avatar uri={profile?.avatar_url} name={name} size={60} />
        <View style={styles.headText}>
          {loadingProfile ? (
            <ActivityIndicator color={colors.accent} />
          ) : (
            <>
              <Text style={styles.name} numberOfLines={1}>{name}</Text>
              {user?.email ? <Text style={styles.email} numberOfLines={1}>{user.email}</Text> : null}
            </>
          )}
        </View>
        <Pressable
          style={styles.gear}
          onPress={() => router.push('/profile/settings')}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Nastavení"
        >
          <Ionicons name="settings-outline" size={22} color={colors.textMuted} />
        </Pressable>
      </View>

      {profile?.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}

      <Pressable style={styles.editBtn} onPress={() => router.push('/profile/edit')} accessibilityRole="button">
        <Ionicons name="create-outline" size={16} color={colors.accent} />
        <Text style={styles.editText}>Upravit profil</Text>
      </Pressable>

      <View style={styles.stats}>
        <Stat label="Líbí se" value={likedCount} icon="heart" onPress={() => router.push('/profile/collection?tab=liked')} />
        <Stat label="Uloženo" value={savedCount} icon="bookmark" onPress={() => router.push('/profile/collection?tab=saved')} />
        <Stat label="Sleduji" value={followed} icon="star" onPress={() => router.push('/profile/collection?tab=followed')} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Nastavení</Text>
        <Row icon="language-outline" label="Jazyk" value={(settings?.language ?? 'en').toUpperCase()} />
        <Row icon="notifications-outline" label="Push notifikace" value={settings?.push_enabled === false ? 'Vypnuto' : 'Zapnuto'} />
        <Row icon="sparkles-outline" label="Personalizace" value={settings?.personalization_opt_out ? 'Vypnuto' : 'Zapnuto'} />
        {profile?.country ? <Row icon="flag-outline" label="Země" value={profile.country.toUpperCase()} /> : null}
      </View>

      <Pressable style={styles.logout} onPress={() => signOut().catch(() => {})}>
        <Ionicons name="log-out-outline" size={18} color={colors.danger} />
        <Text style={styles.logoutText}>Odhlásit se</Text>
      </Pressable>
    </ScrollView>
  )
}

function Stat({
  label,
  value,
  icon,
  onPress,
}: {
  label: string
  value: number
  icon: keyof typeof Ionicons.glyphMap
  onPress: () => void
}) {
  return (
    <Pressable style={styles.stat} onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      <Ionicons name={icon} size={18} color={colors.accent} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Pressable>
  )
}

function Row({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={18} color={colors.textMuted} />
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg },

  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  headText: { flex: 1, gap: 2 },
  gear: {
    width: 40, height: 40, borderRadius: radius.md,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  name: { color: colors.text, fontSize: typography.title, fontWeight: '800' },
  email: { color: colors.textMuted, fontSize: typography.label },
  bio: { color: colors.textMuted, fontSize: typography.body, lineHeight: 20 },
  editBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderActive,
    borderRadius: radius.md, paddingVertical: spacing.sm,
  },
  editText: { color: colors.accent, fontSize: typography.label, fontWeight: '700' },

  stats: { flexDirection: 'row', gap: spacing.sm },
  stat: {
    flex: 1, alignItems: 'center', gap: 4, paddingVertical: spacing.md,
    backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
  },
  statValue: { color: colors.text, fontSize: typography.headline, fontWeight: '800' },
  statLabel: { color: colors.textFaint, fontSize: typography.caption },

  section: { gap: spacing.sm },
  sectionTitle: { color: colors.textMuted, fontSize: typography.label, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
  },
  rowLabel: { flex: 1, color: colors.text, fontSize: typography.body },
  rowValue: { color: colors.accent, fontSize: typography.label, fontWeight: '700' },

  logout: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    borderWidth: 1, borderColor: colors.danger, borderRadius: radius.md, paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
  logoutText: { color: colors.danger, fontSize: typography.body, fontWeight: '700' },
})
