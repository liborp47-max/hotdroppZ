import { useCallback, useEffect } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'

import { FeedPager } from '@/feed/FeedPager'
import { EmptyState } from '@/components/shared/EmptyState'
import { useFeed, type FeedKind } from '@/hooks/useFeed'
import { useFeedRealtime } from '@/hooks/useFeedRealtime'
import { useFeedCache } from '@/stores/feedCache'
import { colors, radius, spacing, typography } from '@/styles/theme'

/**
 * Feed Engine (HDUA-05/06). Owns the cursor-paginated infinite query and feeds it
 * into the full-screen swipe pager. The pager handles snap/parallax; this stays
 * the data + lifecycle boundary (loading / error / empty, cache warming).
 */
export function FeedList({ kind = 'latest' }: { kind?: FeedKind }) {
  const insets = useSafeAreaInsets()
  const {
    items, isLoading, isError, error,
    fetchNextPage, hasNextPage, isFetchingNextPage,
  } = useFeed(kind)

  // HDCC→HDUA realtime bridge: live "X nových" pill on the chronological feed.
  const { newCount, flush } = useFeedRealtime(kind === 'latest')

  // Keep the detail/reader instant-open cache warm with whatever the feed loads.
  const putCache = useFeedCache((s) => s.put)
  useEffect(() => {
    if (items.length) putCache(items)
  }, [items, putCache])

  const onEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    )
  }

  if (isError) {
    return (
      <EmptyState
        icon="cloud-offline-outline"
        title="Feed se nepodařilo načíst"
        hint={error instanceof Error ? error.message : 'Zkontroluj připojení a zkus to znovu.'}
      />
    )
  }

  if (!items.length) {
    return <EmptyState icon="flame-outline" title="Zatím prázdno" hint="Jakmile pipeline vydá obsah, objeví se tady." />
  }

  return (
    <View style={styles.fill}>
      <FeedPager
        items={items}
        insetTop={insets.top}
        insetBottom={insets.bottom}
        onEndReached={onEndReached}
      />
      {newCount > 0 ? (
        <View style={[styles.newPillWrap, { top: insets.top + spacing.md }]} pointerEvents="box-none">
          <Pressable style={styles.newPill} onPress={() => void flush()} accessibilityRole="button">
            <Ionicons name="arrow-up" size={14} color={colors.bg} />
            <Text style={styles.newPillText}>
              {newCount} {newCount === 1 ? 'nový příspěvek' : 'nové příspěvky'}
            </Text>
          </Pressable>
        </View>
      ) : null}
      {isFetchingNextPage ? (
        <View style={[styles.loadMore, { bottom: insets.bottom + 16 }]} pointerEvents="none">
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadMore: { position: 'absolute', alignSelf: 'center' },
  newPillWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  newPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.accent,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    shadowColor: colors.accent,
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 2 },
  },
  newPillText: { color: colors.bg, fontSize: typography.label, fontWeight: typography.semibold },
})
