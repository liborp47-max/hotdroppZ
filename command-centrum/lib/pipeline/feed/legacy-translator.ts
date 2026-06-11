/**
 * LEGACY Feed Translator (pre UM-FEED_ENGINE, 2026-05-12).
 *
 * Placeholder translation — returns text unchanged. Kept for compatibility
 * with /api/feed/distribute + /api/distributor/dispatch. New mission code
 * (real MULTILANG_FULL backed, DB-row based) lives in localizer.ts.
 */

import { type FeedContent, type LocalizedFeedVariant, type Language, validateFeedContent } from './legacy-structure';

export type { FeedContent, LocalizedFeedVariant, Language };

export const SUPPORTED_LANGUAGES: Language[] = ['en', 'fr', 'de', 'es', 'it', 'pt', 'nl', 'pl'];

/**
 * Translation result - all language variants
 */
export interface TranslationResult {
  variants: LocalizedFeedVariant[];
  totalLanguages: number;
  timestamp: string;
}

/**
 * Translate FeedContent to all supported languages
 */
export async function translateFeedContent(
  content: FeedContent,
  targetLanguages: Language[] = SUPPORTED_LANGUAGES
): Promise<TranslationResult> {
  const variants: LocalizedFeedVariant[] = [];

  // Add original (English, no translation)
  variants.push({
    language: 'en',
    content,
    validation: validateFeedContent(content),
    translated_at: new Date().toISOString()
  });

  // Translate to other languages
  for (const lang of targetLanguages) {
    if (lang === 'en') continue;

    const translated = await translateToLanguage(content, lang);
    variants.push({
      language: lang,
      content: translated,
      validation: validateFeedContent(translated),
      translated_at: new Date().toISOString()
    });
  }

  return {
    variants,
    totalLanguages: variants.length,
    timestamp: new Date().toISOString()
  };
}

/**
 * Translate content to specific language
 * TODO: Wire to translation service (DeepL, Claude, Google Translate, etc.)
 */
async function translateToLanguage(
  content: FeedContent,
  language: Language
): Promise<FeedContent> {
  // Placeholder: returns same content (no translation)
  // In production: call translation API

  console.log(`[Translator] Translating to ${language}...`);

  return {
    ...content,
    // Translate text fields
    headline: await translateText(content.headline, 'en', language),
    body: await translateText(content.body, 'en', language),
    summary: await translateText(content.summary, 'en', language),
    
    // Tags usually don't need translation but can be adapted
    tags: content.tags,
    
    // Images/links stay the same
    images: content.images,
    links: content.links,
    
    // Metadata with language marker
    metadata: {
      ...content.metadata,
      translated_language: language
    }
  };
}

/**
 * Translate single text string
 * TODO: Implement actual translation
 */
async function translateText(
  text: string,
  sourceLang: Language,
  targetLang: Language
): Promise<string> {
  // Placeholder
  return text;
}

/**
 * Get localized variant for specific language
 */
export function getVariantByLanguage(
  result: TranslationResult,
  language: Language
): LocalizedFeedVariant | undefined {
  return result.variants.find((v) => v.language === language);
}

/**
 * Get language name
 */
export function getLanguageName(language: Language): string {
  const names: Record<Language, string> = {
    en: 'English',
    fr: 'Français',
    de: 'Deutsch',
    es: 'Español',
    it: 'Italiano',
    pt: 'Português',
    nl: 'Nederlands',
    pl: 'Polski'
  };
  return names[language];
}
