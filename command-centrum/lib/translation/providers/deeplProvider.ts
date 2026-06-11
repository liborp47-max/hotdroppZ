// DeepL Free/Pro translation provider — direct REST API, not LLM-based.
// Supports: CS, SK, PL, DE, FR, IT, ES, RU, HR → EN
// Free key ends with ":fx" → api-free.deepl.com; paid → api.deepl.com
// Activate by setting DEEPL_API_KEY in environment.

import type { TranslationInput } from '../engine'

const FREE_ENDPOINT = 'https://api-free.deepl.com/v2/translate'
const PAID_ENDPOINT = 'https://api.deepl.com/v2/translate'
const TIMEOUT_MS    = 8_000
const MAX_CHARS     = 3_000   // keep body trim — DeepL free tier is 500k chars/month

const LANG_MAP: Record<string, string> = {
  cs: 'CS',
  sk: 'SK',
  pl: 'PL',
  de: 'DE',
  fr: 'FR',
  it: 'IT',
  es: 'ES',
  ru: 'RU',
  hr: 'HR',
  sr: 'SR',
  bs: 'BS',
}

export function isDeepLAvailable(): boolean {
  return Boolean(process.env.DEEPL_API_KEY)
}

async function callDeepL(text: string, sourceLang: string): Promise<string> {
  const apiKey   = process.env.DEEPL_API_KEY!
  const endpoint = apiKey.endsWith(':fx') ? FREE_ENDPOINT : PAID_ENDPOINT
  const deeplSrc = LANG_MAP[sourceLang]

  const body = new URLSearchParams({ text, target_lang: 'EN-US' })
  if (deeplSrc) body.append('source_lang', deeplSrc)

  const res = await fetch(endpoint, {
    method:  'POST',
    headers: {
      Authorization:  `DeepL-Auth-Key ${apiKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })

  if (!res.ok) throw new Error(`DeepL ${res.status}: ${await res.text().catch(() => '')}`)

  const data = await res.json() as { translations: Array<{ text: string }> }
  return data.translations[0]?.text ?? text
}

export type DeepLResult = {
  title_en:   string
  summary_en: string | null
  body_en:    string | null
  tags_en:    string[]
}

export async function translateWithDeepL(
  input: TranslationInput,
  sourceLang: string,
): Promise<DeepLResult> {
  const [titleEn, summaryEn, bodyEn] = await Promise.all([
    callDeepL(input.title, sourceLang),
    input.summary ? callDeepL(input.summary.slice(0, MAX_CHARS), sourceLang) : Promise.resolve(null),
    input.body    ? callDeepL(input.body.slice(0, MAX_CHARS), sourceLang)    : Promise.resolve(null),
  ])

  return {
    title_en:   titleEn,
    summary_en: summaryEn,
    body_en:    bodyEn,
    tags_en:    input.tags ?? [],  // tags are typically artist/genre names — keep as-is
  }
}
