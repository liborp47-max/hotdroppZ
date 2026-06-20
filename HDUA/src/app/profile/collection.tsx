import { useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { getFollowedArtists, getLiked, getSaved, unfollowArtist } from '@/api/user'
import { FeedCard } from '@/components/cards/FeedCard'
import { RequireAuth } from '@/components/auth/RequireAuth'
import { Avatar } from '@/components/shared/Avatar'
import { EmptyState } from '@/components/shared/EmptyState'
import { Segmented } from '@/components/shared/Segmented'
import type { FeedItem, Paginated } from '@/types'
import { colors, radius, spacing, typography } from '@/styles/theme'

type Tab = 'saved' | 'liked' | 'followed'
const isTab = (v: unknown): v is Tab => v === 'saved' || v === 'liked' || v === 'followed'

/** Profile collection (HDUA-26) — Saved / Liked / Followed, gated. */
export default function CollectionScreen() {
  return (
    <RequireAuth title="Tvoje sbírka" hint="Přihlas se a měj uložené dropy, lajky a sledované umělce na jednom místě.">
      <CollectionContent />
    </RequireAuth>
  )
}

function CollectionContent() {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const params = useLocalSearchParams<{ tab?: string }>()
  const [tab, setTab] = useState<Tab>(isTab(params.tab) ? params.tab : 'saved')

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} hitSlop={10} style={styles.back}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Sbírka</Text>
        <View style={styles.back} />
      </View>

      <View style={styles.segmentWrap}>
        <Segmented
          options={[
            { value: 'saved', label: 'Uložené' },
            { value: 'liked', label: 'Líbí se' },
            { value: 'followed', label: 'Sleduji' },
          ]}
          value={tab}
          onChange={setTab}
        />
      </View>

      {tab === 'followed' ? <FollowedList /> : <InteractionList key={tab} kind={tab} />}
    </View>
  )
}

// ── Saved / Liked: infinite, cursor-paginated feed of interacted posts ─────────

function InteractionList({ kind }: { kind: 'saved' | 'liked' }) {
  const fetcher = kind === 'saved' ? getSaved : getLiked
  const query = useInfiniteQuery({
    queryKey: ['collection', kind],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }): Promise<Paginated<FeedItem>> => fetcher(20, pageParam),
    getNextPageParam: (last) => last.nextCursor,
  })
  const items = query.data?.pages.flatMap((p) => p.items) ?? []

  if (query.isLoading) {
    return <View style={styles.center}><ActivityIndicator color={colors.accent} /></View>
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(i) => i.id}
      renderItem={({ item }) => <FeedCard item={item} />}
      contentContainerStyle={styles.list}
      showsVerticalScrollIndicator
      onEndReachedThreshold={0.6}
      onEndReached={() => query.hasNextPage && !query.isFetchingNextPage && query.fetchNextPage()}
      ListFooterComponent={
        query.isFetchingNextPage ? <ActivityIndicator color={colors.accent} style={styles.footer} /> : null
      }
      ListEmptyComponent={
        <EmptyState
          icon={kind === 'saved' ? 'bookmark-outline' : 'heart-outline'}
          title={kind === 'saved' ? 'Zatím nic uloženého' : 'Zatím žádné lajky'}
          hint={kind === 'saved' ? 'Ulož si dropy ze feedu a najdeš je tady.' : 'Co se ti líbí, se objeví tady.'}
        />
      }
    />
  )
}

// ── Followed: artist names on hdua_settings.followed_artists, with unfollow ────

function FollowedList() {
  const qc = useQueryClient()
  const { data: artists = [], isLoading } = useQuery({ queryKey: ['followedArtists'], queryFn: getFollowedArtists })

  const unfollow = useMutation({
    mutationFn: (name: string) => unfollowArtist(name),
    onMutate: async (name) => {
      await qc.cancelQueries({ queryKey: ['followedArtists'] })
      const prev = qc.getQueryData<string[]>(['followedArtists'])
      qc.setQueryData<string[]>(['followedArtists'], (old) => (old ?? []).filter((a) => a !== name))
      return { prev }
    },
    onError: (_e, _name, ctx) => qc.setQueryData(['followedArtists'], ctx?.prev),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['followedArtists'] })
      qc.invalidateQueries({ queryKey: ['settings'] })
    },
  })

  if (isLoading) {
    return <View style={styles.center}><ActivityIndicator color={colors.accent} /></View>
  }

  return (
    <FlatList
      data={artists}
      keyExtractor={(a) => a}
      renderItem={({ item }) => (
        <View style={styles.artistRow}>
          <Avatar name={item} size={40} />
          <Text style={styles.artistName} numberOfLines={1}>{item}</Text>
          <Pressable
            onPress={() => unfollow.mutate(item)}
            hitSlop={8}
            style={styles.unfollow}
            accessibilityRole="button"
            accessibilityLabel={`Přestat sledovat ${item}`}
          >
            <Ionicons name="close" size={16} color={colors.textMuted} />
          </Pressable>
        </View>
      )}
      contentContainerStyle={styles.list}
      ListEmptyComponent={
        <EmptyState icon="star-outline" title="Nikoho nesleduješ" hint="Sleduj umělce a měj jejich dropy po ruce." />
      }
    />
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  back: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: colors.text, fontSize: typography.headline, fontWeight: '800' },
  segmentWrap: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: spacing.lg, gap: spacing.md, flexGrow: 1 },
  footer: { marginVertical: spacing.md },
  artistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  artistName: { flex: 1, color: colors.text, fontSize: typography.body, fontWeight: '600' },
  unfollow: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
