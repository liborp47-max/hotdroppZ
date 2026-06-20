import { Image, Modal, Pressable, StyleSheet, Text, View, type LayoutChangeEvent, type GestureResponderEvent } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRef } from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { usePlayer } from '@/stores/player'
import { colors, glows, layout, radius, spacing, typography } from '@/styles/theme'

const fmt = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** Global player UI (HDUA-08 sub02): a mini bar above the tab bar + a full-screen
 *  modal. Mounted once at the root so it persists across navigation. */
export function Player() {
  const track = usePlayer((s) => s.track)
  const expanded = usePlayer((s) => s.expanded)
  if (!track) return null
  return (
    <>
      {!expanded ? <MiniPlayer /> : null}
      <FullPlayer />
    </>
  )
}

function MiniPlayer() {
  const insets = useSafeAreaInsets()
  const track = usePlayer((s) => s.track)
  const isPlaying = usePlayer((s) => s.isPlaying)
  const isLoading = usePlayer((s) => s.isLoading)
  const position = usePlayer((s) => s.position)
  const duration = usePlayer((s) => s.duration)
  const { toggle, next, close, setExpanded } = usePlayer.getState()
  if (!track) return null

  const pct = duration > 0 ? Math.min(100, (position / duration) * 100) : 0

  return (
    <View style={[styles.miniWrap, { bottom: layout.tabBarHeight + insets.bottom + spacing.xs }]}>
      <Pressable style={styles.mini} onPress={() => setExpanded(true)} accessibilityRole="button" accessibilityLabel="Otevřít přehrávač">
        {track.cover ? <Image source={{ uri: track.cover }} style={styles.miniCover} /> : <View style={[styles.miniCover, styles.coverFallback]}><Ionicons name="musical-notes" size={18} color={colors.accent} /></View>}
        <View style={styles.miniMeta}>
          <Text style={styles.miniTitle} numberOfLines={1}>{track.title}</Text>
          {track.artist ? <Text style={styles.miniArtist} numberOfLines={1}>{track.artist}</Text> : null}
        </View>
        <Pressable onPress={() => toggle()} hitSlop={8} style={styles.miniBtn} accessibilityLabel={isPlaying ? 'Pauza' : 'Přehrát'}>
          <Ionicons name={isLoading ? 'hourglass-outline' : isPlaying ? 'pause' : 'play'} size={20} color={colors.bg} />
        </Pressable>
        <Pressable onPress={() => next()} hitSlop={8} style={styles.miniSkip} accessibilityLabel="Další">
          <Ionicons name="play-skip-forward" size={18} color={colors.text} />
        </Pressable>
        <Pressable onPress={() => close()} hitSlop={8} style={styles.miniSkip} accessibilityLabel="Zavřít">
          <Ionicons name="close" size={18} color={colors.textMuted} />
        </Pressable>
      </Pressable>
      <View style={styles.miniTrack}><View style={[styles.miniFill, { width: `${pct}%` }]} /></View>
    </View>
  )
}

function FullPlayer() {
  const insets = useSafeAreaInsets()
  const track = usePlayer((s) => s.track)
  const expanded = usePlayer((s) => s.expanded)
  const isPlaying = usePlayer((s) => s.isPlaying)
  const isLoading = usePlayer((s) => s.isLoading)
  const position = usePlayer((s) => s.position)
  const duration = usePlayer((s) => s.duration)
  const { toggle, next, prev, seek, setExpanded } = usePlayer.getState()
  const barWidth = useRef(0)

  const pct = duration > 0 ? Math.min(100, (position / duration) * 100) : 0
  const onBarLayout = (e: LayoutChangeEvent) => { barWidth.current = e.nativeEvent.layout.width }
  const onBarPress = (e: GestureResponderEvent) => {
    if (!duration || !barWidth.current) return
    seek((e.nativeEvent.locationX / barWidth.current) * duration)
  }

  return (
    <Modal visible={expanded} animationType="slide" onRequestClose={() => setExpanded(false)} transparent={false}>
      <View style={[styles.full, { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.xl }]}>
        <Pressable style={styles.fullClose} onPress={() => setExpanded(false)} hitSlop={10}>
          <Ionicons name="chevron-down" size={28} color={colors.text} />
        </Pressable>

        <View style={styles.fullBody}>
          {track?.cover ? (
            <Image source={{ uri: track.cover }} style={styles.fullCover} />
          ) : (
            <View style={[styles.fullCover, styles.coverFallback]}><Ionicons name="musical-notes" size={64} color={colors.accent} /></View>
          )}
          <Text style={styles.fullTitle} numberOfLines={2}>{track?.title}</Text>
          {track?.artist ? <Text style={styles.fullArtist} numberOfLines={1}>{track.artist}</Text> : null}

          <Pressable style={styles.fullBar} onPress={onBarPress} onLayout={onBarLayout}>
            <View style={styles.fullTrack}><View style={[styles.fullFill, { width: `${pct}%` }]} /></View>
          </Pressable>
          <View style={styles.times}>
            <Text style={styles.time}>{fmt(position)}</Text>
            <Text style={styles.time}>{fmt(duration)}</Text>
          </View>

          <View style={styles.controls}>
            <Pressable onPress={() => prev()} hitSlop={10}><Ionicons name="play-skip-back" size={32} color={colors.text} /></Pressable>
            <Pressable onPress={() => toggle()} style={styles.playBig} hitSlop={10} accessibilityLabel={isPlaying ? 'Pauza' : 'Přehrát'}>
              <Ionicons name={isLoading ? 'hourglass-outline' : isPlaying ? 'pause' : 'play'} size={34} color={colors.bg} />
            </Pressable>
            <Pressable onPress={() => next()} hitSlop={10}><Ionicons name="play-skip-forward" size={32} color={colors.text} /></Pressable>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  miniWrap: { position: 'absolute', left: spacing.sm, right: spacing.sm },
  mini: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.bgElevated, borderWidth: 1, borderColor: colors.borderActive,
    borderTopLeftRadius: radius.md, borderTopRightRadius: radius.md, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm,
    ...glows.soft,
  },
  miniCover: { width: 40, height: 40, borderRadius: radius.sm, backgroundColor: colors.surface },
  coverFallback: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  miniMeta: { flex: 1, gap: 1 },
  miniTitle: { color: colors.text, fontSize: typography.label, fontWeight: '700' },
  miniArtist: { color: colors.textMuted, fontSize: typography.caption },
  miniBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  miniSkip: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  miniTrack: { height: 3, backgroundColor: colors.surface, marginHorizontal: spacing.sm },
  miniFill: { height: '100%', backgroundColor: colors.accent },

  full: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: spacing.xl },
  fullClose: { alignSelf: 'flex-start', padding: spacing.xs },
  fullBody: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  fullCover: { width: 260, height: 260, borderRadius: radius.lg, backgroundColor: colors.surface, marginBottom: spacing.lg },
  fullTitle: { color: colors.text, fontSize: typography.title, fontWeight: '800', textAlign: 'center' },
  fullArtist: { color: colors.textMuted, fontSize: typography.body },
  fullBar: { width: '100%', paddingVertical: spacing.sm, marginTop: spacing.lg },
  fullTrack: { height: 5, borderRadius: 3, backgroundColor: colors.surface, overflow: 'hidden' },
  fullFill: { height: '100%', backgroundColor: colors.accent },
  times: { width: '100%', flexDirection: 'row', justifyContent: 'space-between' },
  time: { color: colors.textFaint, fontSize: typography.caption },
  controls: { flexDirection: 'row', alignItems: 'center', gap: spacing.xl, marginTop: spacing.lg },
  playBig: { width: 68, height: 68, borderRadius: 34, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', ...glows.cta },
})
