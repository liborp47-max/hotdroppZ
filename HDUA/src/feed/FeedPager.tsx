import { useCallback, useEffect, useRef, useState } from 'react'
import { LayoutChangeEvent, ScrollView, StyleSheet, View } from 'react-native'
import Animated, {
  runOnJS,
  useAnimatedScrollHandler,
  useSharedValue,
} from 'react-native-reanimated'
import { Image } from 'expo-image'
import * as Haptics from 'expo-haptics'

import { FeedPage } from '@/feed/FeedPage'
import { useFeedExpand } from '@/stores/feedExpand'
import { sbProgress, sbThumbFraction, setScroller } from '@/stores/scrollbarShared'
import type { FeedItem } from '@/types'

const AnimatedScrollView = Animated.ScrollView

/**
 * Full-screen vertical pager (HDUA-06). One post per page, CSS scroll-snap on web
 * (`pagingEnabled`) / native paging on device — buttery, momentum-snapped swipes.
 * A single Reanimated `scrollY` shared value drives every page's parallax on the
 * UI thread, so transitions stay at 60fps regardless of React render work.
 *
 * The right-edge scrollbar is the browser-native one (web), styled venom in
 * `styles/global.css` — a real draggable bar that never conflicts with taps.
 */
export function FeedPager({
  items,
  insetTop,
  insetBottom,
  onEndReached,
}: {
  items: FeedItem[]
  insetTop: number
  insetBottom: number
  onEndReached: () => void
}) {
  const scrollRef = useRef<ScrollView>(null)
  const scrollY = useSharedValue(0)
  const [pageH, setPageH] = useState(0)
  const [active, setActive] = useState(0)

  const expandedId = useFeedExpand((s) => s.expandedId)
  const toggle = useFeedExpand((s) => s.toggle)
  const collapse = useFeedExpand((s) => s.collapse)

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    setPageH(Math.round(e.nativeEvent.layout.height))
  }, [])

  // Size the global scrollbar thumb to the visible-page fraction of the feed.
  useEffect(() => {
    const content = items.length * pageH
    if (content > pageH) sbThumbFraction.value = pageH / content
  }, [items.length, pageH])

  // Let the global scrollbar's draggable thumb drive this feed (skip while a
  // post is open inline — then the feed is locked).
  const expandedRef = useRef(expandedId)
  expandedRef.current = expandedId
  useEffect(() => {
    setScroller((p) => {
      if (expandedRef.current) return
      const maxScroll = items.length * pageH - pageH
      if (maxScroll > 0) scrollRef.current?.scrollTo({ y: p * maxScroll, animated: false })
    })
    return () => setScroller(null)
  }, [items.length, pageH])

  const settle = useCallback((idx: number) => {
    const clamped = Math.max(0, Math.min(idx, items.length - 1))
    setActive((prev) => {
      if (prev !== clamped) Haptics.selectionAsync().catch(() => {})
      return clamped
    })
    // Warm the next cover image so it never pops in.
    const nextCover = items[clamped + 1]?.coverImage
    if (nextCover) Image.prefetch(nextCover).catch(() => {})
    // Prefetch more pages well before the end.
    if (clamped >= items.length - 3) onEndReached()
  }, [items, onEndReached])

  const count = items.length
  const scrollHandler = useAnimatedScrollHandler(
    {
      onScroll: (e) => {
        const y = e.contentOffset.y
        scrollY.value = y
        const content = count * pageH
        if (content > pageH) {
          sbThumbFraction.value = pageH / content
          sbProgress.value = Math.min(Math.max(y / (content - pageH), 0), 1)
        }
      },
      onMomentumEnd: (e) => {
        if (pageH > 0) runOnJS(settle)(Math.round(e.contentOffset.y / pageH))
      },
    },
    [pageH, settle, count],
  )

  // Reader reached its end → collapse and snap the next post in.
  const goNext = useCallback((fromIndex: number) => {
    collapse()
    const next = Math.min(fromIndex + 1, items.length - 1)
    if (pageH > 0) scrollRef.current?.scrollTo({ y: next * pageH, animated: true })
  }, [collapse, items.length, pageH])

  return (
    <View style={styles.fill} onLayout={onLayout}>
      {pageH > 0 ? (
        <AnimatedScrollView
          ref={scrollRef as never}
          style={styles.fill}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          decelerationRate="fast"
          scrollEventThrottle={16}
          onScroll={scrollHandler}
          // Lock background paging while a post is open — the reader drives nav.
          scrollEnabled={!expandedId}
        >
          {items.map((item, index) => (
            <FeedPage
              key={item.id}
              item={item}
              index={index}
              pageH={pageH}
              scrollY={scrollY}
              active={index === active}
              loadMedia={Math.abs(index - active) <= 1}
              expanded={expandedId === item.id}
              onToggle={() => toggle(item.id)}
              onNext={() => goNext(index)}
              insetTop={insetTop}
              insetBottom={insetBottom}
            />
          ))}
        </AnimatedScrollView>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
})
