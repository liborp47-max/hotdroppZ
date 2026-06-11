// Language detection layer — fast heuristic + AI fallback.
// Runs before translation so EN content is skipped entirely.

export type LangDetectResult = {
  detected: string       // ISO 639-1 code
  confidence: number     // 0–1
  skip_translation: boolean
}

// Character-set & high-frequency word patterns per language.
// Order matters — more specific patterns first.

const CYRILLIC = /[Ѐ-ӿ]/
const CZ_CHARS = /[ěšřžýůďťň]/i
const SK_CHARS = /[ľĺŕ]/i
const PL_CHARS = /[ąęźżćńśó]/i
const BALKAN_CHARS = /[đčćšž]/i       // covers HR/BS/SR Latin
const DE_WORDS = /\b(und|der|die|das|ist|nicht|auch|mit|von|für|eine|einer|eines|werden|wurde|hat)\b/i
const FR_WORDS = /\b(le|la|les|des|une|dans|est|sont|avec|pour|mais|sur|par|pas|qui)\b/i
const IT_WORDS = /\b(il|lo|la|gli|le|una|del|dei|della|delle|degli|essere|sono|con|per)\b/i
const ES_WORDS = /\b(el|los|las|una|unos|del|para|por|con|que|como|pero|más|sobre)\b/i

// Common EN patterns — avoids mistaking Romanized Cyrillic/Latin mixes
const EN_WORDS = /\b(the|and|is|in|of|to|a|that|it|was|for|on|with|he|she|they|this|at|from|or)\b/i

function score(text: string, pattern: RegExp): number {
  const matches = text.match(new RegExp(pattern.source, 'gi'))
  return matches ? matches.length : 0
}

export function detectLanguage(text: string): LangDetectResult {
  if (!text || text.trim().length < 10) {
    return { detected: 'en', confidence: 0.5, skip_translation: true }
  }

  const sample = text.slice(0, 800)

  // Cyrillic → ru (could be sr, but we route the same way)
  if (CYRILLIC.test(sample)) {
    const cyrillicCount = (sample.match(/[Ѐ-ӿ]/g) ?? []).length
    const confidence = Math.min(0.99, cyrillicCount / sample.length * 8)
    return { detected: 'ru', confidence, skip_translation: false }
  }

  // Polish — must check before generic Latin
  if (PL_CHARS.test(sample)) {
    return { detected: 'pl', confidence: 0.92, skip_translation: false }
  }

  // Czech — specific chars not shared with Slovak
  if (CZ_CHARS.test(sample)) {
    return { detected: 'cs', confidence: 0.90, skip_translation: false }
  }

  // Slovak — ľ ĺ ŕ unique to SK
  if (SK_CHARS.test(sample)) {
    return { detected: 'sk', confidence: 0.90, skip_translation: false }
  }

  // Balkan Latin (HR/BS/SR)
  if (BALKAN_CHARS.test(sample)) {
    return { detected: 'hr', confidence: 0.82, skip_translation: false }
  }

  // Word-frequency scoring for DE/FR/IT/ES/EN
  const scores: Record<string, number> = {
    de: score(sample, DE_WORDS),
    fr: score(sample, FR_WORDS),
    it: score(sample, IT_WORDS),
    es: score(sample, ES_WORDS),
    en: score(sample, EN_WORDS),
  }

  const top = Object.entries(scores).sort((a, b) => b[1] - a[1])
  const [bestLang, bestScore] = top[0]
  const [, secondScore] = top[1] ?? ['', 0]

  // Not enough signal — default to EN passthrough
  if (bestScore === 0) {
    return { detected: 'en', confidence: 0.5, skip_translation: true }
  }

  const confidence = secondScore === 0
    ? 0.85
    : Math.min(0.95, (bestScore - secondScore) / bestScore * 0.6 + 0.5)

  const skip_translation = bestLang === 'en' && confidence > 0.6

  return { detected: bestLang, confidence, skip_translation }
}

// Batch detection — returns array aligned with input
export function detectLanguages(texts: string[]): LangDetectResult[] {
  return texts.map(detectLanguage)
}
