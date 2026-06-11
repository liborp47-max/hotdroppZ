'use client'

import { useState } from 'react'
import { detectContentType } from '@/lib/services/content-type-detector'
import type { ContentAnalysis } from '@/lib/services/content-type-detector'

interface ClusterPreview {
  id: string
  category?: string | null
  title?: string
  main_entity?: string
}

type FactoryMode = 'v2' | 'v1'

export function FactoryDashboard() {
  const [mode, setMode] = useState<FactoryMode>('v2')
  const [clusterId, setClusterId] = useState('')
  const [clusterData, setClusterData] = useState<ClusterPreview | null>(null)
  const [analysis, setAnalysis] = useState<ContentAnalysis | null>(null)
  const [skipEnrichment, setSkipEnrichment] = useState(false)
  const [skipCreator, setSkipCreator] = useState(false)
  const [loading, setLoading] = useState(false)
  const [running, setRunning] = useState(false)
  const [docsLoading, setDocsLoading] = useState(false)
  const [result, setResult] = useState<unknown>(null)
  const [endpointDocs, setEndpointDocs] = useState<unknown>(null)
  const [error, setError] = useState<string | null>(null)

  const endpoint = mode === 'v2' ? '/api/factory/orchestrate' : '/api/factory/coordinate'

  const requestPayload = {
    clusterId,
    ...(mode === 'v1' ? { contentTypeHint: analysis?.contentType } : {}),
    skipEnrichment,
    skipCreator,
  }

  // Fetch cluster data and analyze
  const handleAnalyze = async () => {
    if (!clusterId.trim()) {
      setError('Please enter a cluster ID')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/clusters/${clusterId}`)
      if (!res.ok) throw new Error('Cluster not found')

      const cluster = await res.json()
      setClusterData(cluster)

      // Run content-type detection
      const analysis = detectContentType({
        category: cluster.category,
        title: cluster.title,
        main_entity: cluster.main_entity,
        merged_context: cluster.merged_context,
      })

      setAnalysis(analysis)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load cluster')
      setClusterData(null)
      setAnalysis(null)
    } finally {
      setLoading(false)
    }
  }

  // Run Factory coordinator
  const handleRun = async () => {
    if (!clusterId.trim()) {
      setError('Please enter a cluster ID')
      return
    }

    setRunning(true)
    setError(null)

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestPayload),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Factory coordination failed')
      }

      const result = await res.json()
      setResult(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Factory run failed')
    } finally {
      setRunning(false)
    }
  }

  const handleLoadDocs = async () => {
    setDocsLoading(true)
    setError(null)
    try {
      const res = await fetch(endpoint)
      const json = await res.json()
      if (!res.ok) throw new Error((json as { error?: string }).error || 'Failed to load endpoint docs')
      setEndpointDocs(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load endpoint docs')
      setEndpointDocs(null)
    } finally {
      setDocsLoading(false)
    }
  }

  const steps = extractSteps(result)
  const outputLinks = extractOutputLinks(result)

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-[#E8E8E8]">Factory Debug Console</h1>
        <p className="text-[#A8A8A8] mt-2">
          Debug orchestration with fully expandable Input Data and Output Data.
        </p>
      </div>

      {/* Config */}
      <div className="rounded-xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-[#A8A8A8]">Factory Mode</label>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as FactoryMode)}
              disabled={loading || running || docsLoading}
              className="mt-2 w-full border border-white/15 bg-black px-3 py-2 text-sm text-[#E8E8E8]"
            >
              <option value="v2">V2 Symbiotic (/api/factory/orchestrate)</option>
              <option value="v1">V1 Coordinator (/api/factory/coordinate)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-[#A8A8A8]">Cluster ID</label>
            <input
              type="text"
              value={clusterId}
              onChange={(e) => setClusterId(e.target.value)}
              placeholder="550e8400-e29b-41d4-a716-446655440000"
              className="mt-2 w-full border border-white/15 bg-black px-3 py-2 text-sm text-[#E8E8E8]"
              disabled={loading || running}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="flex items-center gap-3 border border-white/10 bg-black px-3 py-2 text-sm text-[#D0D0D0]">
            <input
              type="checkbox"
              checked={skipEnrichment}
              onChange={(e) => setSkipEnrichment(e.target.checked)}
              disabled={running}
              className="h-4 w-4"
            />
            Skip enrichment
          </label>
          <label className="flex items-center gap-3 border border-white/10 bg-black px-3 py-2 text-sm text-[#D0D0D0]">
            <input
              type="checkbox"
              checked={skipCreator}
              onChange={(e) => setSkipCreator(e.target.checked)}
              disabled={running}
              className="h-4 w-4"
            />
            Skip creator
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <button
            onClick={handleAnalyze}
            disabled={loading || running || !clusterId.trim()}
            className="px-4 py-2 text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Analyzing...' : 'Analyze Cluster'}
          </button>
          <button
            onClick={handleLoadDocs}
            disabled={docsLoading}
            className="px-4 py-2 text-sm font-semibold bg-white/[0.05] text-[#E8E8E8] hover:bg-white/[0.08] disabled:opacity-50"
          >
            {docsLoading ? 'Loading docs...' : 'Load Endpoint Docs'}
          </button>
          <button
            onClick={handleRun}
            disabled={running || !clusterId.trim()}
            className="px-4 py-2 text-sm font-semibold bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
          >
            {running ? 'Running Factory...' : `Run ${mode.toUpperCase()} Factory`}
          </button>
        </div>

        {error && (
          <div className="p-3 border border-red-500/30 bg-red-500/10 text-sm text-red-300">
            {error}
          </div>
        )}
      </div>

      <Expandable title="Input Data" defaultOpen>
        <div className="space-y-4">
          <SectionLabel>Request Payload ({endpoint})</SectionLabel>
          <CodeBlock value={requestPayload} />

          <SectionLabel>Cluster Snapshot</SectionLabel>
          <CodeBlock value={clusterData ?? { info: 'Run Analyze Cluster to load input from DB.' }} />

          <SectionLabel>Content Analysis</SectionLabel>
          <CodeBlock value={analysis ?? { info: 'Analysis not available yet.' }} />
        </div>
      </Expandable>

      <Expandable title="Output Data" defaultOpen>
        <div className="space-y-4">
          <SectionLabel>Summary</SectionLabel>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {extractSummary(result, mode).map((item) => (
              <div key={item.label} className="rounded-md border border-white/10 bg-black px-3 py-2">
                <div className="text-xs text-[#A8A8A8] uppercase">{item.label}</div>
                <div className="text-sm font-semibold text-[#E8E8E8] mt-1">{item.value}</div>
              </div>
            ))}
          </div>

          <SectionLabel>Stages / Steps</SectionLabel>
          <div className="space-y-2">
            {steps.length === 0 && (
              <div className="text-sm text-[#A8A8A8]">No step output yet. Run Factory to populate data.</div>
            )}
            {steps.map((step, idx) => (
              <details key={`${step.name}-${idx}`} className="rounded-md border border-white/10 bg-black/60">
                <summary className="cursor-pointer list-none px-3 py-2 flex items-center justify-between text-sm text-[#E8E8E8]">
                  <span>{step.name}</span>
                  <span className="text-xs text-[#A8A8A8]">{step.status}</span>
                </summary>
                <div className="px-3 pb-3">
                  <CodeBlock value={step.payload} />
                </div>
              </details>
            ))}
          </div>

          {outputLinks.length > 0 && (
            <>
              <SectionLabel>Output Links</SectionLabel>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                {outputLinks.map((link) => (
                  <a
                    key={link.label}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-md border border-white/15 px-3 py-2 text-sm text-blue-300 hover:bg-white/[0.05]"
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            </>
          )}

          <SectionLabel>Raw Response JSON</SectionLabel>
          <CodeBlock value={result ?? { info: 'No output yet.' }} />
        </div>
      </Expandable>

      <Expandable title="Endpoint Debug Docs (GET)">
        <CodeBlock value={endpointDocs ?? { info: 'Click Load Endpoint Docs to inspect GET documentation payload.' }} />
      </Expandable>
    </div>
  )
}

function Expandable({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  return (
    <details className="rounded-xl border border-white/10 bg-white/[0.03] backdrop-blur-md" open={defaultOpen}>
      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-[#E8E8E8] border-b border-white/10">
        {title}
      </summary>
      <div className="p-4">{children}</div>
    </details>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-xs font-semibold uppercase tracking-wide text-[#A8A8A8]">{children}</div>
}

function CodeBlock({ value }: { value: unknown }) {
  return (
    <pre className="overflow-x-auto border border-white/10 bg-black/40 p-3 text-xs text-[#D0D0D0]">
      {JSON.stringify(value, null, 2)}
    </pre>
  )
}

function extractSummary(result: unknown, mode: FactoryMode): Array<{ label: string; value: string }> {
  if (!result || typeof result !== 'object') {
    return [{ label: 'Status', value: 'No run output' }]
  }

  const r = result as Record<string, unknown>
  const status = String(r.status ?? 'unknown')
  const runId = String(r.id ?? '-')
  const totalMs = String(r.totalProcessingMs ?? '-')

  if (mode === 'v1') {
    const summary = (r.summary as Record<string, unknown> | undefined) ?? {}
    return [
      { label: 'Mode', value: 'V1 Coordinator' },
      { label: 'Status', value: status },
      { label: 'Run ID', value: runId },
      { label: 'Content Type', value: String(r.contentType ?? '-') },
      { label: 'Articles', value: String(summary.articlesGenerated ?? 0) },
      { label: 'Graphics', value: String(summary.graphicsCreated ?? 0) },
      { label: 'Total ms', value: totalMs },
    ]
  }

  return [
    { label: 'Mode', value: 'V2 Symbiotic' },
    { label: 'Status', value: status },
    { label: 'Run ID', value: runId },
    { label: 'Template Type', value: String(r.templateType ?? '-') },
    { label: 'Template ID', value: String(r.templateId ?? '-') },
    { label: 'Total ms', value: totalMs },
  ]
}

function extractSteps(result: unknown): Array<{ name: string; status: string; payload: unknown }> {
  if (!result || typeof result !== 'object') return []
  const r = result as Record<string, unknown>

  const v1Steps = r.steps
  if (Array.isArray(v1Steps)) {
    return v1Steps.map((step, idx) => {
      const s = (step as Record<string, unknown>) ?? {}
      return {
        name: String(s.step ?? `step_${idx}`),
        status: String(s.status ?? 'unknown'),
        payload: s,
      }
    })
  }

  const stages = r.stages
  if (stages && typeof stages === 'object') {
    return Object.entries(stages as Record<string, unknown>).map(([name, payload]) => {
      const p = (payload as Record<string, unknown>) ?? {}
      return {
        name,
        status: String(p.status ?? 'unknown'),
        payload,
      }
    })
  }

  return []
}

function extractOutputLinks(result: unknown): Array<{ label: string; url: string }> {
  if (!result || typeof result !== 'object') return []
  const r = result as Record<string, unknown>
  const urls = r.outputUrls
  if (!urls || typeof urls !== 'object') return []

  const entries = Object.entries(urls as Record<string, unknown>)
    .filter(([, url]) => typeof url === 'string' && url.length > 0)
    .map(([label, url]) => ({ label, url: String(url) }))

  return entries
}
