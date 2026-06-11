/**
 * Provider-specific resilience policies
 * Defines timeout, retry count, backoff strategy per external provider
 */

import type { ResilienceOptions } from '../utils/resilience.ts'

export type ProviderKey = 'spotify' | 'youtube' | 'genius' | 'apple_music' | 'image' | 'wikidata'

export const PROVIDER_POLICIES: Record<ProviderKey, ResilienceOptions> = {
  spotify: {
    timeout: 5000,
    maxRetries: 3,
    backoff: 'exponential',
    retryableErrors: ['timeout', 'ECONNREFUSED', 'ECONNRESET', '429', '503', '502'],
  },
  youtube: {
    timeout: 8000,
    maxRetries: 2,
    backoff: 'linear',
    retryableErrors: ['timeout', 'ECONNREFUSED', 'ECONNRESET', '429', '503', '500'],
  },
  genius: {
    timeout: 3000,
    maxRetries: 2,
    backoff: 'exponential',
    retryableErrors: ['timeout', 'ECONNREFUSED', 'ECONNRESET', '429', '503'],
  },
  apple_music: {
    timeout: 6000,
    maxRetries: 1,
    backoff: 'none',
    retryableErrors: ['timeout', 'ECONNREFUSED', 'ECONNRESET', '503'],
  },
  image: {
    timeout: 4000,
    maxRetries: 2,
    backoff: 'exponential',
    retryableErrors: ['timeout', 'ECONNREFUSED', 'ECONNRESET', '429', '503'],
  },
  wikidata: {
    timeout: 5000,
    maxRetries: 2,
    backoff: 'linear',
    retryableErrors: ['timeout', 'ECONNREFUSED', 'ECONNRESET', '429', '503'],
  },
}

/**
 * Get provider policy or default fallback
 */
export function getProviderPolicy(provider: ProviderKey): ResilienceOptions {
  return PROVIDER_POLICIES[provider] || {
    timeout: 5000,
    maxRetries: 2,
    backoff: 'exponential',
    retryableErrors: ['timeout', 'ECONNREFUSED', 'ECONNRESET', '429', '503'],
  }
}
