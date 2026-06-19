import { useCallback, useRef } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { FlashList } from '@shopify/flash-list'
import { Ionicons } from '@expo/vector-icons'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { PostView } from '@/components/post/PostView'
import { usePost } from '@/hooks/usePost'
import { useFeed } from '@/hooks/useFeed'
import { useScrollbarSurface } from '@/hooks/useScrollbarSurface'
import { colors, radius, spacing, typography } from '@/styles/theme'
import type { FeedItem, Post } from '@/types'

type Row = { kind: 'current'; post: Post } | { kind: 'next'; post: FeedItem }

/**
 * Post detail + continuous reader (HDUA-07). Opens the tapped post, then streams
 * the following posts inline below it — scrolling past the end of one article
 * flows straight into the next (TikTok + Apple News), never bouncing back to the
 * feed. Back gesture returns to the feed with its scroll position intact (the
 * feed screen stays mounted underneath).
 */
export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const insets = useSafeAreaInsets()

  const { data: post, isLoading } = usePost(id)
  const { items, fetchNextPage, hasNextPage, isFetchingNextPage } = useFeed('latest')

  // Current post first, then the rest of the feed (minus self) as continuation.
  const continuation = items.filter((i) => i.id !== id)
  const rows: Row[] = [
    ...(post ? [{ kind: 'current' as const, post }] : []),
    ...continuation.map((p) => ({ kind: 'next' as const, post: p })),
  ]

  const renderItem = useCallback(({ item }: { item: Row }) => {
    if (item.kind === 'current') return <PostView post={item.post} />
    return (
      <View>
        <View style={styles.divider}>
          <View style={styles.line} />
          <Text style={styles.dividerText}>DALŠÍ</Text>
          <View style={styles.line} />
        </View>
        <PostView post={item.post} />
      </View>
    )
  }, [])

  const onEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  // HDUA-18: drive the app-wide scrollbar from the reader's own scroll position.
  const listRef = useRef<FlashList<Row>>(null)
  const onScroll = useScrollbarSurface((y) => listRef.current?.scrollToOffset({ offset: y, animated: false }))

  return (
    <View style={styles.root}>
      {isLoading && !post ? (
        <View style={styles.center}><ActivityIndicator color={colors.accent} /></View>
      ) : (
        <FlashList
          ref={listRef}
          data={rows}
          renderItem={renderItem}
          keyExtractor={(r) => `${r.kind}-${r.post.id}`}
          getItemType={(r) => r.kind}
          estimatedItemSize={640}
          showsVerticalScrollIndicator
          contentContainerStyle={{ paddingBottom: spacing.xxl }}
          onScroll={onScroll}
          scrollEventThrottle={16}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.8}
          ListFooterComponent={isFetchingNextPage ? <View style={styles.footer}><ActivityIndicator color={colors.accent} /></View> : null}
        />
      )}

      {/* Floating back button */}
      <Pressable style={[styles.back, { top: insets.top + spacing.sm }]} onPress={() => router.back()} hitSlop={10}>
        <Ionicons name="chevron-back" size={22} color={colors.text} />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  back: {
    position: 'absolute', left: spacing.lg,
    width: 40, height: 40, borderRadius: radius.pill,
    backgroundColor: 'rgba(10,10,11,0.7)', alignItems: 'center', justifyContent: 'center',
  },
  divider: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.xl },
  line: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { color: colors.textFaint, fontSize: typography.caption, fontWeight: '800', letterSpacing: 1.5 },
  footer: { paddingVertical: spacing.xl },
})
