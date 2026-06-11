// ─── Global Category System — Single Source of Truth ────────────────────────
// Used everywhere: Scout, Curator, Cluster, Writer, Feed, Distribution, HDUA.
// Do NOT define categories elsewhere.

export const CATEGORIES = ['drop', 'scene', 'beef', 'fashion', 'viral', 'hustle'] as const

export type Category = typeof CATEGORIES[number]

// Human-readable labels
export const CATEGORY_LABELS: Record<Category, string> = {
  drop:    'DROP',
  scene:   'SCENE',
  beef:    'BEEF',
  fashion: 'FASHION',
  viral:   'VIRAL',
  hustle:  'HUSTLE',
}

// Emoji for compact display
export const CATEGORY_EMOJI: Record<Category, string> = {
  drop:    '🎵',
  scene:   '🎤',
  beef:    '🔥',
  fashion: '🧢',
  viral:   '💥',
  hustle:  '💰',
}

// Tailwind badge styles
export const CATEGORY_COLORS: Record<Category, string> = {
  drop:    'bg-purple-500/15 text-purple-300 border-purple-500/25',
  scene:   'bg-blue-500/15 text-blue-400 border-blue-500/25',
  beef:    'bg-red-500/15 text-red-400 border-red-500/25',
  fashion: 'bg-fuchsia-500/15 text-fuchsia-400 border-fuchsia-500/25',
  viral:   'bg-orange-500/15 text-orange-400 border-orange-500/25',
  hustle:  'bg-yellow-500/15 text-yellow-400 border-yellow-500/25',
}

// Active-state (selected filter pill) styles
export const CATEGORY_ACTIVE: Record<Category, string> = {
  drop:    'bg-purple-500/30 text-purple-200 border-purple-400/50',
  scene:   'bg-blue-500/30 text-blue-200 border-blue-400/50',
  beef:    'bg-red-500/30 text-red-200 border-red-400/50',
  fashion: 'bg-fuchsia-500/30 text-fuchsia-200 border-fuchsia-400/50',
  viral:   'bg-orange-500/30 text-orange-200 border-orange-400/50',
  hustle:  'bg-yellow-500/30 text-yellow-200 border-yellow-400/50',
}

// Pipeline priority P0–P2
export const CATEGORY_PRIORITY: Record<Category, 'P0' | 'P1' | 'P2'> = {
  drop:    'P0',
  beef:    'P0',
  scene:   'P1',
  viral:   'P1',
  fashion: 'P2',
  hustle:  'P2',
}

// ─── Legacy mapping (scout-sources SourceCategory → new Category) ────────────
// Used during migration to normalise old category strings coming from the DB.
export const LEGACY_CATEGORY_MAP: Record<string, Category> = {
  droppz:     'drop',
  usa_rap:    'scene',
  uk_rap:     'scene',
  eu_rap:     'scene',
  ru_rap:     'scene',
  balkan_rap: 'scene',
  fashion:    'fashion',
  culture:    'scene',
  fun:        'viral',
  news:       'scene',
  // already-canonical pass-through
  drop:    'drop',
  scene:   'scene',
  beef:    'beef',
  viral:   'viral',
  hustle:  'hustle',
}

/** Normalise any raw category string to a canonical Category. Falls back to 'scene'. */
export function toCategory(raw: string | null | undefined): Category {
  if (!raw) return 'scene'
  const mapped = LEGACY_CATEGORY_MAP[raw.toLowerCase()]
  return mapped ?? 'scene'
}

/** Type guard */
export function isCategory(value: unknown): value is Category {
  return typeof value === 'string' && (CATEGORIES as readonly string[]).includes(value)
}
