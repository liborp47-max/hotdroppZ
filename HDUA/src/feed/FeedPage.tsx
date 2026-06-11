import { memo, useCallback, useEffect, useRef, useState } from 'react'
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native'
import Animated, {
  Extrapolation,
  FadeIn,
  SlideInDown,
  SlideOutDown,
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'

import { EmbedPlayer } from '@/components/media/Embed'
import { usePost } from '@/hooks/usePost'
import { pickEmbed } from '@/lib/embeds'
import { trackView } from '@/lib/analytics'
import { useShareSheet } from '@/stores/shareSheet'
import { colors, radius, spacing, typography } from '@/styles/theme'
import { compact, timeAgo } from '@/utils/text'
import type { FeedItem, SourcePlatform } from '@/types'

const BLURHASH = 'L4A_=2~q00009F-;_3IU00of?bof'

const SOURCE_META: Record<SourcePlatform, { label: string; color: string; icon: keyof typeof Ionicons.glyphMap }> = {
  spotify: { label: 'Spotify', color: colors.spotify, icon: 'musical-notes' },
  apple_music: { label: 'Apple Music', color: colors.appleMusic, icon: 'musical-note' },
  youtube: { label: 'YouTube', color: colors.youtube, icon: 'logo-youtube' },
  web: { label: 'Source', color: colors.textMuted, icon: 'globe-outline' },
}

const TYPE_BADGE: Partial<Record<FeedItem['type'], string>> = {
  release: 'NEW DROP', video: 'VIDEO', event: 'EVENT', interview: 'INTERVIEW',
  ranking: 'RANKING', drama: 'DRAMA',
}

function RailButton({
  icon, label, active, accent, onPress,
}: { icon: keyof typeof Ionicons.glyphMap; label?: string; active?: boolean; accent?: boolean; onPress?: () => void }) {
  const tint = active ? colors.danger : accent ? colors.accent : colors.text
  return (
    <Pressable style={styles.railBtn} onPress={onPress} hitSlop={8}>
      <View style={styles.railIcon}>
        <Ionicons name={icon} size={27} color={tint} />
      </View>
      {label ? <Text style={styles.railLabel}>{label}</Text> : null}
    </Pressable>
  )
}

/**
 * Full-screen feed post (HDUA-06, TikTok-style pager). Each page fills the
 * viewport; the hero parallaxes against the scroll position for depth as pages
 * snap past one another. Tapping opens the continuous reader overlay.
 */
function FeedPageBase({
  item, index, pageH, scrollY, active, loadMedia, expanded, onToggle, onNext, insetTop, insetBottom,
}: {
  item: FeedItem
  index: number
  pageH: number
  scrollY: SharedValue<number>
  active: boolean
  loadMedia: boolean
  expanded: boolean
  onToggle: () => void
  onNext: () => void
  insetTop: number
  insetBottom: number
}) {
  const openShare = useShareSheet((s) => s.open)
  const [liked, setLiked] = useState(false)

  const badge = TYPE_BADGE[item.type]
  const playable = item.type === 'release' || item.type === 'video' || item.type === 'playlist'
  const sig = item.signals

  // Hero parallax — drifts slower than the page + slight zoom on neighbours.
  const heroStyle = useAnimatedStyle(() => {
    const p = scrollY.value - index * pageH
    return {
      transform: [
        { translateY: interpolate(p, [-pageH, 0, pageH], [-pageH * 0.16, 0, pageH * 0.16], Extrapolation.CLAMP) },
        { scale: interpolate(p, [-pageH, 0, pageH], [1.12, 1, 1.12], Extrapolation.CLAMP) },
      ],
    }
  })

  // Overlay content rises + fades as the page leaves centre (buttery hand-off).
  const contentStyle = useAnimatedStyle(() => {
    const p = scrollY.value - index * pageH
    return {
      opacity: interpolate(Math.abs(p), [0, pageH * 0.75], [1, 0], Extrapolation.CLAMP),
      transform: [{ translateY: interpolate(p, [-pageH, 0, pageH], [48, 0, -48], Extrapolation.CLAMP) }],
    }
  })

  return (
    <View style={[styles.page, { height: pageH }]}>
      {/* Hero */}
      <Animated.View style={[StyleSheet.absoluteFill, heroStyle]}>
        {item.coverImage && loadMedia ? (
          <Image
            source={{ uri: item.coverImage }}
            placeholder={BLURHASH}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={220}
            priority={active ? 'high' : 'normal'}
            recyclingKey={item.id}
          />
        ) : (
          <Image placeholder={BLURHASH} style={StyleSheet.absoluteFill} contentFit="cover" />
        )}
      </Animated.View>

      <View style={styles.scrimTop} pointerEvents="none" />
      <View style={styles.scrimMid} pointerEvents="none" />
      <View style={styles.scrimBottom} pointerEvents="none" />

      {/* Tap target opens the reader */}
      <Pressable style={StyleSheet.absoluteFill} onPress={onToggle} />

      {badge ? (
        <View style={[styles.badge, { top: insetTop + spacing.md }]} pointerEvents="none">
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      ) : null}

      {playable ? (
        <View style={styles.play} pointerEvents="none">
          <Ionicons name="play" size={30} color={colors.bg} />
        </View>
      ) : null}

      {/* Right action rail */}
      <View style={[styles.rail, { bottom: insetBottom + 96 }]}>
        <RailButton
          icon={liked ? 'heart' : 'heart-outline'}
          label={compact((sig?.likes ?? 0) + (liked ? 1 : 0))}
          active={liked}
          onPress={() => {
            setLiked((v) => !v)
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
          }}
        />
        <RailButton icon="chatbubble-ellipses-outline" label={compact(sig?.comments ?? 0)} onPress={onToggle} />
        <RailButton icon="arrow-redo-outline" label="Sdílet" onPress={() => openShare(item)} />
        <RailButton icon="flame" label="Boost" accent onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {})} />
      </View>

      {/* Bottom content overlay */}
      <Animated.View style={[styles.overlay, { paddingBottom: insetBottom + spacing.lg }, contentStyle]} pointerEvents="box-none">
        <View style={styles.metaRow}>
          {item.artist ? <Text style={styles.artist} numberOfLines={1}>{item.artist}</Text> : null}
          {item.category ? <Text style={styles.category}>{item.category.toUpperCase()}</Text> : null}
          <Text style={styles.time}>{timeAgo(item.publishedAt ?? item.createdAt)}</Text>
        </View>

        <Pressable onPress={onToggle}>
          <Text style={styles.title} numberOfLines={3}>{item.title}</Text>
          {item.content ? <Text style={styles.preview} numberOfLines={2}>{item.content}</Text> : null}
        </Pressable>

        {(item.tags ?? []).length > 0 ? (
          <View style={styles.tags}>
            {(item.tags ?? []).slice(0, 4).map((t) => <Text key={t} style={styles.tag}>#{t}</Text>)}
          </View>
        ) : null}

        {sig && (sig.trendDeltaPct != null || sig.trendingRank != null || sig.listeningNow != null) ? (
          <View style={styles.signals}>
            {sig.trendDeltaPct != null ? <View style={styles.signal}><Ionicons name="flame-outline" size={14} color={colors.accent} /><Text style={styles.signalStrong}>+{sig.trendDeltaPct}%</Text></View> : null}
            {sig.trendingRank != null ? <View style={styles.signal}><Ionicons name="trending-up" size={14} color={colors.text} /><Text style={styles.signalStrong}>#{sig.trendingRank}</Text></View> : null}
            {sig.listeningNow != null ? <View style={styles.signal}><Ionicons name="people-outline" size={14} color={colors.text} /><Text style={styles.signalStrong}>{compact(sig.listeningNow)}</Text></View> : null}
          </View>
        ) : null}

        <Pressable style={styles.readMore} onPress={onToggle} hitSlop={8}>
          <Text style={styles.readMoreText}>Číst víc</Text>
          <Ionicons name="chevron-up" size={16} color={colors.bg} />
        </Pressable>
      </Animated.View>

      {/* Continuous reader overlay */}
      {expanded ? <FeedReader item={item} insetTop={insetTop} onClose={onToggle} onNext={onNext} /> : null}
    </View>
  )
}

/**
 * The opened post. Slides up over the page; scrolling to the end smoothly closes
 * it and advances to the next post, pulling down (or the close button) collapses
 * back to the feed. Full body streams in from the post cache (instant) → API.
 */
function FeedReader({
  item, insetTop, onClose, onNext,
}: { item: FeedItem; insetTop: number; onClose: () => void; onNext: () => void }) {
  const { data: post } = usePost(item.id)
  const openShare = useShareSheet((s) => s.open)
  const embed = pickEmbed(item)
  const sources = item.sources ?? []
  const body = post?.body ?? item.content
  const fired = useRef(false)
  const dwell = useRef(Date.now())

  useEffect(() => {
    dwell.current = Date.now()
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
    return () => trackView(item.id, { dwellMs: Date.now() - dwell.current })
  }, [item.id])

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent
    // Pull down from the top → collapse back to the feed.
    if (contentOffset.y < -64) {
      onClose()
      return
    }
    // Scrolled past the end → close and snap the next post in.
    const distanceToEnd = contentSize.height - (contentOffset.y + layoutMeasurement.height)
    if (distanceToEnd < 12 && !fired.current) {
      fired.current = true
      onNext()
    }
  }, [onClose, onNext])

  return (
    <Animated.View style={styles.reader} entering={SlideInDown.duration(300)} exiting={SlideOutDown.duration(220)}>
      <Animated.View style={styles.readerScrim} entering={FadeIn.duration(200)} pointerEvents="none" />
      <ScrollView
        style={styles.fill}
        contentContainerStyle={[styles.readerContent, { paddingTop: insetTop + spacing.xxl }]}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        {item.coverImage ? (
          <Image source={{ uri: item.coverImage }} placeholder={BLURHASH} style={styles.readerHero} contentFit="cover" transition={200} />
        ) : null}

        <View style={styles.readerBody}>
          <View style={styles.metaRow}>
            {item.artist ? <Text style={styles.artist} numberOfLines={1}>{item.artist}</Text> : null}
            {item.category ? <Text style={styles.category}>{item.category.toUpperCase()}</Text> : null}
            <Text style={styles.time}>{timeAgo(item.publishedAt ?? item.createdAt)}</Text>
          </View>

          <Text style={styles.readerTitle}>{item.title}</Text>

          <Pressable style={styles.shareBtn} onPress={() => openShare(item)}>
            <Ionicons name="share-social-outline" size={18} color={colors.bg} />
            <Text style={styles.shareText}>Sdílet</Text>
          </Pressable>

          {body ? <Text style={styles.readerText}>{body}</Text> : null}
          {embed ? <EmbedPlayer embed={embed} /> : null}

          {sources.length > 0 ? (
            <View style={styles.sources}>
              {sources.map((s) => {
                const meta = SOURCE_META[s.platform]
                return (
                  <Pressable key={s.platform + s.url} style={[styles.sourceBtn, { borderColor: meta.color }]} onPress={() => Linking.openURL(s.url).catch(() => {})}>
                    <Ionicons name={meta.icon} size={15} color={meta.color} />
                    <Text style={[styles.sourceText, { color: meta.color }]}>{s.label ?? meta.label}</Text>
                    <Ionicons name="open-outline" size={12} color={meta.color} />
                  </Pressable>
                )
              })}
            </View>
          ) : null}

          {item.sourceUrl ? (
            <Pressable style={styles.readSource} onPress={() => Linking.openURL(item.sourceUrl as string).catch(() => {})}>
              <Ionicons name="link-outline" size={14} color={colors.textMuted} />
              <Text style={styles.readSourceText} numberOfLines={1}>{item.source ?? 'Zdroj'}</Text>
            </Pressable>
          ) : null}

          <View style={styles.nextHint}>
            <Ionicons name="chevron-down" size={18} color={colors.accent} />
            <Text style={styles.nextHintText}>Scrolluj dál na další příspěvek</Text>
          </View>
        </View>
      </ScrollView>

      <Pressable style={[styles.readerClose, { top: insetTop + spacing.sm }]} onPress={onClose} hitSlop={10}>
        <Ionicons name="chevron-down" size={22} color={colors.text} />
      </Pressable>
    </Animated.View>
  )
}

export const FeedPage = memo(FeedPageBase)

const styles = StyleSheet.create({
  page: { width: '100%', overflow: 'hidden', backgroundColor: colors.bg },
  scrimTop: { position: 'absolute', top: 0, left: 0, right: 0, height: 140, backgroundColor: 'rgba(10,10,11,0.35)' },
  scrimMid: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '55%', backgroundColor: 'rgba(10,10,11,0.45)' },
  scrimBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '32%', backgroundColor: 'rgba(10,10,11,0.85)' },

  badge: { position: 'absolute', left: spacing.lg, backgroundColor: colors.accent, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  badgeText: { color: colors.bg, fontSize: typography.caption, fontWeight: '800', letterSpacing: 0.5 },
  play: { position: 'absolute', top: '40%', alignSelf: 'center', width: 62, height: 62, borderRadius: 31, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },

  // right offset clears the app-wide scrollbar's hit area (right edge, ~22px).
  rail: { position: 'absolute', right: 30, alignItems: 'center', gap: spacing.lg },
  railBtn: { alignItems: 'center', gap: 3 },
  railIcon: { alignItems: 'center', justifyContent: 'center' },
  railLabel: { color: colors.text, fontSize: typography.caption, fontWeight: '700' },

  overlay: { position: 'absolute', left: 0, right: 64, bottom: 0, paddingHorizontal: spacing.lg, gap: spacing.sm },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  artist: { color: colors.accent, fontSize: typography.label, fontWeight: '700', flexShrink: 1 },
  category: { color: colors.text, fontSize: typography.caption, fontWeight: '700', letterSpacing: 0.5, opacity: 0.85 },
  time: { color: colors.textFaint, fontSize: typography.caption, marginLeft: 'auto' },
  title: { color: colors.text, fontSize: typography.title, fontWeight: '800', lineHeight: 28 },
  preview: { color: colors.textMuted, fontSize: typography.label, lineHeight: 20, marginTop: spacing.xs },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tag: { color: colors.accent, fontSize: typography.label, fontWeight: '600' },
  signals: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.xs },
  signal: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  signalStrong: { color: colors.text, fontSize: typography.label, fontWeight: '700' },
  readMore: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 4, marginTop: spacing.sm, backgroundColor: colors.accent, borderRadius: radius.pill, paddingHorizontal: spacing.lg, paddingVertical: 8 },
  readMoreText: { color: colors.bg, fontSize: typography.label, fontWeight: '800' },

  // Reader overlay
  fill: { flex: 1 },
  reader: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.bg },
  readerScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.bg },
  readerContent: { paddingBottom: 220 },
  readerHero: { width: '100%', aspectRatio: 1.6, backgroundColor: colors.bgElevated },
  readerBody: { padding: spacing.lg, gap: spacing.md },
  readerTitle: { color: colors.text, fontSize: typography.title, fontWeight: '800', lineHeight: 30 },
  shareBtn: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6, backgroundColor: colors.accent, borderRadius: radius.pill, paddingHorizontal: spacing.lg, paddingVertical: 9 },
  shareText: { color: colors.bg, fontSize: typography.label, fontWeight: '700' },
  readerText: { color: colors.textMuted, fontSize: typography.body, lineHeight: 24 },
  sources: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  sourceBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 7 },
  sourceText: { fontSize: typography.label, fontWeight: '700' },
  readSource: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  readSourceText: { color: colors.textMuted, fontSize: typography.label, flexShrink: 1 },
  nextHint: { alignItems: 'center', gap: 2, paddingTop: spacing.xxl },
  nextHintText: { color: colors.accent, fontSize: typography.label, fontWeight: '700' },
  readerClose: { position: 'absolute', left: spacing.lg, width: 40, height: 40, borderRadius: radius.pill, backgroundColor: 'rgba(10,10,11,0.7)', alignItems: 'center', justifyContent: 'center' },
})
