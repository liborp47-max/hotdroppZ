/**
 * Enrichment pipeline resilience contract tests
 * Verify retry, timeout, and telemetry behavior
 */

import assert from 'node:assert/strict'
import test from 'node:test'
import { withRetryAndTimeout, metricsCollector } from '../lib/utils/resilience.ts'
import { getProviderPolicy } from '../lib/config/provider-policies.ts'

// Helper to simulate a function that fails with various errors
function createFailingFn(error: Error, maxAttempts = 1) {
  let attempt = 0
  return async () => {
    attempt++
    if (attempt <= maxAttempts) {
      throw error
    }
    return { success: true }
  }
}

// Helper to simulate a timeout
function createTimeoutFn(delayMs: number) {
  return async () => {
    await new Promise((resolve) => setTimeout(resolve, delayMs))
    throw new Error('Timeout')
  }
}

test('withRetryAndTimeout retries on transient errors', async () => {
  const policy = getProviderPolicy('spotify')
  let attempts = 0

  const fn = async () => {
    attempts++
    if (attempts === 1) {
      throw new Error('timeout: connection reset')
    }
    return { data: 'success' }
  }

  metricsCollector.clear()
  const result = await withRetryAndTimeout(fn, policy, 'spotify')

  assert.equal(result.data, 'success')
  assert.equal(attempts, 2)

  const metrics = metricsCollector.getMetrics()
  assert.equal(metrics.length, 1)
  assert.equal(metrics[0].success, true)
  assert.equal(metrics[0].retry_count, 1)
  assert.equal(metrics[0].timeout_occurred, false)
})

test('withRetryAndTimeout fails after max retries exhausted', async () => {
  const policy = getProviderPolicy('spotify')
  let attempts = 0

  const fn = async () => {
    attempts++
    throw new Error('ECONNRESET')
  }

  metricsCollector.clear()

  try {
    await withRetryAndTimeout(fn, policy, 'spotify')
    assert.fail('Should have thrown')
  } catch (err) {
    assert.ok(err instanceof Error)
    assert.match(err.message, /ECONNRESET/)
  }

  assert.equal(attempts, policy.maxRetries)

  const metrics = metricsCollector.getMetrics()
  assert.equal(metrics.length, 1)
  assert.equal(metrics[0].success, false)
  assert.equal(metrics[0].retry_count, policy.maxRetries - 1)
})

test('withRetryAndTimeout does not retry on non-retryable errors', async () => {
  const policy = getProviderPolicy('spotify')
  let attempts = 0

  const fn = async () => {
    attempts++
    throw new Error('401 Unauthorized')
  }

  metricsCollector.clear()

  try {
    await withRetryAndTimeout(fn, policy, 'spotify')
    assert.fail('Should have thrown')
  } catch (err) {
    assert.ok(err instanceof Error)
  }

  assert.equal(attempts, 1) // Only one attempt for non-retryable error

  const metrics = metricsCollector.getMetrics()
  assert.equal(metrics.length, 1)
  assert.equal(metrics[0].success, false)
  assert.equal(metrics[0].retry_count, 0)
})

test('withRetryAndTimeout detects timeout and emits metric', async () => {
  const policy = {
    timeout: 100, // 100ms
    maxRetries: 1,
    backoff: 'exponential' as const,
    retryableErrors: ['timeout'],
  }

  const fn = createTimeoutFn(500) // 500ms delay > 100ms timeout

  metricsCollector.clear()

  try {
    await withRetryAndTimeout(fn, policy, 'spotify')
    assert.fail('Should have thrown')
  } catch (err) {
    // Expected
  }

  const metrics = metricsCollector.getMetrics()
  assert.equal(metrics.length, 1)
  assert.equal(metrics[0].timeout_occurred, true)
  assert.equal(metrics[0].success, false)
})

test('AUD-PIPE-002: a never-resolving fn is actually timed out (not hung forever)', async () => {
  const policy = {
    timeout: 80, // 80ms
    maxRetries: 1,
    backoff: 'none' as const,
    retryableErrors: ['timeout'],
  }
  // Hangs forever — the OLD no-op setTimeout would never reject and stall the batch.
  const fn = () => new Promise<never>(() => {})

  const startedAt = Date.now()
  await assert.rejects(
    () => withRetryAndTimeout(fn, policy, 'spotify'),
    /timeout/i,
    'wrapper must enforce the timeout',
  )
  const elapsed = Date.now() - startedAt
  assert.ok(elapsed < 2000, `should reject quickly via timeout, took ${elapsed}ms`)
})

test('withRetryAndTimeout emits per-provider metrics', async () => {
  const policy = getProviderPolicy('youtube')
  const fn = async () => ({ data: 'success' })

  metricsCollector.clear()
  await withRetryAndTimeout(fn, policy, 'youtube')

  const metrics = metricsCollector.getMetrics()
  assert.equal(metrics[0].provider, 'youtube')
  assert.equal(metrics[0].event, 'provider_metric')
  assert.ok(typeof metrics[0].duration_ms === 'number')
})

test('getProviderPolicy returns correct timeout per provider', () => {
  const spotifyPolicy = getProviderPolicy('spotify')
  const youtubePolicy = getProviderPolicy('youtube')
  const geniusPolicy = getProviderPolicy('genius')

  assert.equal(spotifyPolicy.timeout, 5000)
  assert.equal(youtubePolicy.timeout, 8000)
  assert.equal(geniusPolicy.timeout, 3000)
})

test('backoff strategies calculate correct delays', async () => {
  // Test exponential backoff
  const expPolicy = {
    timeout: 10000,
    maxRetries: 3,
    backoff: 'exponential' as const,
    retryableErrors: ['timeout'],
  }

  let attempts = 0
  const fn = async () => {
    attempts++
    if (attempts < 3) {
      throw new Error('timeout: retry me')
    }
    return { success: true }
  }

  const startTime = Date.now()
  await withRetryAndTimeout(fn, expPolicy, 'test')
  const duration = Date.now() - startTime

  // Exponential: 500ms, 1s = ~1500ms total
  assert.ok(duration >= 500, `Actual duration: ${duration}ms`)
})
