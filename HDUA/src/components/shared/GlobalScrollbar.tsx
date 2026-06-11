import { useState } from 'react'
import { LayoutChangeEvent, StyleSheet, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { runOnJS, useAnimatedStyle } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { driveScroll, sbProgress, sbThumbFraction } from '@/stores/scrollbarShared'
import { colors } from '@/styles/theme'

/**
 * App-wide scrollbar — a persistent venom rail on the right edge, rendered once
 * in the root layout so it sits above EVERY screen (feed, open post, all tabs).
 *
 * Draggable: a wide invisible hit area on the right edge catches taps/drags and
 * scrolls the active surface (the feed) via `driveScroll`. The visible bar is
 * thin; the hit area is wide so it's easy to grab. Only this right-edge strip is
 * interactive — the track/thumb themselves are pointerEvents="none".
 */
const HIT_W = 22 // generous touch target
const BAR_W = 8 // visible bar

export function GlobalScrollbar() {
  const insets = useSafeAreaInsets()
  const [trackH, setTrackH] = useState(0)

  const onLayout = (e: LayoutChangeEvent) => setTrackH(e.nativeEvent.layout.height)

  const thumbStyle = useAnimatedStyle(() => {
    const fr = Math.min(Math.max(sbThumbFraction.value, 0.08), 1)
    const thumbH = Math.max(44, trackH * fr)
    return { height: thumbH, transform: [{ translateY: sbProgress.value * Math.max(0, trackH - thumbH) }] }
  })

  const pan = Gesture.Pan()
    .minDistance(0)
    .onBegin((e) => {
      if (trackH <= 0) return
      const p = Math.min(Math.max(e.y / trackH, 0), 1)
      sbProgress.value = p
      runOnJS(driveScroll)(p)
    })
    .onUpdate((e) => {
      if (trackH <= 0) return
      const p = Math.min(Math.max(e.y / trackH, 0), 1)
      sbProgress.value = p
      runOnJS(driveScroll)(p)
    })

  return (
    <View style={[styles.wrap, { top: insets.top + 90, bottom: insets.bottom + 76 }]}>
      <GestureDetector gesture={pan}>
        <View style={styles.hit} onLayout={onLayout}>
          <View pointerEvents="none" style={styles.track} />
          <Animated.View pointerEvents="none" style={[styles.thumb, thumbStyle]} />
        </View>
      </GestureDetector>
    </View>
  )
}

const styles = StyleSheet.create({
  // Positioned strip on the far right; only as wide as the hit target.
  wrap: { position: 'absolute', right: 0, width: HIT_W },
  hit: { flex: 1, alignItems: 'flex-end', justifyContent: 'flex-start' },
  track: {
    position: 'absolute', right: 4, top: 0, bottom: 0, width: BAR_W,
    borderRadius: 999, backgroundColor: 'rgba(0,236,136,0.18)',
  },
  thumb: {
    position: 'absolute', right: 4, top: 0, width: BAR_W,
    borderRadius: 999, backgroundColor: colors.accent,
  },
})
