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
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'

import { EmbedPlayer } from '@/components/media/Embed'
import { usePost } from '@/hooks/usePost'
import { pickEmbed } from '@/lib/embeds'
import { trackView } from '@/lib/analytics'
import { useShareSheet } from '@/stores/shareSheet'
import { colors, glows, radius, spacing, typography } from '@/styles/theme'
import { timeAgo } from '@/utils/text'
import type { FeedItem, SourcePlatform } from '@/types'

const BLURHASH = 'L4A_=2~q00009F-;_3IU00of?bof'

const SOURCE_META: Record<SourcePlatform, { label: string; color: string; icon: keyof typeof Ionicons.glyphMap }> = {
  spotify: { label: 'Spotify', color: colors.spotify, icon: 'musical-notes' },
  apple_music: { label: 'Apple Music', color: colors.appleMusic, icon: 'musical-note' },
  youtube: { label: 'YouTube', color: colors.youtube, icon: 'logo-youtube' },
  genius: { label: 'Genius', color: '#FFD000', icon: 'document-text' },
  web: { label: 'Source', color: colors.textMuted, icon: 'globe-outline' },
}

// Violet "DROP POST" badge label per type.
const TYPE_BADGE: Partial<Record<FeedItem['type'], string>> = {
  release: 'DROP POST', video: 'VIDEO', event: 'EVENT', interview: 'INTERVIEW',
  ranking: 'RANKING', drama: 'DRAMA', playlist: 'PLAYLIST', festival: 'FESTIVAL',
}

// Fallback label for the disc pill when the item has no explicit subcategory.
const PILL_TYPE: Partial<Record<FeedItem['type'], string>> = {
  release: 'Release', video: 'Video', playlist: 'Playlist', event: 'Event',
  festival: 'Festival', interview: 'Interview', ranking: 'Ranking',
}

// Brand flame — the no-cover fallback watermark.
const FLAME = require('@/assets/brand/flame.png')

// Deterministic dark, on-brand gradients for posts without a cover image, so
// each hero looks distinct (not the same blurhash) until enrichment lands one.
const FALLBACKS: [string, string][] = [
  ['#0B1A12', '#04120C'], // green
  ['#0A1A1A', '#04120F'], // teal
  ['#12101F', '#0A0A16'], // violet
  ['#15110A', '#0E0A06'], // amber
  ['#0E1410', '#070D09'], // neutral green
  ['#101418', '#080C10'], // slate
]

function hashIndex(id: string, mod: number): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return h % mod
}

/** Distinct, on-brand hero for posts that have no cover image yet. */
function FallbackHero({ id }: { id: string }) {
  const [a, b] = FALLBACKS[hashIndex(id, FALLBACKS.length)]
  return (
    <View style={StyleSheet.absoluteFill}>
      <LinearGradient colors={[a, b]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <Image source={FLAME} style={styles.fallbackFlame} contentFit="contain" />
    </View>
  )
}

type Pill = { icon: keyof typeof Ionicons.glyphMap; label: string }

/**
 * Feed post (HDUA-06). Editorial card layout: a parallaxing hero fills the top
 * of the page, the content sits below on pure black — violet DROP POST badge +
 * outline-flame boost, a bold title, icon pill chips, a rule, then a faded body
 * preview. One card per page in a snap pager; tap (or "read") opens the reader.
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
  const [boosted, setBoosted] = useState(false)

  const badge = TYPE_BADGE[item.type]
  const playable = item.type === 'release' || item.type === 'video' || item.type === 'playlist'
  const heroH = Math.round(pageH * 0.54)

  const pills: Pill[] = [
    item.artist ? { icon: 'person-outline' as const, label: item.artist } : null,
    item.country ? { icon: 'globe-outline' as const, label: item.country } : null,
    item.category ? { icon: 'musical-notes' as const, label: item.category } : null,
    item.subcategory || PILL_TYPE[item.type]
      ? { icon: 'disc-outline' as const, label: (item.subcategory ?? PILL_TYPE[item.type]) as string }
      : null,
  ].filter(Boolean) as Pill[]

  // Springy settle when the post docks (becomes active) — adds "snap weight".
  const pulse = useSharedValue(1)
  useEffect(() => {
    if (active) {
      pulse.value = withSequence(withTiming(1.04, { duration: 140 }), withSpring(1, { damping: 12, stiffness: 170 }))
    }
  }, [active, pulse])

  // Hero parallax — drifts slower than the page + slight zoom on neighbours.
  const heroStyle = useAnimatedStyle(() => {
    const p = scrollY.value - index * pageH
    const parScale = interpolate(p, [-pageH, 0, pageH], [1.14, 1, 1.14], Extrapolation.CLAMP)
    return {
      transform: [
        { translateY: interpolate(p, [-pageH, 0, pageH], [-heroH * 0.18, 0, heroH * 0.18], Extrapolation.CLAMP) },
        { scale: parScale * pulse.value },
      ],
    }
  })

  // Content gently rises + fades as the page leaves centre (buttery hand-off).
  const contentStyle = useAnimatedStyle(() => {
    const p = scrollY.value - index * pageH
    return {
      opacity: interpolate(Math.abs(p), [0, pageH * 0.7], [1, 0.1], Extrapolation.CLAMP),
      transform: [{ translateY: interpolate(p, [-pageH, 0, pageH], [26, 0, -26], Extrapolation.CLAMP) }],
    }
  })

  // Neighbour dim — adjacent cards recede so the active one is the clear focus.
  const dimStyle = useAnimatedStyle(() => {
    const d = Math.abs(scrollY.value - index * pageH)
    return { opacity: interpolate(d, [0, pageH], [0, 0.5], Extrapolation.CLAMP) }
  })

  return (
    <View style={[styles.page, { height: pageH }]}>
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <View style={[styles.hero, { height: heroH }]}>
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
            <FallbackHero id={item.id} />
          )}
        </Animated.View>

        {/* Glossy diagonal sheen */}
        <LinearGradient
          colors={['rgba(255,255,255,0.10)', 'rgba(255,255,255,0)', 'rgba(255,255,255,0)']}
          locations={[0, 0.5, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.85, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        {/* Blend the hero's bottom edge into the black content area */}
        <LinearGradient
          colors={['transparent', 'transparent', colors.bg]}
          locations={[0, 0.65, 1]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        {/* Neighbour dim over the hero while swiping */}
        <Animated.View style={[StyleSheet.absoluteFill, styles.dim, dimStyle]} pointerEvents="none" />

        {playable ? (
          <View style={styles.play} pointerEvents="none">
            <Ionicons name="play" size={30} color={colors.bg} />
          </View>
        ) : null}

        {/* Tap the hero to open the reader */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onToggle} />
      </View>

      {/* ── Content (on black) ───────────────────────────────────────────── */}
      <Animated.View style={[styles.content, { paddingBottom: insetBottom + spacing.lg }, contentStyle]}>
        <View style={styles.topRow}>
          {badge ? (
            <View style={styles.badge}><Text style={styles.badgeText}>{badge}</Text></View>
          ) : (
            <View />
          )}
          <Pressable
            style={styles.boostBtn}
            hitSlop={10}
            onPress={() => {
              setBoosted((v) => !v)
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {})
            }}
          >
            <Ionicons name={boosted ? 'flame' : 'flame-outline'} size={30} color={boosted ? colors.accent : colors.text} />
          </Pressable>
        </View>

        <Pressable onPress={onToggle}>
          <Text style={styles.title} numberOfLines={3}>{item.title}</Text>
        </Pressable>

        {pills.length > 0 ? (
          <View style={styles.pillRow}>
            {pills.map((p) => (
              <View key={p.label} style={styles.pill}>
                <Ionicons name={p.icon} size={15} color={colors.textMuted} />
                <Text style={styles.pillText} numberOfLines={1}>{p.label}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.divider} />

        {item.content ? (
          <View style={styles.previewWrap}>
            <Pressable onPress={onToggle}>
              <Text style={styles.preview} numberOfLines={4}>{item.content}</Text>
            </Pressable>
            <LinearGradient
              colors={['transparent', colors.bg]}
              style={styles.previewFade}
              pointerEvents="none"
            />
          </View>
        ) : null}
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

  // Hero (top)
  hero: { width: '100%', overflow: 'hidden', backgroundColor: colors.bgElevated },
  dim: { backgroundColor: '#000' },
  fallbackFlame: { position: 'absolute', top: '24%', alignSelf: 'center', width: 170, height: 204, opacity: 0.06 },
  play: {
    position: 'absolute', top: '38%', alignSelf: 'center', width: 62, height: 62, borderRadius: 31,
    backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', ...glows.strong,
  },

  // Content (below, on black)
  content: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.md },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  badge: { backgroundColor: colors.violet, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 6 },
  badgeText: { color: '#FFFFFF', fontSize: typography.label, fontWeight: '800', letterSpacing: 0.5 },
  boostBtn: { padding: 2 },

  title: { color: colors.text, fontSize: 27, fontWeight: '800', lineHeight: 33, letterSpacing: -0.3 },

  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: radius.pill,
    paddingHorizontal: spacing.md, paddingVertical: 9,
  },
  pillText: { color: colors.text, fontSize: typography.label, fontWeight: '600', flexShrink: 1 },

  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: spacing.xs },

  previewWrap: { position: 'relative' },
  preview: { color: colors.textMuted, fontSize: typography.body, lineHeight: 25 },
  previewFade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 40 },

  // Reader overlay (opened post)
  fill: { flex: 1 },
  reader: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.bg },
  readerScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.bg },
  readerContent: { paddingBottom: 220 },
  readerHero: { width: '100%', aspectRatio: 1.6, backgroundColor: colors.bgElevated },
  readerBody: { padding: spacing.lg, gap: spacing.md },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  artist: { color: colors.accent, fontSize: typography.label, fontWeight: '700', flexShrink: 1 },
  category: { color: colors.text, fontSize: typography.caption, fontWeight: '700', letterSpacing: 0.5, opacity: 0.85 },
  time: { color: colors.textFaint, fontSize: typography.caption, marginLeft: 'auto' },
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
