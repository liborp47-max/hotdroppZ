import { memo, useEffect, useRef, useState } from 'react'
import { Linking, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import Animated, { FadeInDown, FadeOutUp, LinearTransition } from 'react-native-reanimated'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'

import { AudioPreview } from '@/components/media/AudioPreview'
import { EmbedPlayer } from '@/components/media/Embed'
import { trackView } from '@/lib/analytics'
import { pickEmbed } from '@/lib/embeds'
import { useFeedExpand } from '@/stores/feedExpand'
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

function Action({
  icon, label, active, accent, onPress,
}: { icon: keyof typeof Ionicons.glyphMap; label?: string; active?: boolean; accent?: boolean; onPress?: () => void }) {
  const tint = active || accent ? colors.accent : colors.text
  return (
    <Pressable style={styles.action} onPress={onPress} hitSlop={10}>
      <Ionicons name={icon} size={22} color={tint} />
      {label ? <Text style={[styles.actionLabel, { color: tint }]}>{label}</Text> : null}
    </Pressable>
  )
}

/**
 * Full-bleed feed post that unrolls inline (accordion). Collapsed = hero + title.
 * Tap → the full article rolls open downward (Reanimated); tapping again or another
 * post collapses it. No navigation — the next post stays collapsed below.
 */
function FeedCardBase({ item }: { item: FeedItem }) {
  const { height } = useWindowDimensions()
  const expanded = useFeedExpand((s) => s.expandedId === item.id)
  const toggle = useFeedExpand((s) => s.toggle)
  const openShare = useShareSheet((s) => s.open)
  const [liked, setLiked] = useState(false)

  const badge = TYPE_BADGE[item.type]
  const playable = item.type === 'release' || item.type === 'video' || item.type === 'playlist'
  const sig = item.signals
  const sources = item.sources ?? []
  const embed = pickEmbed(item)
  const heroH = Math.min(Math.max(height * 0.5, 320), 560)

  // Record dwell time while the article is expanded (engagement signal, HDUA-09).
  const expandStart = useRef<number | null>(null)
  useEffect(() => {
    if (expanded) {
      expandStart.current = Date.now()
    } else if (expandStart.current) {
      trackView(item.id, { dwellMs: Date.now() - expandStart.current })
      expandStart.current = null
    }
    return () => {
      if (expandStart.current) {
        trackView(item.id, { dwellMs: Date.now() - expandStart.current })
        expandStart.current = null
      }
    }
  }, [expanded, item.id])

  const onToggle = () => {
    toggle(item.id)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
  }
  const toggleLike = () => {
    setLiked((v) => !v)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
  }

  return (
    <Animated.View style={styles.post} layout={LinearTransition.duration(240)}>
      <Pressable onPress={onToggle}>
        <View style={[styles.hero, { height: heroH }]}>
          {item.coverImage ? (
            <Image source={{ uri: item.coverImage }} placeholder={BLURHASH} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
          ) : (
            <View style={[StyleSheet.absoluteFill, styles.fallback]}><Ionicons name="flame" size={44} color={colors.accentDim} /></View>
          )}
          <View style={styles.scrimTop} />
          <View style={styles.scrimBottom} />
          {badge ? <View style={styles.badge}><Text style={styles.badgeText}>{badge}</Text></View> : null}
          <Text style={styles.time}>{timeAgo(item.publishedAt ?? item.createdAt)}</Text>
          {playable ? <View style={styles.play}><Ionicons name="play" size={26} color={colors.bg} /></View> : null}
          <View style={styles.overlay}>
            <View style={styles.metaRow}>
              {item.artist ? <Text style={styles.artist} numberOfLines={1}>{item.artist}</Text> : null}
              {item.category ? <Text style={styles.category}>{item.category.toUpperCase()}</Text> : null}
            </View>
            <Text style={styles.title} numberOfLines={expanded ? undefined : 3}>{item.title}</Text>
            {(item.tags ?? []).length > 0 ? (
              <View style={styles.tags}>{(item.tags ?? []).slice(0, 4).map((t) => <Text key={t} style={styles.tag}>#{t}</Text>)}</View>
            ) : null}
          </View>
        </View>
      </Pressable>

      <View style={styles.strip}>
        {!expanded && item.content ? <Text style={styles.preview} numberOfLines={2}>{item.content}</Text> : null}

        {/* Unrolled article body */}
        {expanded ? (
          <Animated.View entering={FadeInDown.duration(260)} exiting={FadeOutUp.duration(160)} style={styles.bodyWrap}>
            {item.content ? <Text style={styles.body}>{item.content}</Text> : null}
            {embed ? <EmbedPlayer embed={embed} /> : null}
            {sources.length > 0 ? (
              <View style={styles.sourceBtns}>
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
          </Animated.View>
        ) : null}

        {sig && (sig.trendDeltaPct != null || sig.trendingRank != null || sig.listeningNow != null) ? (
          <View style={styles.signals}>
            {sig.trendDeltaPct != null ? <View style={styles.signal}><Ionicons name="flame-outline" size={14} color={colors.accent} /><Text style={styles.signalStrong}>+{sig.trendDeltaPct}%</Text><Text style={styles.signalSub}>24h</Text></View> : null}
            {sig.trendingRank != null ? <View style={styles.signal}><Ionicons name="trending-up" size={14} color={colors.text} /><Text style={styles.signalStrong}>#{sig.trendingRank}</Text><Text style={styles.signalSub}>trending</Text></View> : null}
            {sig.listeningNow != null ? <View style={styles.signal}><Ionicons name="people-outline" size={14} color={colors.text} /><Text style={styles.signalStrong}>{compact(sig.listeningNow)}</Text><Text style={styles.signalSub}>now</Text></View> : null}
          </View>
        ) : null}

        <View style={styles.actions}>
          <Action icon={liked ? 'heart' : 'heart-outline'} label={compact((sig?.likes ?? 0) + (liked ? 1 : 0))} active={liked} onPress={toggleLike} />
          <Action icon="chatbubble-outline" label={compact(sig?.comments ?? 0)} onPress={onToggle} />
          <Action icon="share-social-outline" label="Sdílet" onPress={() => openShare(item)} />
          <Action icon="flame" label="Boost" accent onPress={() => {}} />
        </View>

        {/* expand / collapse hint */}
        <Pressable style={styles.expandHint} onPress={onToggle} hitSlop={8}>
          <Text style={styles.expandText}>{expanded ? 'Sbalit' : 'Číst víc'}</Text>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={colors.accent} />
        </Pressable>
      </View>

      <View style={styles.divider} />
    </Animated.View>
  )
}

export const FeedCard = memo(FeedCardBase)

const styles = StyleSheet.create({
  post: { backgroundColor: colors.bg },
  hero: { width: '100%', backgroundColor: colors.bgElevated, justifyContent: 'flex-end' },
  fallback: { alignItems: 'center', justifyContent: 'center' },
  scrimTop: { position: 'absolute', top: 0, left: 0, right: 0, height: 90, backgroundColor: 'rgba(10,10,11,0.35)' },
  scrimBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '60%', backgroundColor: 'rgba(10,10,11,0.72)' },
  badge: { position: 'absolute', top: spacing.lg, left: spacing.lg, backgroundColor: colors.accent, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  badgeText: { color: colors.bg, fontSize: typography.caption, fontWeight: '800', letterSpacing: 0.5 },
  time: { position: 'absolute', top: spacing.lg, right: spacing.lg, color: colors.text, fontSize: typography.caption, fontWeight: '600', backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 7, paddingVertical: 3, borderRadius: radius.sm, overflow: 'hidden' },
  play: { position: 'absolute', top: '42%', alignSelf: 'center', width: 54, height: 54, borderRadius: 27, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  overlay: { padding: spacing.lg, gap: spacing.sm },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  artist: { color: colors.accent, fontSize: typography.label, fontWeight: '700', flexShrink: 1 },
  category: { color: colors.text, fontSize: typography.caption, fontWeight: '700', letterSpacing: 0.5, opacity: 0.85 },
  title: { color: colors.text, fontSize: typography.title, fontWeight: '800', lineHeight: 28 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tag: { color: colors.accent, fontSize: typography.label, fontWeight: '600' },
  strip: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.md },
  preview: { color: colors.textMuted, fontSize: typography.label, lineHeight: 20 },
  bodyWrap: { gap: spacing.md },
  body: { color: colors.textMuted, fontSize: typography.body, lineHeight: 24 },
  sourceBtns: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  sourceBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 7 },
  sourceText: { fontSize: typography.label, fontWeight: '700' },
  readSource: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  readSourceText: { color: colors.textMuted, fontSize: typography.label, flexShrink: 1 },
  signals: { flexDirection: 'row', gap: spacing.xl },
  signal: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  signalStrong: { color: colors.text, fontSize: typography.label, fontWeight: '700' },
  signalSub: { color: colors.textFaint, fontSize: typography.caption },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.xs },
  action: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actionLabel: { fontSize: typography.label, fontWeight: '600' },
  expandHint: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: spacing.xs },
  expandText: { color: colors.accent, fontSize: typography.label, fontWeight: '700' },
  divider: { height: 8, backgroundColor: colors.bgElevated, marginTop: spacing.lg },
})
