/**
 * HDUA-18 — wire a JS-`onScroll` surface (e.g. the post/[id] reader's FlashList)
 * to the app-wide GlobalScrollbar.
 *
 * On scroll it writes `sbProgress` / `sbThumbFraction` so the thumb reflects the
 * reader's content position. On focus it claims the draggable bar, SAVING the
 * previously-active scroller and RESTORING it on blur — so the feed (mounted
 * underneath the pushed reader) keeps its bar when you return. If nothing owned
 * the bar before (e.g. deep-link straight into a post), it neutralizes on blur so
 * a later static screen doesn't inherit a foreign position.
 *
 * Deliberately additive: it never touches FeedPager / GlobalScrollbar.
 */
import { useCallback, useRef } from 'react'
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native'
import { useFocusEffect } from 'expo-router'

import {
  getScroller,
  resetScrollbar,
  sbProgress,
  sbThumbFraction,
  setScroller,
  type Scroller,
} from '@/stores/scrollbarShared'

export function useScrollbarSurface(scrollToOffset: (y: number) => void) {
  const maxRef = useRef(0)

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent
    const max = Math.max(contentSize.height - layoutMeasurement.height, 0)
    maxRef.current = max
    if (contentSize.height > 0) {
      sbThumbFraction.value = Math.min(layoutMeasurement.height / contentSize.height, 1)
    }
    sbProgress.value = max > 0 ? Math.min(Math.max(contentOffset.y / max, 0), 1) : 0
  }, [])

  useFocusEffect(
    useCallback(() => {
      const prev = getScroller()
      const me: Scroller = (p) => scrollToOffset(p * maxRef.current)
      setScroller(me)
      return () => {
        // Only relinquish if we're still the owner (guards against races).
        if (getScroller() !== me) return
        if (prev) {
          setScroller(prev)
        } else {
          setScroller(null)
          resetScrollbar()
        }
      }
    }, [scrollToOffset]),
  )

  return onScroll
}
