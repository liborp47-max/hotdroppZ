/**
 * DroppZ Detector — release detection + classification pipeline module.
 *
 * Single source of truth for:
 *  - rule-based release detection            → detectRelease()
 *  - AI hybrid confidence scoring            → scoreDropConfidence()
 *  - auto-publish decisioning for P0 drops   → decideAutoPublish()
 *  - drop notification fan-out (push/Discord/Telegram) → dispatchDropNotifications()
 *  - P0 detection accuracy metrics           → computeP0Accuracy()
 *
 * Logic was previously scattered across curator.ts fast-lane — centralized here.
 * The module intentionally has NO top-level framework imports so it can be
 * unit-tested in isolation (`node --experimental-strip-types`). AI + prompt
 * dependencies are lazily imported only when scoreDropConfidence calls a model.
 */

// ─── Public types ─────────────────────────────────────────────────────────────

export type ReleaseType = 'single' | 'album' | 'ep' | 'mixtape' | 'video' | null
export type DropPriority = 'P0' | 'P1' | 'P2' | 'P3'
export type ArtistTier = 'top100' | 'unknown'
export type AudienceSize = 'small' | 'mid' | 'large'
export type EditorRating = 'on_time' | 'late' | 'false_positive'

export interface DetectorItem {
  title: string
  content?: string | null
  category?: string | null
  source?: string | null
  publishedAt?: string | null
}

export interface ReleaseDetection {
  is_release: boolean
  release_type: ReleaseType
  priority: DropPriority
  is_droppz: boolean          // P0/P1 release → triggers curator fast-lane bypass
  artist: string | null
  artist_tier: ArtistTier
  matched_patterns: string[]
  rule_confidence: number     // 0..1, deterministic
}

// ─── Tunable thresholds ───────────────────────────────────────────────────────

export const AI_P0_THRESHOLD = 0.85        // SM2: AI confidence > 0.85 ⇒ P0
export const AUTO_PUBLISH_THRESHOLD = 0.9  // SM3: confidence > 0.9 ⇒ auto-publish
export const P0_ACCURACY_TARGET = 0.9      // SM5: editor-rated precision target
export const AI_CANDIDATE_LIMIT = 10       // SM2: Groq scores at most top 10

// ─── Shared keyword sets (re-used by curator.ts — centralization point) ───────

// Flat keyword list consumed by curator.ts tag building.
export const RELEASE_KEYWORDS = [
  'drop', 'drops', 'release', 'exclusive', 'first look',
  'new album', 'new single', 'new ep', 'out now', 'available now',
]

// Top-100 urban artists. Membership ⇒ artist_tier 'top100' (drives auto-publish).
export const TOP_ARTISTS = [
  // US Rap / Hip-Hop
  'drake', 'kendrick', 'kendrick lamar', 'future', 'travis scott',
  'playboi carti', 'nicki minaj', '21 savage', 'metro boomin', 'j. cole',
  'lil uzi', 'lil uzi vert', 'gunna', 'young thug', 'lil baby',
  'offset', 'quavo', 'takeoff', 'migos', 'cardi b',
  'asap rocky', 'a$ap rocky', 'tyler the creator', 'chance the rapper',
  'childish gambino', 'kanye', 'kanye west', 'ye', 'jay-z', 'jay z',
  'eminem', 'snoop dogg', 'ice spice', 'doechii', 'glorilla',
  'fivio foreign', 'pooh shiesty', 'roddy ricch', 'dababy', 'polo g',
  'sexyy red', 'peso pluma', 'bad gyal', 'central cee',
  // UK Rap / Drill
  'dave', 'stormzy', 'little simz', 'slowthai',
  'aitch', 'digga d', 'headie one', 'ghetts', 'skepta',
  'potter payper', 'nines', 'giggs', 'santan dave',
  // DE / AT / CH Rap (core EU market)
  'gzuz', 'capital bra', 'bushido', 'capo', 'shindy', 'sido',
  'kollegah', 'farid bang', 'ufo361', 'haiyti', 'loredana',
  'hamad', 'olexesh', 'haftbefehl', 'mero', 'badmomzjay',
  'luciano', 'apache 207', 'ali as', 'maxwell', 'ssio',
  'bonez mc', '187 strassenbande', 'plusmacher',
  // FR Rap
  'sch', 'nekfeu', 'booba', 'kaaris', 'damso', 'hamza',
  'ninho', 'jul', 'lorenzo', 'lacrim', 'sadek', 'maes',
  // Latin Trap / Reggaeton
  'bad bunny', 'j balvin', 'ozuna', 'anuel aa', 'myke towers',
  'rauw alejandro', 'jhay cortez', 'mora', 'sech',
  // Global / Afrobeats
  'rl grime', 'burna boy', 'wizkid', 'davido', 'asake',
  'rema', 'fireboy dml', 'omah lay',
]

// ─── Release detection patterns (multi-language: EN/CZ/DE/FR/ES/PL) ───────────

// Strong actions sufficient on their own to flag a release.
const STRONG_ACTION = /\bdrops?\b|\bout\s+now\b|\bavailable\s+now\b/i

// Release-object patterns, evaluated in precedence order.
const VIDEO_PATTERN = /\bofficial\s+(?:music\s+)?video\b|\bmusic\s+video\b|\bvisuali[sz]er\b|\blyric\s+video\b|\bvideoklip\b|\bteledysk\b|\bnouveau\s+clip\b|\bclip\s+(?:officiel|vid[eé]o)\b|\bvideo\s+oficial\b|\boffizielles\s+video\b/i
const ALBUM_PATTERN = /\bnew\s+album\b|\bdebut\s+album\b|\balbum\s+out\b|\bnov[eéáý]\s+album\b|\bneues\s+album\b|\bnouvel?\s+album\b|\bnuevo\s+[aá]lbum\b|\bnowy\s+album\b/i
const MIXTAPE_PATTERN = /\bmixtape\b|\bnew\s+tape\b/i
const EP_PATTERN = /\bnew\s+ep\b|\bsurprise\s+ep\b|\bep\s+out\b/i
const SINGLE_PATTERN = /\bnew\s+single\b|\bnew\s+track\b|\bnew\s+song\b|\bnov[yý]\s+singl\b|\bnouveau\s+single\b|\bnouvelle\s+chanson\b|\bneue\s+single\b|\bnuevo\s+sencillo\b|\bnowy\s+singiel\b/i

// Negative guard — listicles, reviews, gossip, drama. Vetoes is_release.
const NEGATIVE_GUARD = /\bbest\s+(?:of|\d+|albums|songs|tracks|new)\b|\btop\s+\d+\b|\branked?\b|\branking\b|\bgreatest\b|\breview(?:ed|s)?\b|\binterview\b|\broundup\b|\brecap\b|\bspotted\b|\breacts?\b|\bexplained\b|\bopinion\b|\bbreaks?\s+down\b|\bhistory\s+of\b|\bthrowback\b|\brevisit\w*\b|\bweekly\b|\bthis\s+week\b|\bcontroversy\b|\barrested\b|\blawsuit\b|\bdebate\b/i

const RAP_CATEGORIES = new Set(['usa_rap', 'uk_rap', 'eu_rap', 'ru_rap', 'balkan_rap'])

const PRIORITY_MAP: Record<string, DropPriority> = {
  droppz: 'P0', droppz_news: 'P0',
  usa_rap: 'P1', uk_rap: 'P1', eu_rap: 'P1', ru_rap: 'P1', balkan_rap: 'P1',
  rnb: 'P2', fashion: 'P2', fun: 'P2',
  culture: 'P3', news: 'P3', global_news: 'P3', science: 'P3',
}

// ─── SM1: detectRelease — deterministic, rule-based ──────────────────────────

/**
 * Classifies a scout item as a release / non-release and assigns priority.
 * Pure function — no I/O, no AI. Safe to call on every scouted item.
 */
export function detectRelease(item: DetectorItem): ReleaseDetection {
  const title = (item.title ?? '').toLowerCase()
  const body = (item.content ?? '').toLowerCase()
  const text = `${title} ${body}`.trim()
  const category = (item.category ?? '').toLowerCase()
  const matched: string[] = []

  const isDroppzCategory = category === 'droppz' || category === 'droppz_news'
  const hasNegativeGuard = NEGATIVE_GUARD.test(title)
  const hasStrongAction = STRONG_ACTION.test(text)

  // Release type — precedence: video > album > mixtape > ep > single.
  let release_type: ReleaseType = null
  if (VIDEO_PATTERN.test(text)) { release_type = 'video'; matched.push('video') }
  else if (ALBUM_PATTERN.test(text)) { release_type = 'album'; matched.push('album') }
  else if (MIXTAPE_PATTERN.test(text)) { release_type = 'mixtape'; matched.push('mixtape') }
  else if (EP_PATTERN.test(text)) { release_type = 'ep'; matched.push('ep') }
  else if (SINGLE_PATTERN.test(text)) { release_type = 'single'; matched.push('single') }

  // is_release decision. Negative guard always wins (except explicit Droppz feed).
  let is_release: boolean
  if (isDroppzCategory) {
    is_release = true
  } else if (hasNegativeGuard) {
    is_release = false
  } else if (release_type !== null || hasStrongAction) {
    is_release = true
    if (hasStrongAction) matched.push('strong-action')
  } else {
    is_release = false
  }

  // Artist tier — substring match against the top-100 list.
  let artist: string | null = null
  let artist_tier: ArtistTier = 'unknown'
  for (const candidate of TOP_ARTISTS) {
    if (text.includes(candidate)) { artist = candidate; artist_tier = 'top100'; break }
  }

  // Priority. A confirmed release in any rap category is promoted to droppz/P0.
  let priority: DropPriority = PRIORITY_MAP[category] ?? 'P3'
  if (is_release && (isDroppzCategory || RAP_CATEGORIES.has(category))) {
    priority = 'P0'
  } else if (is_release && artist_tier === 'top100' && (priority === 'P3' || priority === 'P2')) {
    priority = 'P1'
  }

  const is_droppz = is_release && (priority === 'P0' || priority === 'P1')

  // Deterministic rule confidence — strength of accumulated signals.
  let rule_confidence: number
  if (is_release) {
    let rc = 0.4
    if (release_type !== null) rc += 0.2
    if (matched.includes('strong-action')) rc += 0.15
    if (artist_tier === 'top100') rc += 0.2
    if (isDroppzCategory || RAP_CATEGORIES.has(category)) rc += 0.1
    rule_confidence = clamp01(round2(rc))
  } else {
    rule_confidence = hasNegativeGuard ? 0.05 : 0.15
  }

  return {
    is_release,
    release_type: is_release ? (release_type ?? 'single') : null,
    priority,
    is_droppz,
    artist,
    artist_tier,
    matched_patterns: matched,
    rule_confidence,
  }
}

// ─── SM2: scoreDropConfidence — AI hybrid scoring on top candidates ───────────

export interface DropCandidate {
  id: string
  title: string
  artist?: string | null
  category?: string | null
  source?: string | null
}

export interface DropConfidence {
  id: string
  confidence: number          // 0..1
  is_official: boolean
  audience_size: AudienceSize
  priority: DropPriority       // P0 if confidence > AI_P0_THRESHOLD else P1
  source: 'ai' | 'fallback'
}

// (userPrompt) => raw model text. The system prompt is bound inside the
// caller, so tests can inject a deterministic stub without importing the AI
// or prompts modules at all.
export type AiCaller = (userPrompt: string) => Promise<string>

/**
 * Scores up to AI_CANDIDATE_LIMIT candidates with one model call.
 * Falls back to deterministic rule confidence on any AI failure — never throws.
 */
export async function scoreDropConfidence(
  candidates: DropCandidate[],
  opts: { aiCall?: AiCaller; limit?: number } = {},
): Promise<DropConfidence[]> {
  const top = candidates.slice(0, opts.limit ?? AI_CANDIDATE_LIMIT)
  if (top.length === 0) return []

  const fallback = (): DropConfidence[] => top.map((c) => {
    const det = detectRelease({ title: c.title, category: c.category, source: c.source })
    const confidence = det.rule_confidence
    return {
      id: c.id,
      confidence,
      is_official: /\bofficial\b|\brecords\b|\blabel\b|\bvevo\b/i.test(`${c.title} ${c.source ?? ''}`),
      audience_size: det.artist_tier === 'top100' ? 'large' : 'mid',
      priority: confidence > AI_P0_THRESHOLD ? 'P0' : 'P1',
      source: 'fallback',
    }
  })

  try {
    const aiCall = opts.aiCall ?? (await loadDefaultAiCaller())
    const prompt = top
      .map((c, i) =>
        `[${i}] TITLE: ${c.title}\nARTIST: ${c.artist ?? 'unknown'}\nCATEGORY: ${c.category ?? 'unknown'}\nSOURCE: ${c.source ?? 'unknown'}`,
      )
      .join('\n\n')

    const raw = await aiCall(prompt)
    const parsed = parseJsonArray(raw)
    if (!parsed || parsed.length === 0) return fallback()

    return top.map((c, i) => {
      const row = parsed[i] ?? {}
      const confidence = clamp01(Number(row.confidence))
      return {
        id: c.id,
        confidence,
        is_official: Boolean(row.is_official),
        audience_size: normalizeAudience(row.audience_size),
        priority: confidence > AI_P0_THRESHOLD ? 'P0' : 'P1',
        source: 'ai' as const,
      }
    })
  } catch {
    return fallback()
  }
}

// ─── SM3: decideAutoPublish — publish vs draft decisioning ───────────────────

export interface AutoPublishDecision {
  action: 'publish' | 'draft'
  reason: string
}

/**
 * P0 drops by top-100 artists with AI confidence > 0.9 auto-publish.
 * Everything else is staged as a draft — the safe fallback.
 */
export function decideAutoPublish(
  detection: ReleaseDetection,
  score: DropConfidence,
): AutoPublishDecision {
  if (!detection.is_release || detection.priority !== 'P0') {
    return { action: 'draft', reason: 'not_p0_release' }
  }
  if (detection.artist_tier !== 'top100') {
    return { action: 'draft', reason: 'artist_not_top100' }
  }
  if (score.confidence > AUTO_PUBLISH_THRESHOLD) {
    return { action: 'publish', reason: `p0_top100_confidence_${score.confidence.toFixed(2)}` }
  }
  return { action: 'draft', reason: `confidence_below_${AUTO_PUBLISH_THRESHOLD}` }
}

// ─── SM4: notifications — push + Discord + Telegram fan-out ───────────────────

export interface DropNotification {
  artist: string
  title: string
  url: string
}

export interface NotifyResult {
  message: string
  discord: boolean
  telegram: boolean
  push: boolean
  errors: string[]
}

export interface NotifyOptions {
  fetchImpl?: typeof fetch
  env?: Record<string, string | undefined>
}

/** Canonical drop message template: "{artist} drops {title} — {url}". */
export function formatDropMessage(n: DropNotification): string {
  return `${n.artist} drops ${n.title} — ${n.url}`
}

/**
 * Fans a P0 drop out to mobile push + Discord + Telegram.
 * Each channel only fires when its env vars are configured; failures are
 * isolated per channel so one broken webhook never blocks the others.
 */
export async function dispatchDropNotifications(
  n: DropNotification,
  opts: NotifyOptions = {},
): Promise<NotifyResult> {
  const env = opts.env ?? process.env
  const doFetch = opts.fetchImpl ?? fetch
  const message = formatDropMessage(n)
  const result: NotifyResult = { message, discord: false, telegram: false, push: false, errors: [] }

  // Discord webhook
  const discordUrl = env.DISCORD_WEBHOOK_URL
  if (discordUrl) {
    try {
      const res = await doFetch(discordUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ content: message }),
      })
      result.discord = res.ok
      if (!res.ok) result.errors.push(`discord_http_${res.status}`)
    } catch (e) {
      result.errors.push(`discord:${errMsg(e)}`)
    }
  }

  // Telegram bot API
  const tgToken = env.TELEGRAM_BOT_TOKEN
  const tgChat = env.TELEGRAM_CHAT_ID
  if (tgToken && tgChat) {
    try {
      const res = await doFetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ chat_id: tgChat, text: message }),
      })
      result.telegram = res.ok
      if (!res.ok) result.errors.push(`telegram_http_${res.status}`)
    } catch (e) {
      result.errors.push(`telegram:${errMsg(e)}`)
    }
  }

  // Mobile push — provider-agnostic webhook consumed by the push gateway.
  const pushUrl = env.DROPPZ_PUSH_WEBHOOK_URL
  if (pushUrl) {
    try {
      const res = await doFetch(pushUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: `${n.artist} drops`, body: n.title, url: n.url, message }),
      })
      result.push = res.ok
      if (!res.ok) result.errors.push(`push_http_${res.status}`)
    } catch (e) {
      result.errors.push(`push:${errMsg(e)}`)
    }
  }

  return result
}

// ─── SM5: computeP0Accuracy — editor-rated precision / recall ─────────────────

export interface P0AccuracyReport {
  total: number
  true_positive: number
  false_positive: number
  on_time: number
  late: number
  precision: number
  recall: number
  on_time_rate: number
  meets_target: boolean
  recommendation: string
  recommended_threshold: number
}

/**
 * Aggregates editor verdicts on P0 detections into precision / recall.
 * When precision drops below the target the AI threshold is recommended up;
 * when recall drops (drops were missed) it is recommended down.
 */
export function computeP0Accuracy(
  ratings: EditorRating[],
  opts: { missedP0?: number; currentThreshold?: number } = {},
): P0AccuracyReport {
  const total = ratings.length
  const on_time = ratings.filter((r) => r === 'on_time').length
  const late = ratings.filter((r) => r === 'late').length
  const false_positive = ratings.filter((r) => r === 'false_positive').length
  const true_positive = on_time + late
  const missed = Math.max(0, opts.missedP0 ?? 0)
  const currentThreshold = opts.currentThreshold ?? AI_P0_THRESHOLD

  const precision = total > 0 ? round2(true_positive / total) : 0
  const recallDenom = true_positive + missed
  const recall = recallDenom > 0 ? round2(true_positive / recallDenom) : 0
  const on_time_rate = total > 0 ? round2(on_time / total) : 0
  const meets_target = total > 0 && precision >= P0_ACCURACY_TARGET

  let recommendation: string
  let recommended_threshold = currentThreshold
  if (total === 0) {
    recommendation = 'no_data'
  } else if (precision < P0_ACCURACY_TARGET) {
    // too many false positives — make the AI gate stricter
    recommended_threshold = round2(Math.min(0.98, currentThreshold + 0.05))
    recommendation = `raise_threshold_to_${recommended_threshold}`
  } else if (recall < P0_ACCURACY_TARGET) {
    // real drops missed — loosen the AI gate
    recommended_threshold = round2(Math.max(0.6, currentThreshold - 0.05))
    recommendation = `lower_threshold_to_${recommended_threshold}`
  } else {
    recommendation = 'keep_threshold'
  }

  return {
    total,
    true_positive,
    false_positive,
    on_time,
    late,
    precision,
    recall,
    on_time_rate,
    meets_target,
    recommendation,
    recommended_threshold,
  }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.min(1, Math.max(0, n))
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

function normalizeAudience(value: unknown): AudienceSize {
  return value === 'small' || value === 'large' ? value : 'mid'
}

function parseJsonArray(raw: string): Array<Record<string, unknown>> | null {
  try {
    const match = raw.match(/\[[\s\S]*\]/)
    if (!match) return null
    const parsed = JSON.parse(match[0])
    return Array.isArray(parsed) ? (parsed as Array<Record<string, unknown>>) : null
  } catch {
    return null
  }
}

// Lazy loader — keeps the module's top level free of framework imports so it
// stays unit-testable under `node --experimental-strip-types`. Only reached in
// the real runtime (a stubbed aiCall short-circuits it).
async function loadDefaultAiCaller(): Promise<AiCaller> {
  const [aiMod, promptMod] = await Promise.all([
    import('@/lib/ai/call'),
    import('./prompts'),
  ])
  return (user) =>
    aiMod.callAI('curator', promptMod.DROPPZ_DETECTOR_SYSTEM, user, {
      maxTokens: 1024,
      temperature: 0.1,
    })
}
