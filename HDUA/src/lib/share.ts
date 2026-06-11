import { Linking, Platform, Share } from 'react-native'

import { SHARE_PLATFORMS, appendUtm, buildShareText, type SharePost } from '@/content/share-templates'
import type { FeedItem } from '@/types'

/** Public share link for a post (falls back to a hotdroppz deep link). */
export function shareUrlFor(item: FeedItem): string {
  return item.sourceUrl ?? `https://hotdroppz.eu/p/${item.id}`
}

function toSharePost(item: FeedItem): SharePost {
  return {
    title: item.title,
    artist: item.artist,
    category: item.category,
    type: item.type,
    sourceUrl: item.sourceUrl,
  }
}

async function copyText(text: string): Promise<void> {
  if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
    await navigator.clipboard.writeText(text)
    return
  }
  await Share.share({ message: text })
}

/**
 * Share a post to a specific platform. Platforms with a web intent open it via
 * Linking; instagram/tiktok/more fall back to the OS share sheet; copy writes
 * to the clipboard. Returns a short status used for toast feedback.
 */
export async function shareTo(item: FeedItem, platformKey: string): Promise<'opened' | 'copied' | 'shared'> {
  const post = toSharePost(item)
  const url = appendUtm(shareUrlFor(item), platformKey)
  const text = buildShareText(post, url, platformKey)
  const platform = SHARE_PLATFORMS.find((p) => p.key === platformKey)

  if (platformKey === 'copy') {
    await copyText(`${text}`)
    return 'copied'
  }

  if (platform?.shareUrl) {
    const intent = platform.shareUrl(text, url)
    await Linking.openURL(intent)
    return 'opened'
  }

  // instagram / tiktok / more / generic → native share sheet
  await Share.share(Platform.OS === 'ios' ? { message: text, url } : { message: `${text}\n${url}` })
  return 'shared'
}
