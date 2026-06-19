/**
 * Module-level state for the app-wide scrollbar (rendered once in the root
 * layout, above every screen).
 *
 *  sbProgress      0..1 — scroll position (shared value, UI thread)
 *  sbThumbFraction 0..1 — visible / total → thumb height fraction
 *
 * The active scrollable surface (the feed) registers a `Scroller` so the
 * draggable thumb can drive it. Plain module variables — no React, no re-renders.
 */
import { makeMutable } from 'react-native-reanimated'

export const sbProgress = makeMutable(0)
export const sbThumbFraction = makeMutable(0.25)

export type Scroller = (progress: number) => void

let activeScroller: Scroller | null = null

export function setScroller(s: Scroller | null) {
  activeScroller = s
}

/** Current owner of the bar — lets a pushed surface (the reader) save & restore it
 *  on focus/blur so the surface underneath (the feed) keeps its draggable bar. */
export function getScroller(): Scroller | null {
  return activeScroller
}

/** Neutralize the bar: full thumb at top, no foreign scroll position shown
 *  (HDUA-18 — for surfaces with nothing scrollable / on blur with no prior owner). */
export function resetScrollbar() {
  sbProgress.value = 0
  sbThumbFraction.value = 1
}

/** Called (via runOnJS) from the scrollbar's drag gesture. */
export function driveScroll(progress: number) {
  activeScroller?.(progress)
}
