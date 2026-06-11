/**
 * Content-Type Detector (Minimal AI)
 * Rule-based detection — NO LLM calls
 * Determines which Factory modules to activate based on cluster metadata
 */

export type ContentType = 'music_release' | 'artist_news' | 'cultural' | 'visual_first' | 'general'
export type ModuleSequence = ('writer' | 'enrichment' | 'creator')[]

export interface ContentAnalysis {
  contentType: ContentType
  moduleSequence: ModuleSequence
  confidence: number // 0.0 - 1.0
  reasoning: string
}

// Rule weights for scoring
const CATEGORY_SCORES: Record<string, { type: ContentType; weight: number }> = {
  droppz: { type: 'music_release', weight: 1.0 },
  usa_rap: { type: 'music_release', weight: 0.95 },
  uk_rap: { type: 'music_release', weight: 0.95 },
  eu_rap: { type: 'music_release', weight: 0.95 },
  ru_rap: { type: 'music_release', weight: 0.95 },
  balkan_rap: { type: 'music_release', weight: 0.95 },
  culture: { type: 'cultural', weight: 0.85 },
  fun: { type: 'cultural', weight: 0.85 },
  news: { type: 'artist_news', weight: 0.8 },
  interview: { type: 'artist_news', weight: 0.8 },
  festival: { type: 'cultural', weight: 0.9 },
  tour: { type: 'artist_news', weight: 0.9 },
}

const MUSIC_KEYWORDS = [
  'track',
  'album',
  'ep',
  'single',
  'release',
  'official video',
  'music video',
  'spotify',
  'apple music',
  'genius',
  'soundcloud',
  'mixtape',
]

const VISUAL_KEYWORDS = [
  'visual',
  'video',
  'graphic',
  'design',
  'art',
  'photo',
  'image',
  'thumbnail',
  'poster',
  'artwork',
]

const ARTIST_NEWS_KEYWORDS = [
  'interview',
  'news',
  'announcement',
  'tour',
  'concert',
  'festival',
  'beef',
  'diss',
  'collaboration',
  'feature',
]

function scoreKeywords(text: string, keywords: string[]): number {
  const lower = text.toLowerCase()
  const matches = keywords.filter((kw) => lower.includes(kw.toLowerCase())).length
  return matches / keywords.length
}

/**
 * Detect content type based on cluster metadata
 * Returns sequence of modules to run
 */
export function detectContentType(cluster: {
  category?: string | null
  title?: string
  main_entity?: string
  merged_context?: string[]
  source?: string
}): ContentAnalysis {
  const typeScore: Record<ContentType, number> = {
    music_release: 0,
    artist_news: 0,
    cultural: 0,
    visual_first: 0,
    general: 0,
  }

  const reasoning: string[] = []

  // Score 1: Category-based
  if (cluster.category) {
    const categoryScore = CATEGORY_SCORES[cluster.category.toLowerCase()]
    if (categoryScore) {
      typeScore[categoryScore.type] += categoryScore.weight
      reasoning.push(`Category "${cluster.category}" → ${categoryScore.type}`)
    }
  }

  // Score 2: Title keywords
  const titleText = cluster.title || ''
  const titleMusicScore = scoreKeywords(titleText, MUSIC_KEYWORDS)
  const titleVisualScore = scoreKeywords(titleText, VISUAL_KEYWORDS)
  const titleArtistScore = scoreKeywords(titleText, ARTIST_NEWS_KEYWORDS)

  typeScore.music_release += titleMusicScore * 0.6
  typeScore.visual_first += titleVisualScore * 0.5
  typeScore.artist_news += titleArtistScore * 0.5

  if (titleMusicScore > 0) reasoning.push(`Title has music keywords (+${titleMusicScore.toFixed(2)})`)
  if (titleVisualScore > 0) reasoning.push(`Title has visual keywords (+${titleVisualScore.toFixed(2)})`)

  // Score 3: Context keywords
  const contextText = (cluster.merged_context || []).join(' ')
  const contextMusicScore = scoreKeywords(contextText, MUSIC_KEYWORDS)
  const contextVisualScore = scoreKeywords(contextText, VISUAL_KEYWORDS)

  typeScore.music_release += contextMusicScore * 0.4
  typeScore.visual_first += contextVisualScore * 0.3

  // Determine dominant type
  const sortedTypes = Object.entries(typeScore)
    .sort(([, a], [, b]) => b - a)
    .map(([type]) => type as ContentType)

  const dominantType = sortedTypes[0] || 'general'
  const dominantScore = typeScore[dominantType]
  const confidence = Math.min(1.0, dominantScore)

  // Define module sequences based on detected type
  const moduleSequences: Record<ContentType, ModuleSequence> = {
    music_release: ['enrichment', 'writer', 'creator'], // Music → add links → write article → graphics
    artist_news: ['writer', 'enrichment', 'creator'], // Write article first → add artist context → graphics
    cultural: ['writer', 'creator'], // Write article → create graphics (no enrichment needed)
    visual_first: ['creator', 'writer'], // Create graphics → write caption/article
    general: ['writer', 'creator'], // Safe default: write → create visuals
  }

  const moduleSequence = moduleSequences[dominantType]

  reasoning.push(`Dominant type: ${dominantType} (confidence: ${confidence.toFixed(2)})`)
  reasoning.push(`Module sequence: ${moduleSequence.join(' → ')}`)

  return {
    contentType: dominantType,
    moduleSequence,
    confidence,
    reasoning: reasoning.join('; '),
  }
}

/**
 * Validate if content is suitable for each module
 * (Can skip modules based on content analysis)
 */
export function shouldRunModule(
  module: 'writer' | 'enrichment' | 'creator',
  cluster: { category?: string | null; title?: string }
): boolean {
  const category = cluster.category?.toLowerCase() || ''
  const title = (cluster.title || '').toLowerCase()

  // Enrichment is only valuable for music categories
  if (module === 'enrichment') {
    const musicCategories = ['droppz', 'usa_rap', 'uk_rap', 'eu_rap', 'ru_rap', 'balkan_rap']
    return musicCategories.some((cat) => category.includes(cat))
  }

  // Writer and Creator always useful
  return true
}

/**
 * Get localized messaging for module sequence
 */
export function describeSequence(sequence: ModuleSequence, contentType: ContentType): string {
  const moduleNames: Record<string, string> = {
    writer: 'Psaní článku',
    enrichment: 'Obohacení dat (Spotify, YouTube, atd)',
    creator: 'Vytvoření grafiky & thumbnailů',
  }

  const description = sequence.map((m) => moduleNames[m]).join(' → ')
  return `${contentType.replace(/_/g, ' ')} | Pipeline: ${description}`
}
