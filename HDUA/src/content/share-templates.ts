/**
 * share-templates.ts
 *
 * Social-share copy + platform metadata for HDUA (HotDroppZ user app).
 *
 * Usage:
 *   import { SHARE_PLATFORMS, buildShareText, appendUtm } from '@/content/share-templates'
 *
 *   const platform = SHARE_PLATFORMS.find(p => p.key === 'x')!
 *   const url = appendUtm(post.sourceUrl ?? 'https://hotdroppz.eu', platform.key)
 *   const text = buildShareText(post, url, platform.key)
 *
 *   if (platform.shareUrl) {
 *     // open web intent: Linking.openURL(platform.shareUrl(text, url))
 *   } else {
 *     // no web intent (instagram/tiktok/copy/more) -> native share sheet / clipboard
 *   }
 *
 * Voice: short sentences, strong hooks, street credibility. Hype but real.
 * Hashtags are English + brand. Caption language follows the post.
 */

export interface SharePost {
  title: string
  artist: string | null
  category: string | null
  type: string // e.g. 'release' | 'article' | 'video' | 'event'
  sourceUrl: string | null
}

export interface SharePlatform {
  key: string
  label: string
  brandColor: string
  icon: string
  shareUrl?: (text: string, url: string) => string
}

export const SHARE_PLATFORMS: SharePlatform[] = [
  {
    key: 'instagram',
    label: 'Instagram',
    brandColor: '#E1306C',
    icon: 'logo-instagram'
  },
  {
    key: 'tiktok',
    label: 'TikTok',
    brandColor: '#010101',
    icon: 'logo-tiktok'
  },
  {
    key: 'x',
    label: 'X',
    brandColor: '#000000',
    icon: 'logo-twitter',
    shareUrl: (text, url) =>
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`
  },
  {
    key: 'facebook',
    label: 'Facebook',
    brandColor: '#1877F2',
    icon: 'logo-facebook',
    shareUrl: (_text, url) =>
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`
  },
  {
    key: 'whatsapp',
    label: 'WhatsApp',
    brandColor: '#25D366',
    icon: 'logo-whatsapp',
    shareUrl: (text, url) =>
      `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`
  },
  {
    key: 'threads',
    label: 'Threads',
    brandColor: '#000000',
    icon: 'logo-instagram',
    shareUrl: (text, url) =>
      `https://www.threads.net/intent/post?text=${encodeURIComponent(`${text} ${url}`)}`
  },
  {
    key: 'telegram',
    label: 'Telegram',
    brandColor: '#229ED9',
    icon: 'paper-plane',
    shareUrl: (text, url) =>
      `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`
  },
  {
    key: 'copy',
    label: 'Copy link',
    brandColor: '#6B7280',
    icon: 'copy'
  },
  {
    key: 'more',
    label: 'More',
    brandColor: '#9CA3AF',
    icon: 'ellipsis-horizontal'
  }
]

/**
 * Turn a free-text name into a clean CamelCase hashtag token.
 * "Central Cee" -> "CentralCee", "21 Savage" -> "21Savage", "A$AP Rocky" -> "ASAPRocky"
 */
const toTag = (value: string): string => {
  const cleaned = value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics for hashtag safety
    .replace(/[^a-zA-Z0-9 ]/g, ' ')
    .trim()
  if (cleaned.length === 0) return ''
  return cleaned
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('')
}

const TYPE_TAGS: Record<string, string> = {
  release: '#NewDrop',
  article: '#Story',
  video: '#Watch',
  event: '#Event'
}

export const buildHashtags = (post: SharePost): string[] => {
  const tags: string[] = ['#HotDroppZ']

  if (post.category) {
    const cat = toTag(post.category)
    if (cat) tags.push(`#${cat}`)
  }

  if (post.artist) {
    const artist = toTag(post.artist)
    if (artist) tags.push(`#${artist}`)
  }

  const typeTag = TYPE_TAGS[post.type]
  if (typeTag) tags.push(typeTag)

  // de-dup while keeping order
  return tags.filter((tag, i) => tags.indexOf(tag) === i)
}

/** "<Title> — <Artist>" or just the title when no artist. */
const headline = (post: SharePost): string =>
  post.artist ? `${post.title} — ${post.artist}` : post.title

/** Verb that fits the post type, used in short hooks. */
const typeHook = (type: string): string => {
  switch (type) {
    case 'release':
      return 'Just dropped'
    case 'video':
      return 'New clip out'
    case 'event':
      return 'Mark the date'
    case 'article':
      return 'Read this'
    default:
      return 'Fresh on HotDroppZ'
  }
}

/** Trim a string to a max length on a word boundary, adding an ellipsis. */
const clamp = (value: string, max: number): string => {
  if (value.length <= max) return value
  const slice = value.slice(0, max - 1)
  const lastSpace = slice.lastIndexOf(' ')
  return `${(lastSpace > max * 0.6 ? slice.slice(0, lastSpace) : slice).trimEnd()}…`
}

export const buildShareText = (
  post: SharePost,
  url: string,
  platform: string
): string => {
  const tags = buildHashtags(post)
  const head = headline(post)
  const hook = typeHook(post.type)

  switch (platform) {
    case 'x': {
      // X: keep whole thing (text + url) under ~270 chars.
      const tagLine = tags.join(' ')
      const reserved = url.length + tagLine.length + 4 // spaces + safety
      const budget = Math.max(40, 270 - reserved)
      const body = clamp(`${hook}: ${head}`, budget)
      return `${body}\n\n${tagLine}`
    }

    case 'instagram':
    case 'tiktok':
    case 'threads': {
      // Punchy caption. Line breaks. Hashtags last.
      const tagLine = tags.join(' ')
      return `${hook}.\n${head}\n\nFull story in HotDroppZ.\n\n${tagLine}`
    }

    case 'whatsapp':
    case 'telegram': {
      // Short hook + url (the platform/shareUrl appends url itself).
      return `${hook}: ${head} 🔥 ${tags.slice(0, 2).join(' ')}`
    }

    case 'facebook': {
      // FB sharer ignores text; keep a clean caption for manual paste.
      return `${hook}: ${head}\n\n${tags.join(' ')}`
    }

    case 'copy': {
      return `${hook}: ${head}\n${url}`
    }

    default: {
      // generic / 'more' native share sheet
      return `${hook}: ${head}\n${url}\n\n${tags.join(' ')}`
    }
  }
}

export const appendUtm = (url: string, platform: string): string => {
  const params = [
    'utm_source=hdua',
    'utm_medium=social',
    'utm_campaign=share',
    `utm_content=${encodeURIComponent(platform)}`
  ].join('&')

  const [base, hash = ''] = url.split('#')
  const separator = base.includes('?') ? '&' : '?'
  const withParams = `${base}${separator}${params}`
  return hash ? `${withParams}#${hash}` : withParams
}
