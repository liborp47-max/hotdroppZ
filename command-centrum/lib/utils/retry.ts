/**
 * Retry mechanika s exponenciálním backoff
 * Zajišťuje resilience selhání sítě a přechodných chyb
 */

import { logger } from '../logger.ts'

export type RetryOptions = {
  maxRetries?: number
  initialDelayMs?: number
  maxDelayMs?: number
  timeoutMs?: number
  backoffMultiplier?: number
  shouldRetry?: (err: Error) => boolean
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  timeoutMs: 60000,
  backoffMultiplier: 2,
  shouldRetry: (err) => {
    // Retry on network/timeout errors, but not on 4xx client errors
    if (err.message.includes('timeout') || err.message.includes('network')) {
      return true
    }
    return false
  },
}

export class RetryError extends Error {
  // AUD-PIPE-002/AUD-CODE-001: plain fields, not constructor parameter properties —
  // the latter are unsupported by `node --experimental-strip-types` (the test runner).
  readonly originalError: Error
  readonly attempts: number
  constructor(originalError: Error, attempts: number, message: string = 'All retry attempts failed') {
    super(message)
    this.name = 'RetryError'
    this.originalError = originalError
    this.attempts = attempts
  }
}

/**
 * Execute function with retry logic
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= opts.maxRetries; attempt++) {
    try {
      const result = await Promise.race([
        fn(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Request timeout')), opts.timeoutMs)
        ),
      ])
      return result
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      lastError = error

      logger.debug(`Attempt ${attempt}/${opts.maxRetries} failed`, {
        error: error.message,
        shouldRetry: opts.shouldRetry(error),
      })

      if (attempt === opts.maxRetries || !opts.shouldRetry(error)) {
        throw new RetryError(error, attempt, `Failed after ${attempt} attempts: ${error.message}`)
      }

      // Exponential backoff
      const delayMs = Math.min(
        opts.initialDelayMs * Math.pow(opts.backoffMultiplier, attempt - 1),
        opts.maxDelayMs
      )

      logger.info(`Retrying in ${delayMs}ms`, { attempt, error: error.message })
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }

  throw new RetryError(
    lastError || new Error('Unknown error'),
    opts.maxRetries,
    `Failed after ${opts.maxRetries} attempts`
  )
}

/**
 * Timeout wrapper
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string = 'Operation timed out'
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs)
    ),
  ])
}

/**
 * Combined retry + timeout
 */
export async function withRetryAndTimeout<T>(
  fn: () => Promise<T>,
  options: RetryOptions & { timeoutMessage?: string } = {}
): Promise<T> {
  return withRetry(async () => {
    return withTimeout(fn(), options.timeoutMs || 60000, options.timeoutMessage)
  }, options)
}

/**
 * Fallback chain - try multiple functions until one succeeds
 */
export async function withFallback<T>(
  fns: Array<() => Promise<T>>,
  options: { timeoutMs?: number } = {}
): Promise<T> {
  const errors: Error[] = []

  for (let i = 0; i < fns.length; i++) {
    try {
      logger.debug(`Trying fallback ${i + 1}/${fns.length}`)
      return await withRetry(fns[i], { timeoutMs: options.timeoutMs })
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      errors.push(error)
      logger.warn(`Fallback ${i + 1} failed, trying next`, { error: error.message })
    }
  }

  const message = `All ${fns.length} fallbacks failed:\n${errors.map((e) => e.message).join('\n')}`
  throw new Error(message)
}
