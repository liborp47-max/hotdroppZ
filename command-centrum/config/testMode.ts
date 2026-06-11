export const TEST_MODE =
  process.env.HOTDROPPZ_TEST_MODE === 'true' ||
  process.env.NEXT_PUBLIC_HOTDROPPZ_TEST_MODE === 'true'

export const TEST_MODE_STORAGE_KEY = 'hotdroppz:test-mode'

export const TEST_MODE_CONFIG = {
  country_source_limit: 3,
  articles_per_source: 3,
  summary_max_chars: 250,
  max_entities: 5,
  max_related_lookups: 1,
  max_article_body_chars: 700,
  reduced_enrichment: true,
  source_batch_size: 3,
  stage_batch_limit: 15,
  ai_input_chars: 600,
  writer_context_items: 3,
  multilang_languages: ['cs', 'de'],
} as const

export type TestModeConfig = typeof TEST_MODE_CONFIG

export type PipelineOptions = {
  testMode?: boolean
}

export function isTestModeRequest(headers: Headers) {
  const header = headers.get('x-hotdroppz-test-mode')
  if (header === 'true') return true
  if (header === 'false') return false
  return TEST_MODE
}

