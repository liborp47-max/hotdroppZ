import { createAdminClient, createClient } from '@/lib/supabase/server'
import { logStageStart, logStageComplete } from '@/lib/analytics/collector'
import { TEST_MODE_CONFIG, type PipelineOptions } from '@/config/testMode'

// Pre-translation quality filter.
// Marks low-value SCOUTED items as 'discarded' BEFORE translation runs —
// prevents wasting Groq API calls on junk. Typical discard rate: 20-35%.

const BATCH_LIMIT = 500
const MAX_AGE_HOURS = 96
const MIN_TITLE_LENGTH = 15
const MIN_CONTENT_LENGTH = 30
const TITLE_FINGERPRINT_WINDOW = 500

const NEGATIVE_KEYWORDS = [
  'roundup', 'recap', 'weekly digest', 'monthly digest', 'listicle', 'sponsored',
  'advertorial', 'best of 2', 'top 10 ', 'top 5 ', 'top 25 ', 'newsletter',
  '[ad]', '[sponsored]', 'press release', 'this week in', 'chart roundup',
  'best songs of the week', 'playlist of the week',
]

// Hard-block: completely off-topic for a music/rap platform
const OFF_TOPIC_KEYWORDS = [
  'chess', 'veteran benefits', 'visual fingerprint',
  'invest', 'crypto', 'bitcoin', 'ethereum', 'nft ', 'stock market',
  'real estate', 'mortgage', 'loan offer', 'interest rate',
  'weight loss', 'diet pill', 'supplement', 'skin care', 'beauty tip',
  'coding tutorial', 'programming language', 'data science', 'machine learning',
  'free veterinarian', 'pet care', 'recipe', 'cooking tutorial', 'food blog',
  'sports betting', 'casino', 'gambling', 'poker',
  'soccer score', 'football score', 'nfl draft', 'nba draft pick', 'mlb', 'nhl score',
  'weather forecast', 'horoscope', 'astrology', 'tax return', 'tax filing',
  'insurance quote', 'car insurance', 'health insurance',
  'political election', 'voting guide', 'parliament', 'senate vote',
]

// Self-promotional amateur posts — not professional music news
const SELF_PROMO_PATTERNS = [
  'trying new sound', 'is this a unique', 'is this unique',
  'pre-save my', 'check out my', 'listen to my', 'my new single',
  'my new release', 'my new track', 'my new beat', 'my new album',
  'rate my', 'roast my', 'feedback on my', 'advice for my song',
  'what do you think of my', 'what yall think', "what y'all think",
  'please listen', 'stream my', 'support my music', 'buy my beat',
  'free beat download', 'type beat -', '[free]', 'ayyy ', 'ayy ',
  'it would mean a lot', 'could you give me advice',
]

// Music relevance terms — items without at least one are discarded
const MUSIC_RELEVANCE_TERMS = [
  // genres
  'rap', 'hip hop', 'hiphop', 'hip-hop', 'rnb', 'r&b', 'drill', 'trap',
  'grime', 'afrobeats', 'reggaeton', 'dancehall', 'afropop', 'urban',
  // formats
  'album', 'single', 'ep ', ' ep', 'lp ', 'mixtape', 'tracklist',
  'music video', 'official video', 'mv ', ' mv', 'visual', 'clip officiel',
  'official audio', 'lyric video', 'visualizer',
  // actions
  'release', 'drops', 'out now', 'available now', 'stream now', 'listen now',
  'new song', 'new track', 'new album', 'new single', 'debut album',
  // artists/industry
  'rapper', 'mc ', ' mc', 'producer', 'label', 'record deal', 'signed to',
  'spotify', 'apple music', 'soundcloud', 'tidal', 'deezer', 'youtube music',
  // charts/awards
  'billboard', 'chart', 'grammy', 'brit award', 'mtv vma', 'bet award',
  'gold', 'platinum', 'certified', 'number one', 'number 1', '#1',
  // events
  'tour', 'concert', 'festival', 'collab', 'feature', 'verse', 'remix',
  'freestyle', 'cypher', 'beef', 'diss track',
]

// Reddit sources that ARE music-relevant (whitelist — bypass the reddit discard rule)
const REDDIT_MUSIC_WHITELIST = [
  'r/hiphopheads', 'r/rap', 'r/trapmuzik', 'r/grime', 'r/ukdrill',
  'reddit hiphopheads', 'reddit rap', 'reddit trapmuzik',
]

// Source names that are Reddit-based gossip/meme and should be discarded unless music-relevant
const REDDIT_JUNK_SIGNALS = [
  'r/dankmemes', 'r/memes', 'r/casualuk', 'r/popculturechat',
  'reddit dankmemes', 'reddit memes', 'reddit casualuk', 'reddit popculture',
]

const ALLOWED_BYPASS_PRIORITIES = new Set(['P0', 'P1'])

type PipelineDbClient =
  | Awaited<ReturnType<typeof createClient>>
  | NonNullable<ReturnType<typeof createAdminClient>>

type ScoutedItem = {
  id: string
  title: string
  content: string | null
  raw_content: string | null
  published_at: string | null
  created_at: string
  priority: string | null
  is_release: boolean | null
  source: string | null
}

export interface FilterRunResult {
  processed: number
  kept: number
  discarded: number
  reasons: Record<string, number>
}

function titleFingerprint(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60)
}

function isOffTopic(title: string): boolean {
  const t = title.toLowerCase()
  return OFF_TOPIC_KEYWORDS.some((kw) => t.includes(kw))
}

function isSelfPromo(title: string): boolean {
  const t = title.toLowerCase()
  return SELF_PROMO_PATTERNS.some((p) => t.includes(p))
}

function isRedditJunk(source: string | null): boolean {
  if (!source) return false
  const s = source.toLowerCase()
  return REDDIT_JUNK_SIGNALS.some((sig) => s.includes(sig))
}

function isRedditMusicWhitelisted(source: string | null): boolean {
  if (!source) return false
  const s = source.toLowerCase()
  return REDDIT_MUSIC_WHITELIST.some((sig) => s.includes(sig))
}

function hasMusicRelevance(title: string, content: string | null): boolean {
  const combined = `${title} ${content ?? ''}`.toLowerCase()
  return MUSIC_RELEVANCE_TERMS.some((term) => combined.includes(term))
}

function isOlderThan(item: ScoutedItem, hours: number): boolean {
  const ref = Date.parse(item.published_at ?? item.created_at)
  if (Number.isNaN(ref)) return false
  return (Date.now() - ref) / (1000 * 60 * 60) > hours
}

function hasNegativeKeyword(title: string): boolean {
  const t = title.toLowerCase()
  return NEGATIVE_KEYWORDS.some((kw) => t.includes(kw))
}

// Detects scout_items stuck in SCOUTED status for more than 30 minutes.
// Called at the start of every filter run — exported so cron routes can also call it directly.
export async function detectStuckScouted(db: PipelineDbClient): Promise<number> {
  const STUCK_THRESHOLD_MS = 30 * 60 * 1000
  const cutoff = new Date(Date.now() - STUCK_THRESHOLD_MS).toISOString()

  const { data: stuck, error } = await db
    .from('scout_items')
    .select('id, title, source, created_at, category')
    .eq('status', 'SCOUTED')
    .lt('created_at', cutoff)
    .order('created_at', { ascending: true })
    .limit(50)

  if (error || !stuck?.length) return 0

  type StuckRow = { id: string; title: string; source: string; created_at: string; category: string }
  const rows = stuck as StuckRow[]
  const oldest = rows[0]
  const ageMin = Math.round((Date.now() - Date.parse(oldest.created_at)) / 60_000)

  console.warn(
    `HANDOFF STUCK: ${rows.length} item(s) in SCOUTED >${ageMin}min — filter/translator not running?`,
    rows.slice(0, 5).map((i) => ({
      id:      i.id,
      title:   i.title?.slice(0, 60),
      source:  i.source,
      age_min: Math.round((Date.now() - Date.parse(i.created_at)) / 60_000),
    }))
  )

  return stuck.length
}

export async function runFilterPipeline(db: PipelineDbClient, options: PipelineOptions = {}): Promise<FilterRunResult> {
  const batchLimit = options.testMode ? TEST_MODE_CONFIG.stage_batch_limit : BATCH_LIMIT
  const stageId = await logStageStart(db, 'filter', 'pipeline', { batch_limit: batchLimit, test_mode: Boolean(options.testMode) })
  const startTime = Date.now()

  try {
    const { data: items, error } = await db
      .from('scout_items')
      .select('id, title, content, raw_content, published_at, created_at, priority, is_release, source')
      .eq('status', 'SCOUTED')
      .order('priority', { ascending: true })
      .order('created_at', { ascending: false })
      .limit(batchLimit)

    if (error) throw new Error(error.message)

    // Detect items stuck before processing this batch
    void detectStuckScouted(db)

    if (!items?.length) {
      console.log('FILTER RUN: nothing to filter')
      await logStageComplete(db, stageId, { processed: 0, kept: 0, discarded: 0 }, { duration_ms: Date.now() - startTime })
      return { processed: 0, kept: 0, discarded: 0, reasons: {} }
    }

    console.log(`HANDOFF PICKUP: ${items.length} SCOUTED item(s) from Python pipeline entering filter`)

    const rows = items as ScoutedItem[]
    const reasons: Record<string, number> = {}
    const toDiscard: Array<{ id: string; reason: string }> = []
    const seenFingerprints = new Set<string>()

    // Load recent fingerprints to catch near-duplicates across batches
    try {
      const { data: recent } = await db
        .from('scout_items')
        .select('title')
        .not('status', 'eq', 'SCOUTED')
        .order('created_at', { ascending: false })
        .limit(TITLE_FINGERPRINT_WINDOW)

      for (const r of (recent ?? []) as { title: string }[]) {
        seenFingerprints.add(titleFingerprint(r.title))
      }
    } catch {
      // Non-fatal — skip duplicate check if query fails
    }

    for (const item of rows) {
      // P0/P1 releases always pass — never discard high-priority drops
      if (item.is_release && ALLOWED_BYPASS_PRIORITIES.has(item.priority ?? '')) {
        const fp = titleFingerprint(item.title)
        seenFingerprints.add(fp)
        continue
      }

      let discardReason: string | null = null

      // Discard known junk Reddit feeds (memes, casualuk, popculturechat)
      if (isRedditJunk(item.source)) {
        discardReason = 'reddit_junk'
      // Music-whitelisted Reddit (hiphopheads, rap, trapmuzik) must still be music-relevant
      } else if (isRedditMusicWhitelisted(item.source) && !hasMusicRelevance(item.title, item.content ?? item.raw_content)) {
        discardReason = 'reddit_not_music'
      } else if ((item.content ?? item.raw_content ?? '').length < MIN_CONTENT_LENGTH) {
        discardReason = 'content_too_short'
      } else if (hasNegativeKeyword(item.title)) {
        discardReason = 'negative_keyword'
      } else if (isOffTopic(item.title)) {
        discardReason = 'off_topic'
      } else if (isSelfPromo(item.title)) {
        discardReason = 'self_promo'
      } else if (!hasMusicRelevance(item.title, item.content ?? item.raw_content)) {
        discardReason = 'not_music_relevant'
      } else if (isOlderThan(item, MAX_AGE_HOURS)) {
        discardReason = 'too_old'
      } else {
        const fp = titleFingerprint(item.title)
        if (seenFingerprints.has(fp)) {
          discardReason = 'duplicate_title'
        } else {
          seenFingerprints.add(fp)
        }
      }

      if (discardReason) {
        toDiscard.push({ id: item.id, reason: discardReason })
        reasons[discardReason] = (reasons[discardReason] ?? 0) + 1
      }
    }

    if (toDiscard.length > 0) {
      for (const { id, reason } of toDiscard) {
        await db
          .from('scout_items')
          .update({ status: 'discarded', filter_reason: reason })
          .eq('id', id)
          .eq('status', 'SCOUTED')
      }
    }

    const kept = rows.length - toDiscard.length

    console.log(
      `FILTER RUN: ${rows.length} items — kept ${kept}, discarded ${toDiscard.length}`,
      reasons
    )

    await logStageComplete(db, stageId, { processed: rows.length, kept, discarded: toDiscard.length }, {
      duration_ms: Date.now() - startTime,
      metadata: { reasons },
    })

    return {
      processed: rows.length,
      kept,
      discarded: toDiscard.length,
      reasons,
    }
  } catch (err) {
    const duration = Date.now() - startTime
    await logStageComplete(db, stageId, {}, {
      duration_ms: duration,
      error_message: err instanceof Error ? err.message : String(err),
    })
    throw err
  }
}
