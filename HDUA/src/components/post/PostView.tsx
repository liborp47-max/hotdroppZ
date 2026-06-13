import { memo } from 'react'
import { Linking, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'

import { AudioPreview } from '@/components/media/AudioPreview'
import { useShareSheet } from '@/stores/shareSheet'
import { colors, radius, spacing, typography } from '@/styles/theme'
import { timeAgo } from '@/utils/text'
import type { FeedItem, Post, SourcePlatform } from '@/types'

const BLURHASH = 'L4A_=2~q00009F-;_3IU00of?bof'

const SOURCE_META: Record<SourcePlatform, { label: string; color: string; icon: keyof typeof Ionicons.glyphMap }> = {
  spotify: { label: 'Spotify', color: colors.spotify, icon: 'musical-notes' },
  apple_music: { label: 'Apple Music', color: colors.appleMusic, icon: 'musical-note' },
  youtube: { label: 'YouTube', color: colors.youtube, icon: 'logo-youtube' },
  genius: { label: 'Genius', color: '#FFD000', icon: 'document-text' },
  web: { label: 'Source', color: colors.textMuted, icon: 'open-outline' },
}

/**
 * Full post content block (HDUA-07). Used for the opened post AND for each
 * subsequent post in the continuous reader, so scrolling flows post → post.
 */
function PostViewBase({ post, audioUri }: { post: Post | FeedItem; audioUri?: string | null }) {
  const { width } = useWindowDimensions()
  const openShare = useShareSheet((s) => s.open)
  const sources = post.sources ?? []
  const body = 'body' in post && post.body ? post.body : post.content

  return (
    <View style={styles.root}>
      {post.coverImage ? (
        <Image
          source={{ uri: post.coverImage }}
          placeholder={BLURHASH}
          style={[styles.hero, { width, height: width * 0.62 }]}
          contentFit="cover"
          transition={250}
        />
      ) : null}

      <View style={styles.body}>
        <View style={styles.metaRow}>
          {post.artist ? <Text style={styles.artist} numberOfLines={1}>{post.artist}</Text> : null}
          <Text style={styles.dot}>·</Text>
          {post.category ? <Text style={styles.category}>{post.category.toUpperCase()}</Text> : null}
          <Text style={styles.time}>{timeAgo(post.publishedAt ?? post.createdAt)}</Text>
        </View>

        <Text style={styles.title}>{post.title}</Text>

        <View style={styles.actionRow}>
          <Pressable style={styles.shareBtn} onPress={() => openShare(post)}>
            <Ionicons name="share-social-outline" size={18} color={colors.bg} />
            <Text style={styles.shareText}>Sdílet</Text>
          </Pressable>
        </View>

        {audioUri ? <AudioPreview uri={audioUri} title={post.title} /> : null}

        {body ? <Text style={styles.content}>{body}</Text> : null}

        {sources.length > 0 ? (
          <View style={styles.sources}>
            {sources.map((s) => {
              const meta = SOURCE_META[s.platform]
              return (
                <Pressable
                  key={s.platform + s.url}
                  style={[styles.sourceBtn, { borderColor: meta.color }]}
                  onPress={() => Linking.openURL(s.url).catch(() => {})}
                >
                  <Ionicons name={meta.icon} size={16} color={meta.color} />
                  <Text style={[styles.sourceText, { color: meta.color }]}>{s.label ?? meta.label}</Text>
                  <Ionicons name="open-outline" size={13} color={meta.color} />
                </Pressable>
              )
            })}
          </View>
        ) : null}

        {post.sourceUrl ? (
          <Pressable style={styles.readSource} onPress={() => Linking.openURL(post.sourceUrl as string).catch(() => {})}>
            <Ionicons name="link-outline" size={14} color={colors.textMuted} />
            <Text style={styles.readSourceText} numberOfLines={1}>{post.source ?? 'Zdroj'}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  )
}

export const PostView = memo(PostViewBase)

const styles = StyleSheet.create({
  root: { backgroundColor: colors.bg, paddingBottom: spacing.xl },
  hero: { backgroundColor: colors.bgElevated },
  body: { padding: spacing.lg, gap: spacing.md },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  artist: { color: colors.accent, fontSize: typography.label, fontWeight: '700' },
  dot: { color: colors.textFaint },
  category: { color: colors.textFaint, fontSize: typography.caption, fontWeight: '700', letterSpacing: 0.5 },
  time: { color: colors.textFaint, fontSize: typography.caption, marginLeft: 'auto' },
  title: { color: colors.text, fontSize: typography.title, fontWeight: '800', lineHeight: 30 },
  actionRow: { flexDirection: 'row' },
  shareBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.accent, borderRadius: radius.pill, paddingHorizontal: spacing.lg, paddingVertical: 9 },
  shareText: { color: colors.bg, fontSize: typography.label, fontWeight: '700' },
  content: { color: colors.textMuted, fontSize: typography.body, lineHeight: 24 },
  sources: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  sourceBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 7,
  },
  sourceText: { fontSize: typography.label, fontWeight: '700' },
  readSource: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.xs },
  readSourceText: { color: colors.textMuted, fontSize: typography.label, flexShrink: 1 },
})
