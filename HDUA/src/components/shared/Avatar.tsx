import { Ionicons } from '@expo/vector-icons'
import { Image, Pressable, StyleSheet, Text, View } from 'react-native'

import { colors, glows, radius } from '@/styles/theme'

function initials(name?: string | null): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/**
 * Profile avatar (HDUA-22). Shows the uploaded image, or venom initials when
 * none. With `editable` it gets a camera badge and becomes pressable (Edit /
 * Onboarding). Square-ish venom frame, circular crop.
 */
export function Avatar({
  uri,
  name,
  size = 64,
  editable = false,
  onPress,
}: {
  uri?: string | null
  name?: string | null
  size?: number
  editable?: boolean
  onPress?: () => void
}) {
  const dim = { width: size, height: size, borderRadius: size / 2 }
  const badge = Math.max(20, Math.round(size * 0.3))

  const inner = (
    <View style={{ width: size, height: size }}>
      <View style={[styles.frame, dim]}>
        {uri ? (
          <Image source={{ uri }} style={dim} resizeMode="cover" />
        ) : (
          <Text style={[styles.initials, { fontSize: Math.round(size * 0.36) }]}>{initials(name)}</Text>
        )}
      </View>
      {editable ? (
        <View style={[styles.badge, { width: badge, height: badge, borderRadius: badge / 2 }]}>
          <Ionicons name="camera" size={Math.round(badge * 0.56)} color={colors.bg} />
        </View>
      ) : null}
    </View>
  )

  if (onPress) {
    return (
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel="Změnit profilový obrázek">
        {inner}
      </Pressable>
    )
  }
  return inner
}

const styles = StyleSheet.create({
  frame: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  initials: { color: colors.accent, fontWeight: '800', letterSpacing: 0.5 },
  badge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: colors.bg,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    ...glows.soft,
  },
})
