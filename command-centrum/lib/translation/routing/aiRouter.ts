import { GEMINI_FLASH }   from '../providers/geminiProvider'
import { GROQ_FAST, GROQ_MEDIUM } from '../providers/groqProvider'
import type { TranslationProvider } from '../providers/types'

export type RouterDecision = {
  primary:  TranslationProvider
  fallback: TranslationProvider
  tier:     'small' | 'medium' | 'large'
  reason:   string
}

// Primary: Gemini Flash (free tier, 1M tokens/day)
// Fallback: Groq Fast → Groq Medium (both free)
// DeepSeek removed — paid API with no balance
function pickPrimary(): TranslationProvider {
  if (GEMINI_FLASH.isAvailable()) return GEMINI_FLASH
  return GROQ_FAST
}

function pickFallback(primary: TranslationProvider): TranslationProvider {
  if (primary !== GROQ_FAST && GROQ_FAST.isAvailable()) return GROQ_FAST
  return GROQ_MEDIUM
}

// Route based on content size.
// small  (<500 chars):  fast model — titles, captions, tags
// medium (<5000 chars): fast model — summaries, short articles
// large  (≥5000 chars): versatile model + chunking — full articles
export function routeTranslation(charCount: number): RouterDecision {
  const primary  = pickPrimary()
  const fallback = pickFallback(primary)

  if (charCount < 500) {
    return { primary, fallback, tier: 'small',  reason: `${charCount} chars → ${primary.name}` }
  }
  if (charCount < 5000) {
    return { primary, fallback, tier: 'medium', reason: `${charCount} chars → ${primary.name}` }
  }
  return { primary, fallback, tier: 'large', reason: `${charCount} chars → ${primary.name} + chunking` }
}
