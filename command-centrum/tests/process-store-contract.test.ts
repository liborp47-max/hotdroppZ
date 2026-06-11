import assert from 'node:assert/strict'
import test from 'node:test'

import { getState, resetProcess, startRun } from '../lib/stores/process-store'

type MockHeaders = {
  get(name: string): string | null
}

type MockResponse = {
  status: number
  headers: MockHeaders
  json(): Promise<unknown>
  body?: null
}

function jsonResponse(payload: unknown, status: number = 200, contentType: string = 'application/json'): MockResponse {
  return {
    status,
    headers: {
      get(name: string) {
        return name.toLowerCase() === 'content-type' ? contentType : null
      },
    },
    async json() {
      return payload
    },
    body: null,
  }
}

async function flushAsyncWork() {
  await new Promise((resolve) => setTimeout(resolve, 0))
  await new Promise((resolve) => setTimeout(resolve, 0))
}

test('startRun handles JSON success response and persists completed run with correlation id', async () => {
  resetProcess()
  const originalFetch = globalThis.fetch
  const saveBodies: Array<Record<string, unknown>> = []

  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input)

    if (url === '/api/scout/run') {
      return jsonResponse({
        success: true,
        data: {
          correlation_id: 'run-json-1',
          result: { itemsProcessed: 7 },
        },
      }) as unknown as Response
    }

    if (url.startsWith('/api/pipeline/step-data')) {
      return jsonResponse({
        items: [
          {
            id: 's1',
            title: 'Signal 1',
            source: 'rss',
            category: 'news',
            url: 'https://example.test/s1',
            attention_score: 7,
            created_at: '2026-05-15T08:00:00.000Z',
          },
        ],
      }) as unknown as Response
    }

    if (url === '/api/pipeline/runs/save') {
      saveBodies.push(JSON.parse(String(init?.body ?? '{}')))
      return jsonResponse({ ok: true }) as unknown as Response
    }

    throw new Error(`Unexpected fetch: ${url}`)
  }) as typeof fetch

  try {
    await startRun()
    await flushAsyncWork()

    const state = getState()
    assert.equal(state.isRunning, false)
    assert.equal(state.runId, 'run-json-1')
    assert.equal(state.steps.scout.status, 'done')
    assert.equal(state.result?.itemsFound, 7)
    assert.equal(saveBodies.length, 1)
    assert.equal(saveBodies[0]?.status, 'completed')
    assert.equal(saveBodies[0]?.runId, 'run-json-1')
  } finally {
    globalThis.fetch = originalFetch
    resetProcess()
  }
})

test('startRun maps degraded JSON response to error state and persists error run', async () => {
  resetProcess()
  const originalFetch = globalThis.fetch
  const saveBodies: Array<Record<string, unknown>> = []

  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input)

    if (url === '/api/scout/run') {
      return jsonResponse({
        success: false,
        error: 'Scout stage trigger is blocked in production until full ingest/persistence implementation.',
        data: {
          stage: 'scout',
          stage_status: 'degraded',
          reason: 'Scout stage trigger is blocked in production until full ingest/persistence implementation.',
        },
      }, 503) as unknown as Response
    }

    if (url.startsWith('/api/pipeline/step-data')) {
      return jsonResponse({ items: [] }) as unknown as Response
    }

    if (url === '/api/pipeline/runs/save') {
      saveBodies.push(JSON.parse(String(init?.body ?? '{}')))
      return jsonResponse({ ok: true }) as unknown as Response
    }

    throw new Error(`Unexpected fetch: ${url}`)
  }) as typeof fetch

  try {
    await startRun()
    await flushAsyncWork()

    const state = getState()
    assert.equal(state.isRunning, false)
    assert.equal(state.steps.scout.status, 'error')
    assert.match(state.error ?? '', /blocked in production/i)
    assert.equal(state.result, null)
    assert.equal(saveBodies.length, 1)
    assert.equal(saveBodies[0]?.status, 'error')
    assert.match(String(saveBodies[0]?.errorMessage ?? ''), /blocked in production/i)
  } finally {
    globalThis.fetch = originalFetch
    resetProcess()
  }
})