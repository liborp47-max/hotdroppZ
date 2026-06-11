import { useState } from 'react'
import { Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { FeedList } from '@/feed/FeedList'
import type { FeedKind } from '@/hooks/useFeed'
import { colors, glows, radius, spacing, typography } from '@/styles/theme'

const LOGO = require('@/assets/brand/logo-dark.png')

const KINDS: { key: FeedKind; label: string }[] = [
  { key: 'latest', label: 'Latest' },
  { key: 'trending', label: 'Trending' },
  { key: 'recommended', label: 'For You' },
]

/**
 * Home / Feed tab — full-screen swipe feed (HDUA-06). The pager fills the screen.
 * A thin fixed BLACK top bar carries the centered HotDroppZ logo (with a subtle
 * hairline at its bottom edge); the venom segmented control floats just below.
 */
export default function HomeScreen() {
  const insets = useSafeAreaInsets()
  const [kind, setKind] = useState<FeedKind>('latest')

  return (
    <View style={styles.root}>
      {/* key=kind remounts the pager so each tab gets a fresh feed at the top */}
      <FeedList key={kind} kind={kind} />

      {/* Fixed top bar + floating segment */}
      <View style={styles.header} pointerEvents="box-none">
        <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
          <View style={styles.brandRow}>
            <View style={styles.side} />
            <Image source={LOGO} style={styles.logo} resizeMode="contain" />
            <View style={styles.sideRight}>
              <View style={styles.live}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>LIVE</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.segmentWrap} pointerEvents="box-none">
          <View style={styles.segment}>
            {KINDS.map((k) => {
              const active = k.key === kind
              return (
                <Pressable
                  key={k.key}
                  onPress={() => setKind(k.key)}
                  style={[styles.segItem, active && styles.segItemActive]}
                >
                  <Text style={[styles.segText, active && styles.segTextActive]}>{k.label}</Text>
                </Pressable>
              )
            })}
          </View>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { position: 'absolute', top: 0, left: 0, right: 0 },

  // Thin fixed black bar across the top.
  topBar: {
    backgroundColor: '#000000',
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg },
  side: { flex: 1 },
  sideRight: { flex: 1, alignItems: 'flex-end' },
  logo: { width: 124, height: 40 },
  live: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,59,59,0.45)',
    paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.sm,
    backgroundColor: 'rgba(255,59,59,0.08)',
  },
  liveDot: { width: 7, height: 7, borderRadius: radius.pill, backgroundColor: colors.live },
  liveText: { color: colors.live, fontSize: typography.caption, fontWeight: '800', letterSpacing: 1 },

  // Sharp, glassy venom segmented control, floating under the bar.
  segmentWrap: { alignItems: 'center', marginTop: spacing.md },
  segment: {
    flexDirection: 'row',
    backgroundColor: colors.glass, borderRadius: radius.md, padding: 3,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  segItem: { paddingHorizontal: spacing.lg, alignItems: 'center', paddingVertical: 7, borderRadius: radius.sm },
  segItemActive: { backgroundColor: colors.accent, ...glows.soft },
  segText: { color: colors.textMuted, fontSize: typography.label, fontWeight: '600', letterSpacing: 0.3 },
  segTextActive: { color: colors.bg, fontWeight: '700' },
})
