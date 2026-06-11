import { useEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Audio, type AVPlaybackStatus } from 'expo-av'
import { Ionicons } from '@expo/vector-icons'

import { colors, radius, spacing, typography } from '@/styles/theme'

/**
 * Minimal audio preview (HDUA-04 seed). Lazy-loads the sound on first play,
 * shows a progress bar, and cleans up on unmount. A fuller waveform player lands
 * with the global player (HDUA-08).
 */
export function AudioPreview({ uri, title }: { uri: string; title?: string }) {
  const sound = useRef<Audio.Sound | null>(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    return () => {
      sound.current?.unloadAsync().catch(() => {})
      sound.current = null
    }
  }, [])

  const onStatus = (status: AVPlaybackStatus) => {
    if (!status.isLoaded) return
    setPlaying(status.isPlaying)
    if (status.durationMillis) setProgress((status.positionMillis ?? 0) / status.durationMillis)
    if (status.didJustFinish) {
      setPlaying(false)
      setProgress(0)
      sound.current?.setPositionAsync(0).catch(() => {})
    }
  }

  const toggle = async () => {
    try {
      if (!sound.current) {
        setLoading(true)
        const { sound: s } = await Audio.Sound.createAsync({ uri }, { shouldPlay: true }, onStatus)
        sound.current = s
        setLoading(false)
        return
      }
      const status = await sound.current.getStatusAsync()
      if (status.isLoaded && status.isPlaying) await sound.current.pauseAsync()
      else await sound.current.playAsync()
    } catch {
      setLoading(false)
    }
  }

  return (
    <View style={styles.root}>
      <Pressable style={styles.btn} onPress={toggle} hitSlop={8}>
        <Ionicons name={loading ? 'hourglass-outline' : playing ? 'pause' : 'play'} size={20} color={colors.bg} />
      </Pressable>
      <View style={styles.meta}>
        <Text style={styles.label} numberOfLines={1}>{title ? `Preview · ${title}` : 'Preview'}</Text>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${Math.min(100, progress * 100)}%` }]} />
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.sm,
    borderWidth: 1, borderColor: colors.border,
  },
  btn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  meta: { flex: 1, gap: 6 },
  label: { color: colors.textMuted, fontSize: typography.caption, fontWeight: '600' },
  track: { height: 4, borderRadius: 2, backgroundColor: colors.bgElevated, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: colors.accent },
})
