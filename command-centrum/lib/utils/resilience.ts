/**
 * Sjednocená resilience vrstva pro externí API volání
 * Provides unified retry + timeout + telemetry orchestration
 */

import { logger } from '../logger.ts'
import { withTimeout } from './retry.ts'

export type BackoffStrategy = 'exponential' | 'linear' | 'none'

export type ResilienceOptions = {
  maxRetries: number
  timeout: number // ms
  backoff: BackoffStrategy
  retryableErrors: string[] // error patterns to retry on
}

export type ResilienceMetrics = {
  event: 'provider_metric'
  provider: string
  retry_count: number
  timeout_occurred: boolean
  success: boolean
  duration_ms: number
  error_code?: string
}

class ResilienceMetricsCollector {
  private metrics: ResilienceMetrics[] = []

  emit(metric: ResilienceMetrics) {
    this.metrics.push(metric)
    logger.debug('provider_metric_emitted', { provider: metric.provider, retry_count: metric.retry_count })
  }

  getMetrics(): ResilienceMetrics[] {
    return [...this.metrics]
  }

  clear() {
    this.metrics = []
  }
}

export const metricsCollector = new ResilienceMetricsCollector()

function isRetryableError(err: Error, retryablePatterns: string[]): boolean {
  const errMsg = err.message.toLowerCase()
  const errCode = (err as any).code?.toString() || ''

  // Always retry on timeout/connection errors
  if (errMsg.includes('timeout') || errMsg.includes('econnrefused') || errMsg.includes('econnreset')) {
    return true
  }

  // Check for specific error patterns
  if (retryablePatterns.some((p) => errMsg.includes(p.toLowerCase()) || errCode.includes(p))) {
    return true
  }

  return false
}

function calculateBackoff(attempt: number, strategy: BackoffStrategy, initialDelayMs = 500): number {
  if (strategy === 'exponential') {
    // 500ms, 1s, 2s, 4s
    return initialDelayMs * Math.pow(2, attempt - 1)
  } else if (strategy === 'linear') {
    // 500ms, 1s, 1.5s, 2s
    return initialDelayMs * attempt
  }
  return 0
}

/**
 * Execute an async function with unified retry + timeout orchestration
 * Emits structured logger events and metrics
 */
export async function withRetryAndTimeout<T>(
  fn: () => Promise<T>,
  options: ResilienceOptions,
  provider: string
): Promise<T> {
  const startedAt = Date.now()
  let lastError: Error | null = null
  let timeoutOccurred = false

  for (let attempt = 1; attempt <= options.maxRetries; attempt++) {
    try {
      // AUD-PIPE-002: REAL timeout. Previously this was a no-op `setTimeout(()=>{})`
      // so a hung provider stalled the whole enrichment batch. withTimeout (canonical,
      // from retry.ts) races fn() against the policy and rejects on overrun.
      const result = await withTimeout(
        fn(),
        options.timeout,
        `timeout: ${provider} exceeded ${options.timeout}ms`,
      )

      // Success: emit metric
      metricsCollector.emit({
        event: 'provider_metric',
        provider,
        retry_count: attempt - 1,
        timeout_occurred: false,
        success: true,
        duration_ms: Date.now() - startedAt,
      })

      return result
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))

      // Check if this was a timeout (case-insensitive)
      if (error.name === 'AbortError' || error.message.toLowerCase().includes('timeout')) {
        timeoutOccurred = true
      }

      lastError = error
      const isRetryable = isRetryableError(error, options.retryableErrors)

      logger.warn('external_call_retry', {
        provider,
        attempt,
        max_retries: options.maxRetries,
        error: error.message,
        is_retryable: isRetryable,
        duration_ms: Date.now() - startedAt,
      })

      // Check if this error is non-retryable or if we're on final attempt
      if (!isRetryable || attempt === options.maxRetries) {
        // Non-retryable error or final attempt failed
        metricsCollector.emit({
          event: 'provider_metric',
          provider,
          retry_count: attempt - 1,
          timeout_occurred: timeoutOccurred,
          success: false,
          duration_ms: Date.now() - startedAt,
          error_code: (error as any).code?.toString(),
        })

        if (timeoutOccurred) {
          logger.warn('external_call_timeout', {
            provider,
            timeout_ms: options.timeout,
            attempts: attempt,
            duration_ms: Date.now() - startedAt,
          })
        } else {
          logger.error('external_call_failed', error, {
            provider,
            attempts: attempt,
            duration_ms: Date.now() - startedAt,
            is_retryable: isRetryable,
          })
        }

        throw error
      }

      // Retryable error and not final attempt - calculate backoff
      const delayMs = calculateBackoff(attempt, options.backoff)
      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs))
      }
    }
  }

  // Should not reach here, but just in case
  throw lastError || new Error(`${provider} call failed after ${options.maxRetries} attempts`)
}
