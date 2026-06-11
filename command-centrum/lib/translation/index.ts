// Translation module public API.
// Import from here — not from internal files.

// Core
export { translateItem, translateBatch } from './engine'
export type { TranslationInput, TranslationOutput, TranslationMode, TranslationStatus } from './engine'

// Detection
export { detectLanguage, detectLanguages } from './languageDetector'
export type { LangDetectResult } from './languageDetector'

// Chunking
export { chunkText, recombineChunks } from './chunker'

// Cache
export { makeTranslationHash, getCachedTranslation, setCachedTranslation, purgExpiredCache } from './cache'

// Providers
export type { TranslationProvider, TranslationRequest, TranslationResponse } from './providers/types'
export { GroqProvider, GROQ_FAST, GROQ_MEDIUM } from './providers/groqProvider'

// Routing
export { routeTranslation } from './routing/aiRouter'
export type { RouterDecision } from './routing/aiRouter'

// Logs
export { logTranslationJob } from './logs/translationHistory'
export type { JobStatus, TranslationJobInsert } from './logs/translationHistory'
