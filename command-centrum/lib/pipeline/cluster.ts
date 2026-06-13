import { createAdminClient, createClient } from '@/lib/supabase/server'
import { logStageStart, logStageComplete } from '@/lib/analytics/collector'
import { TEST_MODE_CONFIG, type PipelineOptions } from '@/config/testMode'

const CLUSTER_BATCH_LIMIT = 500
const TIME_WINDOW_MS = 72 * 60 * 60 * 1000
const SIMILARITY_THRESHOLD = 0.22         // fix #1: was 0.10 — too loose, caused false merges
const RELEASE_SIMILARITY_THRESHOLD = 0.40 // fix #1: was 0.30 — releases must share strong entity overlap
const SNIPPET_MAX_LEN = 300

type PipelineDbClient =
  | Awaited<ReturnType<typeof createClient>>
  | NonNullable<ReturnType<typeof createAdminClient>>

type ClusterableItem = {
  id: string
  title: string
  title_en: string | null
  source: string
  url: string | null
  category: string | null
  content: string | null
  content_en: string | null
  raw_content: string | null
  english_master: string | null
  published_at: string | null
  created_at: string
  attention_score: number | null
}

type ItemWithEntities = ClusterableItem & { entities: string[] }

type ClusterGroup = {
  items: ItemWithEntities[]
  entities: string[]
  timestamp: string | null
}

export interface ClusterRunResult {
  processed: number
  created: number
  merged: number
  updated: number
}

type ExistingClusterRef = {
  cluster: {
    id: string
    title: string
    category: string | null
    merged_context: string[] | null
    max_attention_score: number | null
    source_count: number
    created_at: string
  }
  entities: string[]
  newItems: ItemWithEntities[]
}

// ─── Entity Normalization ────────────────────────────────────────────────────

const ENTITY_ALIASES: Record<string, string> = {
  // ── USA ──────────────────────────────────────────────────────────────────────
  'ye': 'kanye west',
  'yeezy': 'kanye west',
  'jay z': 'jay-z',
  'jayz': 'jay-z',
  'biggie': 'notorious b.i.g.',
  'notorious big': 'notorious b.i.g.',
  'lil uzi': 'lil uzi vert',
  'carti': 'playboi carti',
  'playboicarti': 'playboi carti',
  'drizzy': 'drake',
  'travis': 'travis scott',
  'future hendrix': 'future',
  // ── DE ───────────────────────────────────────────────────────────────────────
  'capibra': 'capital bra',
  'capi': 'capital bra',
  'capital bra': 'capital bra',
  'raf': 'raf camora',
  'raf camora': 'raf camora',
  'bonez': 'bonez mc',
  'bonez mc': 'bonez mc',
  'gzuz': 'gzuz',
  'nimo': 'nimo',
  'ufo361': 'ufo361',
  'ufo 361': 'ufo361',
  'luciano': 'luciano',
  'kool savas': 'kool savas',
  'savas': 'kool savas',
  'sido': 'sido',
  'bushido': 'bushido',
  'xatar': 'xatar',
  'haftbefehl': 'haftbefehl',
  // ── FR ───────────────────────────────────────────────────────────────────────
  'booba': 'booba',
  'kaaris': 'kaaris',
  'niro': 'niro',
  'pnl': 'pnl',
  'deux frères': 'pnl',
  'nekfeu': 'nekfeu',
  'damso': 'damso',
  'sch': 'sch',
  'niska': 'niska',
  'lacrim': 'lacrim',
  'freeze corleone': 'freeze corleone',
  'freeze': 'freeze corleone',
  'gazo': 'gazo',
  'tiakola': 'tiakola',
  'maes': 'maes',
  // ── UK ───────────────────────────────────────────────────────────────────────
  'central': 'central cee',
  'central cee': 'central cee',
  'dave': 'dave',
  'stormzy': 'stormzy',
  'little simz': 'little simz',
  'simz': 'little simz',
  'headie one': 'headie one',
  'headie': 'headie one',
  'giggs': 'giggs',
  'j hus': 'j hus',
  'aitch': 'aitch',
  'digga d': 'digga d',
  'digga': 'digga d',
  'Unknown T': 'unknown t',
  'unknown t': 'unknown t',
  'slowthai': 'slowthai',
  'ghetts': 'ghetts',
  // ── CZ / SK ──────────────────────────────────────────────────────────────────
  'yzomandias': 'yzomandias',
  'yzo': 'yzomandias',
  'vladis': 'vladis',
  'calin': 'calin',
  'ego': 'ego',
  'rytmus': 'rytmus',
  'pil c': 'pil c',
  'paulie garand': 'paulie garand',
  'lvcas dope': 'lvcas dope',
  // ── PL ───────────────────────────────────────────────────────────────────────
  'mata': 'mata',
  'taco hemingway': 'taco hemingway',
  'taco': 'taco hemingway',
  'young leosia': 'young leosia',
  'szpaku': 'szpaku',
  'ostr': 'o.s.t.r.',
  'o.s.t.r.': 'o.s.t.r.',
  // ── IT ───────────────────────────────────────────────────────────────────────
  'sfera': 'sfera ebbasta',
  'sfera ebbasta': 'sfera ebbasta',
  'capo plaza': 'capo plaza',
  'marracash': 'marracash',
  'gue pequeno': 'gue pequeno',
  'gué pequeno': 'gue pequeno',
  'tha supreme': 'tha supreme',
  'lazza': 'lazza',
  // ── ES ───────────────────────────────────────────────────────────────────────
  'morad': 'morad',
  'c. tangana': 'c. tangana',
  'bad gyal': 'bad gyal',
  'recycled j': 'recycled j',
  'quevedo': 'quevedo',
}

// fix #2: expanded — common words that masquerade as proper nouns in music/rap content
const STOP_WORDS = new Set([
  'The', 'This', 'That', 'With', 'From', 'When', 'After', 'Before', 'During',
  'About', 'Into', 'Over', 'Under', 'Upon', 'New', 'More', 'Just', 'Also',
  'First', 'Last', 'Next', 'Back', 'Even', 'Still', 'Here', 'There', 'Where',
  'What', 'Who', 'How', 'Why', 'Its', 'His', 'Her', 'Our', 'Their', 'Your',
  'Been', 'Being', 'Have', 'Has', 'Had', 'Did', 'Does', 'Will', 'Would',
  'Could', 'Should', 'May', 'Might', 'Must', 'Shall', 'Can', 'Says', 'Said',
  // fix #2 additions — genre/domain terms that produce false entity matches
  'Music', 'Video', 'Show', 'Song', 'Track', 'Album', 'Award', 'Tour', 'Live',
  'Official', 'Release', 'New', 'Big', 'Best', 'World', 'Year', 'Day', 'Week',
  'Time', 'News', 'Press', 'People', 'Man', 'Men', 'Woman', 'Women', 'Artist',
  'Rapper', 'Singer', 'Star', 'Fan', 'Fans', 'Label', 'Record', 'Stream',
  'Single', 'Debut', 'Return', 'Interview', 'Feature', 'Collab', 'Project',
  'Drop', 'Hit', 'Chart', 'Top', 'Out', 'Now', 'Check', 'Watch', 'Listen',
  'Read', 'Report', 'Says', 'Reveals', 'Shares', 'Drops', 'Releases',
  'Announces', 'Confirms',
])

// fix #7: multi-word noise phrases that survive proper-noun extraction
const NOISE_ENTITIES = new Set([
  'music video', 'official video', 'music news', 'new music', 'hip hop',
  'rap music', 'new album', 'new single', 'new song', 'music release',
  'breaking news', 'just in', 'out now', 'available now',
])

const ACRONYM_IGNORE = new Set([
  'RSS', 'USA', 'UK', 'NY', 'LA', 'DC', 'EU', 'UN', 'FBI', 'CIA',
  'NBA', 'NFL', 'CEO', 'COO', 'CFO', 'AI', 'IT', 'TV', 'DVD', 'CD',
  'EP', 'LP', 'DJ', 'PR', 'VIP', 'DM', 'AM', 'PM', 'EST', 'PST',
])

function normalizeEntity(raw: string): string {
  const clean = raw.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, ' ').trim()
  return ENTITY_ALIASES[clean] ?? clean
}

function extractEntities(text: string): string[] {
  const entities = new Set<string>()

  const properNouns = text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3}\b/g) ?? []
  for (const noun of properNouns) {
    const parts = noun.split(' ')
    if (parts.some((p) => STOP_WORDS.has(p))) continue
    if (noun.length < 3) continue
    const normalized = normalizeEntity(noun)
    // fix #7: skip known noise phrases
    if (NOISE_ENTITIES.has(normalized)) continue
    // fix #3: was `> 1` (allows 2-char), now `>= 4` — meaningful proper nouns are 4+ chars
    if (normalized.length >= 4) entities.add(normalized)
  }

  const acronyms = text.match(/\b[A-Z]{2,8}\b/g) ?? []
  for (const acronym of acronyms) {
    if (!ACRONYM_IGNORE.has(acronym)) entities.add(acronym.toLowerCase())
  }

  // fix #3: final filter matches the inline guard above (>= 4)
  return [...entities].filter((e) => e.length >= 4)
}

// ─── Clustering helpers ──────────────────────────────────────────────────────

function jaccardSimilarity(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0
  const setA = new Set(a)
  const intersection = b.filter((e) => setA.has(e)).length
  if (intersection === 0) return 0
  return intersection / new Set([...a, ...b]).size
}

// fix #4: was `if (!tsA || !tsB) return true` — undated items clustered with everything.
// Now: both null → allow (same-run, no date info); one null → deny (unknown age vs dated).
function withinTimeWindow(tsA: string | null, tsB: string | null): boolean {
  if (!tsA && !tsB) return true   // both undated — same-run, allow
  if (!tsA || !tsB) return false  // one dated, one not — don't force-cluster
  return Math.abs(Date.parse(tsA) - Date.parse(tsB)) <= TIME_WINDOW_MS
}

function resolveEnText(item: ClusterableItem): string {
  return (item.content_en ?? item.english_master ?? item.content ?? item.raw_content ?? item.title)
    .replace(/\s+/g, ' ')
    .trim()
}

function buildMergedContext(items: ClusterableItem[], maxItems = 10): string[] {
  const sentences: string[] = []
  for (const item of items) {
    const text = resolveEnText(item)
    const chunks = text
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 20 && s.length < 300)
      .slice(0, 3)
    sentences.push(...chunks)
  }

  const unique: string[] = []
  for (const sentence of sentences) {
    const norm = sentence.toLowerCase().replace(/\s+/g, ' ')
    const dupe = unique.some((u) => {
      const uNorm = u.toLowerCase().replace(/\s+/g, ' ')
      return uNorm.includes(norm.slice(0, 60)) || norm.includes(uNorm.slice(0, 60))
    })
    if (!dupe) unique.push(sentence)
  }

  return unique.slice(0, maxItems)
}

// CONTENT-QUALITY FIX (2026-06-12): the old fallback `items[0].title.split(' ').slice(0,3)`
// fabricated junk entities ("Latest Release!!", "rock bands doing", "die musikszene")
// which then surfaced as the feed's artist label. Now we return '' when no
// meaningful proper-noun entity is found, and the caller resolves a real artist
// against the artist DB (matchKnownArtist) before falling back to null.
function pickMainEntity(items: ClusterableItem[]): string {
  const freq: Record<string, number> = {}
  for (const item of items) {
    const text = `${item.title_en ?? item.title} ${resolveEnText(item)}`
    for (const entity of extractEntities(text)) {
      if (entity.length > 3 && entity !== (item.category ?? 'culture')) {
        freq[entity] = (freq[entity] ?? 0) + 1
      }
    }
  }
  const top = Object.entries(freq).sort((a, b) => b[1] - a[1])[0]
  return top?.[0] ?? ''
}

export interface KnownArtist {
  id: string
  name: string
}

/**
 * Finds the most specific known artist mentioned in `text` (CONTENT-QUALITY FIX
 * 2026-06-12). Word-boundary match, length-gated to ≥ 4 chars to avoid common-word
 * false positives ("ego", "dame"), preferring the longest matching name when
 * several artists appear. Returns null when no real artist is recognized — the
 * caller then leaves artist_name NULL rather than inventing a label.
 */
export function matchKnownArtist(text: string, known: KnownArtist[]): KnownArtist | null {
  const hay = text.toLowerCase()
  let best: KnownArtist | null = null
  for (const a of known) {
    const name = a.name.toLowerCase().trim()
    if (name.length < 4) continue
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    if (new RegExp(`\\b${escaped}\\b`, 'i').test(hay)) {
      if (!best || name.length > best.name.length) best = a
    }
  }
  return best
}

function computeConfidence(sourceCount: number, sharedRatio: number): number {
  return Math.min(1.0, 0.2 + Math.min(0.6, (sourceCount - 1) * 0.2) + sharedRatio * 0.4)
}

// ─── Main export ─────────────────────────────────────────────────────────────

export async function runClusterPipeline(db: PipelineDbClient, options: PipelineOptions = {}): Promise<ClusterRunResult> {
  const batchLimit = options.testMode ? TEST_MODE_CONFIG.stage_batch_limit : CLUSTER_BATCH_LIMIT
  const mergedContextLimit = options.testMode ? TEST_MODE_CONFIG.writer_context_items : 10
  const stageId = await logStageStart(db, 'cluster', 'pipeline', { batch_limit: batchLimit, time_window_hours: 72, test_mode: Boolean(options.testMode) })
  const startTime = Date.now()

  try {
    const { data: items, error } = await db
      .from('scout_items')
      .select(
        'id, title, title_en, source, url, category, content, content_en, raw_content, english_master, published_at, created_at, attention_score'
      )
      .eq('status', 'CURATED')
      .order('attention_score', { ascending: false })
      .limit(batchLimit)

    if (error) throw new Error(error.message)

   if (!items?.length) {
     console.log('CLUSTER RUN: nothing to cluster')
     await logStageComplete(db, stageId, { processed: 0, created: 0, merged: 0, updated: 0 }, { duration_ms: Date.now() - startTime })
     return { processed: 0, created: 0, merged: 0, updated: 0 }
   }

    const curatedItems = items as ClusterableItem[]

    // CONTENT-QUALITY FIX (2026-06-12): load the known-artist registry once so each
    // cluster can resolve a REAL artist label from its text (matchKnownArtist),
    // instead of leaving artist_name NULL until enrichment (which needs API keys).
    const { data: artistRows } = await db
      .from('artists')
      .select('id, name')
      .not('name', 'is', null)
    const knownArtists: KnownArtist[] = (artistRows ?? [])
      .map((a) => ({ id: a.id as string, name: a.name as string }))
      .filter((a) => Boolean(a.name))

    // Fetch existing pending clusters within the time window for cross-run dedup
    const existingWindowTs = new Date(Date.now() - TIME_WINDOW_MS).toISOString()
    const { data: existingRaw } = await db
      .from('story_clusters')
      .select('id, title, category, merged_context, max_attention_score, source_count, created_at')
      .eq('status', 'pending')
      .gte('created_at', existingWindowTs)
      .order('created_at', { ascending: false })
      .limit(options.testMode ? 20 : 200)

    const existingClusters: ExistingClusterRef[] = (existingRaw ?? []).map((c) => ({
      cluster: c as ExistingClusterRef['cluster'],
      entities: extractEntities(
        `${c.title} ${Array.isArray(c.merged_context) ? (c.merged_context as string[]).join(' ') : ''}`
      ),
      newItems: [],
    }))

    const withEntities: ItemWithEntities[] = curatedItems.map((item) => ({
      ...item,
      entities: extractEntities(
        `${item.title_en ?? item.title} ${resolveEnText(item)}`
      ),
    }))

    // Greedy clustering — highest-scored items seed new clusters
    const groups: ClusterGroup[] = []
    let mergedCount = 0

  for (const item of withEntities) {
    const itemIsRelease = item.category === 'droppz'
    let bestGroup: ClusterGroup | null = null
    let bestExisting: ExistingClusterRef | null = null
    let bestScore = -1

    for (const group of groups) {
      if (!withinTimeWindow(item.published_at ?? item.created_at, group.timestamp)) continue

      const groupIsRelease = group.items[0].category === 'droppz'

      // droppz_news (releases) requires stricter entity overlap on either side —
      // spec rule: droppz_releases only merge when same entity/event
      const threshold =
        itemIsRelease || groupIsRelease ? RELEASE_SIMILARITY_THRESHOLD : SIMILARITY_THRESHOLD

      const sim = jaccardSimilarity(item.entities, group.entities)

      // fix #5: require minimum shared entity count in addition to Jaccard threshold.
      // Small entity sets (< 5 total) need 1 shared; larger sets need 2.
      const itemSet = new Set(item.entities)
      const sharedCount = group.entities.filter((e) => itemSet.has(e)).length
      const minShared = group.entities.length >= 5 ? 2 : 1

      if (sim < threshold || sharedCount < minShared) continue
      if (sim > bestScore) {
        bestScore = sim
        bestGroup = group
        bestExisting = null
      }
    }

    // Cross-run dedup: check existing pending clusters from prior runs
    for (const ec of existingClusters) {
      if (!withinTimeWindow(item.published_at ?? item.created_at, ec.cluster.created_at)) continue
      const ecIsRelease = ec.cluster.category === 'droppz'
      const threshold =
        itemIsRelease || ecIsRelease ? RELEASE_SIMILARITY_THRESHOLD : SIMILARITY_THRESHOLD

      const sim = jaccardSimilarity(item.entities, ec.entities)

      // fix #5: same shared-entity guard for cross-run dedup
      const itemSet = new Set(item.entities)
      const sharedCount = ec.entities.filter((e) => itemSet.has(e)).length
      const minShared = ec.entities.length >= 5 ? 2 : 1

      if (sim < threshold || sharedCount < minShared) continue
      if (sim > bestScore) {
        bestScore = sim
        bestGroup = null
        bestExisting = ec
      }
    }

    if (bestGroup) {
      bestGroup.items.push(item)
      bestGroup.entities = [...new Set([...bestGroup.entities, ...item.entities])]
      mergedCount++
    } else if (bestExisting) {
      bestExisting.newItems.push(item)
      bestExisting.entities = [...new Set([...bestExisting.entities, ...item.entities])]
      mergedCount++
    } else {
      groups.push({
        items: [item],
        entities: item.entities,
        timestamp: item.published_at ?? item.created_at,
      })
    }
  }

  // fix #6: drop single-item groups whose sole article has a very low attention score —
  // these are noise items that don't warrant a cluster or article.
  let droppedNoise = 0
  const filteredGroups = groups.filter((group) => {
    if (
      group.items.length === 1 &&
      group.items[0].attention_score !== null &&
      group.items[0].attention_score < 3
    ) {
      droppedNoise++
      return false
    }
    return true
  })

  // Build cluster insert payloads
  const clusterInserts = filteredGroups.map((group) => {
    const primary = group.items[0]
    const sharedRatio =
      group.items.length > 1
        ? jaccardSimilarity(
            group.items[0].entities,
            group.items.slice(1).flatMap((i) => i.entities)
          )
        : 0

    // Resolve a real artist from the cluster's combined title + context. When one
    // is found it becomes both the artist label and the canonical main_entity;
    // otherwise main_entity falls back to the best proper-noun (or '' → null).
    const clusterText = group.items
      .map((i) => `${i.title_en ?? i.title} ${resolveEnText(i)}`)
      .join(' ')
    const matchedArtist = matchKnownArtist(clusterText, knownArtists)
    // main_entity is NOT NULL (internal grouping key). Prefer a real artist, then
    // the best proper-noun; fall back to category (never a junk title fragment).
    // The user-facing label is artist_name, which stays NULL when unknown.
    const entity = matchedArtist?.name || pickMainEntity(group.items) || (primary.category ?? 'unknown')

    return {
      main_entity: entity,
      artist_name: matchedArtist?.name ?? null,
      artist_id: matchedArtist?.id ?? null,
      category: primary.category ?? 'culture',
      title: primary.title_en ?? primary.title,
      confidence: computeConfidence(group.items.length, sharedRatio),
      merged_context: buildMergedContext(group.items, mergedContextLimit),
      status: 'pending',
      primary_scout_item_id: primary.id,
      max_attention_score: Math.max(...group.items.map((i) => i.attention_score ?? 0)),
      source_count: group.items.length,
    }
  })

  const { data: inserted, error: clusterError } = await db
    .from('story_clusters')
    .insert(clusterInserts)
    .select('id, primary_scout_item_id')

  if (clusterError) throw new Error(clusterError.message)

  const clusterIdByPrimary = new Map(
    (inserted ?? []).map((c) => [c.primary_scout_item_id as string, c.id as string])
  )

  // Build source link payloads
  const sourceInserts = filteredGroups.flatMap((group) => {
    const clusterId = clusterIdByPrimary.get(group.items[0].id)
    if (!clusterId) return []
    return group.items.map((item) => {
      const raw = (item.english_master ?? item.content ?? item.raw_content ?? '')
        .replace(/\s+/g, ' ')
        .trim()
      return {
        cluster_id: clusterId,
        scout_item_id: item.id,
        source_name: item.source,
        url: item.url,
        text_snippet: raw.slice(0, SNIPPET_MAX_LEN) || null,
      }
    })
  })

  if (sourceInserts.length > 0) {
    const { error: srcErr } = await db.from('story_cluster_sources').insert(sourceInserts)
    if (srcErr) console.warn('CLUSTER RUN: source insert failed', srcErr.message)
  }

  const allIds = curatedItems.map((i) => i.id)
  const { error: updateErr } = await db
    .from('scout_items')
    .update({ status: 'CLUSTERED' })
    .in('id', allIds)
    // AUD-PIPE-001: only flip items still CURATED — guards against a concurrent
    // run re-clustering items already advanced (double-processing rule).
    .eq('status', 'CURATED')

  if (updateErr) console.warn('CLUSTER RUN: status update failed', updateErr.message)

  // Cross-run merge: update existing clusters that absorbed items from this run
  let updatedCount = 0
  const existingWithNewItems = existingClusters.filter((ec) => ec.newItems.length > 0)
  for (const ec of existingWithNewItems) {
    const newMaxScore = Math.max(
      ec.cluster.max_attention_score ?? 0,
      ...ec.newItems.map((i) => i.attention_score ?? 0)
    )
    const { error: ecUpdateErr } = await db
      .from('story_clusters')
      .update({
        source_count: ec.cluster.source_count + ec.newItems.length,
        max_attention_score: newMaxScore,
      })
      .eq('id', ec.cluster.id)

    if (ecUpdateErr) {
      console.warn('CLUSTER RUN: existing cluster update failed', ecUpdateErr.message)
      continue
    }

    const mergedSources = ec.newItems.map((item) => {
      const raw = (item.english_master ?? item.content ?? item.raw_content ?? '')
        .replace(/\s+/g, ' ')
        .trim()
      return {
        cluster_id: ec.cluster.id,
        scout_item_id: item.id,
        source_name: item.source,
        url: item.url,
        text_snippet: raw.slice(0, SNIPPET_MAX_LEN) || null,
      }
    })
    const { error: mergedSrcErr } = await db.from('story_cluster_sources').insert(mergedSources)
    if (mergedSrcErr) {
      console.warn('CLUSTER RUN: cross-run source insert failed', mergedSrcErr.message)
    } else {
      updatedCount++
    }
  }

   console.log(
     `CLUSTER COMPLETE: ${curatedItems.length} items → ${filteredGroups.length} new clusters` +
     ` (${droppedNoise} noise-dropped), ${updatedCount} existing updated (${mergedCount} merged)` +
     ` — clusters ready for enrichment`
   )

   await logStageComplete(db, stageId, {
     processed: curatedItems.length,
     created: filteredGroups.length,
     merged: mergedCount,
     updated: updatedCount,
   }, {
     duration_ms: Date.now() - startTime,
     metadata: { noise_dropped: droppedNoise, avg_cluster_size: curatedItems.length / Math.max(filteredGroups.length, 1) },
   })

    return { processed: curatedItems.length, created: filteredGroups.length, merged: mergedCount, updated: updatedCount }
  } catch (err) {
    const duration = Date.now() - startTime
    await logStageComplete(db, stageId, {}, {
      duration_ms: duration,
      error_message: err instanceof Error ? err.message : String(err),
    })
    throw err
  }
}
