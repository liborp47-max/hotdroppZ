// ─── AI Provider Registry ─────────────────────────────────────────────────────
// Central registry for all AI providers used in the HDCC pipeline.
// Provider priority: GPT-4.1 (writer) > Gemini Flash (curation/translation) > DeepSeek (fallback) > Groq (free fallback) > rules

export type ProviderType =
  | 'local-rules'   // pure rule-based, no AI, always available
  | 'local-free'    // self-hosted AI (Ollama, LibreTranslate)
  | 'cloud-free'    // cloud AI with free tier (Groq, Gemini Free, DeepSeek Free)
  | 'cloud-paid'    // paid cloud AI (OpenAI, Anthropic)

export type ProviderStatus =
  | 'active'
  | 'not-configured'
  | 'disabled'
  | 'error'

export type ProviderLatency = 'instant' | 'fast' | 'medium' | 'slow'

export type AiProvider = {
  id: string
  displayName: string
  type: ProviderType
  cost: 'free' | 'free-limited' | 'paid'
  latency: ProviderLatency
  model?: string
  requiresEnv?: string[]
  requiresLocal?: string
  endpoint?: string
  maxTokens?: number
  notes?: string
}

export type AiStepKey =
  | 'filter'
  | 'translation'
  | 'curator'
  | 'cluster'
  | 'writer'
  | 'final_editor'
  | 'enrichment'
  | 'feed'
  | 'multilang'
  | 'monetizer'

export type StepConfig = {
  step: AiStepKey
  label: string
  description: string
  pipelineEndpoint: string
  providers: AiProvider[]
  selected: string
  fallback: string
}

// ─── Provider catalogue ───────────────────────────────────────────────────────

const PROVIDERS = {
  // ── Rule-based (always available) ─────────────────────────────────────────
  rules: {
    id: 'rules',
    displayName: 'Rule-Based',
    type: 'local-rules' as ProviderType,
    cost: 'free' as const,
    latency: 'instant' as ProviderLatency,
    notes: 'Pure deterministic rules — no AI, always available',
  },

  jaccard: {
    id: 'jaccard',
    displayName: 'Jaccard Similarity',
    type: 'local-rules' as ProviderType,
    cost: 'free' as const,
    latency: 'instant' as ProviderLatency,
    notes: 'Entity overlap + time proximity — no AI, always available',
  },

  // ── Self-hosted ───────────────────────────────────────────────────────────
  ollama_mistral: {
    id: 'ollama_mistral',
    displayName: 'Ollama · Mistral 7B',
    type: 'local-free' as ProviderType,
    cost: 'free' as const,
    latency: 'medium' as ProviderLatency,
    model: 'mistral:7b',
    requiresLocal: 'OLLAMA_URL',
    notes: 'Self-hosted via Ollama — ollama pull mistral',
  },

  ollama_llama3: {
    id: 'ollama_llama3',
    displayName: 'Ollama · Llama 3.2',
    type: 'local-free' as ProviderType,
    cost: 'free' as const,
    latency: 'medium' as ProviderLatency,
    model: 'llama3.2:3b',
    requiresLocal: 'OLLAMA_URL',
    notes: 'Self-hosted via Ollama — ollama pull llama3.2',
  },

  libretranslate: {
    id: 'libretranslate',
    displayName: 'LibreTranslate',
    type: 'local-free' as ProviderType,
    cost: 'free' as const,
    latency: 'fast' as ProviderLatency,
    requiresLocal: 'LIBRETRANSLATE_URL',
    notes: 'Self-hosted: github.com/LibreTranslate/LibreTranslate',
  },

  // ── Cloud free tier ───────────────────────────────────────────────────────
  groq: {
    id: 'groq',
    displayName: 'Groq · llama-3.3-70b',
    type: 'cloud-free' as ProviderType,
    cost: 'free' as const,
    latency: 'fast' as ProviderLatency,
    model: 'llama-3.3-70b-versatile',
    requiresEnv: ['GROQ_API_KEY'],
    maxTokens: 2048,
    notes: 'Groq free tier — 70b model for quality writing',
  },

  groq_fast: {
    id: 'groq_fast',
    displayName: 'Groq · llama-3.1-8b',
    type: 'cloud-free' as ProviderType,
    cost: 'free' as const,
    latency: 'instant' as ProviderLatency,
    model: 'llama-3.1-8b-instant',
    requiresEnv: ['GROQ_API_KEY'],
    maxTokens: 2048,
    notes: 'Groq fast tier — 8b model for translation/curation',
  },

  deepl_free: {
    id: 'deepl_free',
    displayName: 'DeepL Free',
    type: 'cloud-free' as ProviderType,
    cost: 'free-limited' as const,
    latency: 'fast' as ProviderLatency,
    requiresEnv: ['DEEPL_API_KEY'],
    notes: 'DeepL Free tier: 500k chars/month',
  },

  gemini_flash: {
    id: 'gemini_flash',
    displayName: 'Gemini 2.0 Flash',
    type: 'cloud-free' as ProviderType,
    cost: 'free-limited' as const,
    latency: 'fast' as ProviderLatency,
    model: 'gemini-2.0-flash',
    requiresEnv: ['GEMINI_API_KEY'],
    maxTokens: 2048,
    notes: 'Google Gemini Flash — free tier 1M tokens/day via AI Studio',
  },

  deepseek: {
    id: 'deepseek',
    displayName: 'DeepSeek Chat',
    type: 'cloud-free' as ProviderType,
    cost: 'free-limited' as const,
    latency: 'medium' as ProviderLatency,
    model: 'deepseek-chat',
    requiresEnv: ['DEEPSEEK_API_KEY'],
    maxTokens: 2048,
    notes: 'DeepSeek-V3 — very cheap/free tier, OpenAI-compatible API',
  },

  // ── Cloud paid ────────────────────────────────────────────────────────────
  openai_mini: {
    id: 'openai_mini',
    displayName: 'GPT-4.1 mini',
    type: 'cloud-paid' as ProviderType,
    cost: 'paid' as const,
    latency: 'fast' as ProviderLatency,
    model: 'gpt-4.1-mini',
    requiresEnv: ['OPENAI_API_KEY'],
    maxTokens: 2048,
    notes: '~$0.15/1M input tokens — primary for curator + writer',
  },

  openai_full: {
    id: 'openai_full',
    displayName: 'GPT-4.1',
    type: 'cloud-paid' as ProviderType,
    cost: 'paid' as const,
    latency: 'fast' as ProviderLatency,
    model: 'gpt-4.1',
    requiresEnv: ['OPENAI_API_KEY'],
    maxTokens: 4096,
    notes: '~$2/1M input tokens — high-priority writer only',
  },

  claude_haiku: {
    id: 'claude_haiku',
    displayName: 'Claude Haiku 4.5',
    type: 'cloud-paid' as ProviderType,
    cost: 'paid' as const,
    latency: 'fast' as ProviderLatency,
    model: 'claude-haiku-4-5-20251001',
    requiresEnv: ['ANTHROPIC_API_KEY'],
    maxTokens: 2048,
    notes: 'Anthropic Haiku — fast, reliable, separate quota from OpenAI/Google',
  },

  claude_sonnet: {
    id: 'claude_sonnet',
    displayName: 'Claude Sonnet 4.6',
    type: 'cloud-paid' as ProviderType,
    cost: 'paid' as const,
    latency: 'medium' as ProviderLatency,
    model: 'claude-sonnet-4-6',
    requiresEnv: ['ANTHROPIC_API_KEY'],
    maxTokens: 4096,
    notes: 'Anthropic Sonnet — high quality for premium article writing',
  },
} satisfies Record<string, AiProvider>

// ─── Step configs ─────────────────────────────────────────────────────────────
// Priority order within providers[] = fallback order if router scores are tied.

export const STEP_CONFIGS: StepConfig[] = [
  {
    step: 'filter',
    label: 'Light Curation',
    description: 'Discards low-quality SCOUTED items before translation',
    pipelineEndpoint: '/api/filter/run',
    providers: [PROVIDERS.gemini_flash, PROVIDERS.groq_fast, PROVIDERS.rules],
    selected: 'gemini_flash',
    fallback: 'rules',
  },
  {
    step: 'translation',
    label: 'Translation',
    description: 'Translates SCOUTED items to English',
    pipelineEndpoint: '/api/translator/run',
    providers: [PROVIDERS.gemini_flash, PROVIDERS.groq_fast, PROVIDERS.openai_mini, PROVIDERS.libretranslate, PROVIDERS.deepl_free],
    selected: 'gemini_flash',
    fallback: 'groq_fast',
  },
  {
    step: 'curator',
    label: 'Curator',
    description: 'Scores and classifies TRANSLATED items',
    pipelineEndpoint: '/api/curator/run',
    providers: [PROVIDERS.claude_haiku, PROVIDERS.gemini_flash, PROVIDERS.groq_fast, PROVIDERS.openai_mini, PROVIDERS.rules],
    selected: 'claude_haiku',
    fallback: 'groq_fast',
  },
  {
    step: 'cluster',
    label: 'Cluster',
    description: 'Groups CURATED items by entity overlap + time proximity',
    pipelineEndpoint: '/api/cluster/run',
    providers: [PROVIDERS.jaccard, PROVIDERS.gemini_flash],
    selected: 'jaccard',
    fallback: 'jaccard',
  },
  {
    step: 'writer',
    label: 'Writer',
    description: 'Generates articles from story clusters',
    pipelineEndpoint: '/api/writer/run',
    providers: [PROVIDERS.claude_haiku, PROVIDERS.openai_mini, PROVIDERS.gemini_flash, PROVIDERS.groq, PROVIDERS.claude_sonnet, PROVIDERS.ollama_mistral, PROVIDERS.ollama_llama3],
    selected: 'claude_haiku',
    fallback: 'groq',
  },
  {
    step: 'final_editor',
    label: 'Executive Check',
    description: 'Validates article quality before publish',
    pipelineEndpoint: '/api/writer/run',
    providers: [PROVIDERS.rules, PROVIDERS.claude_haiku, PROVIDERS.gemini_flash, PROVIDERS.openai_mini],
    selected: 'rules',
    fallback: 'rules',
  },
  {
    step: 'enrichment',
    label: 'Enrichment',
    description: 'Attaches Spotify / YouTube / Genius media to posts',
    pipelineEndpoint: '/api/enrichment/run',
    providers: [PROVIDERS.rules, PROVIDERS.gemini_flash],
    selected: 'rules',
    fallback: 'rules',
  },
  {
    step: 'feed',
    label: 'Feed Engine',
    description: 'Validates and sets media_hint on feed cards',
    pipelineEndpoint: '/api/feed/run',
    providers: [PROVIDERS.rules],
    selected: 'rules',
    fallback: 'rules',
  },
  {
    step: 'multilang',
    label: 'Multilang',
    description: 'Localizes approved posts to CS/DE/FR/ES/PL/IT/NL/RU',
    pipelineEndpoint: '/api/multilang/run',
    providers: [PROVIDERS.gemini_flash, PROVIDERS.groq_fast, PROVIDERS.claude_haiku, PROVIDERS.openai_mini],
    selected: 'gemini_flash',
    fallback: 'groq_fast',
  },
  {
    step: 'monetizer',
    label: 'Monetizer',
    description: 'Scores monetization potential and ad categories',
    pipelineEndpoint: '/api/monetizer/run',
    providers: [PROVIDERS.rules, PROVIDERS.gemini_flash, PROVIDERS.groq_fast],
    selected: 'rules',
    fallback: 'rules',
  },
]

// ─── Runtime availability detection ──────────────────────────────────────────

export function detectProviderStatus(provider: AiProvider): ProviderStatus {
  if (provider.type === 'local-rules') return 'active'

  if (provider.requiresEnv) {
    for (const envKey of provider.requiresEnv) {
      if (!process.env[envKey]) return 'not-configured'
    }
  }

  if (provider.requiresLocal) {
    if (!process.env[provider.requiresLocal]) return 'not-configured'
  }

  return 'active'
}

export type EnrichedProvider = AiProvider & { status: ProviderStatus }

export type EnrichedStepConfig = Omit<StepConfig, 'providers'> & {
  providers: EnrichedProvider[]
  activeProvider: EnrichedProvider
}

export function enrichStepConfig(
  config: StepConfig,
  overrideSelected?: string
): EnrichedStepConfig {
  const selected = overrideSelected ?? config.selected
  const providers = config.providers.map((p) => ({
    ...p,
    status: detectProviderStatus(p),
  }))

  const activeProvider =
    providers.find((p) => p.id === selected) ??
    providers.find((p) => p.status === 'active') ??
    providers[0]

  return { ...config, providers, selected, activeProvider }
}
