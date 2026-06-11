'use client'

import { useCallback, useState } from 'react'
import { AlertTriangle, Check, Loader2, Lightbulb, Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { BrainstormResponse, BrainstormSuggestion } from '@/lib/hd-central/brainstorm'
import type { Priority } from '@/lib/hd-central/types'

function priorityBadgeClass(p: Priority): string {
  if (p === 'P0') return 'border-red-500/35 bg-red-500/12 text-red-300'
  if (p === 'P1') return 'border-amber-500/35 bg-amber-500/12 text-amber-300'
  if (p === 'P2') return 'border-blue-500/35 bg-blue-500/12 text-blue-300'
  return 'border-white/15 bg-white/[0.05] text-[#D0D0D0]'
}

const COMPLEXITY_LABEL: Record<string, string> = { S: 'S', M: 'M', L: 'L', XL: 'XL' }

export function BrainstormingEngine() {
  const [response, setResponse] = useState<BrainstormResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [acceptingId, setAcceptingId] = useState<string | null>(null)
  const [accepted, setAccepted] = useState<string[]>([])

  const generate = useCallback(async () => {
    setLoading(true)
    setError(null)
    setAccepted([])
    try {
      const res = await fetch('/api/hd-central/brainstorm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: 5 }),
      })
      if (!res.ok) {
        setError('Generování selhalo - API vrátilo chybu.')
        return
      }
      const data = (await res.json()) as BrainstormResponse
      setResponse(data)
    } catch {
      setError('Generování selhalo - síťová chyba.')
    } finally {
      setLoading(false)
    }
  }, [])

  const accept = useCallback(async (suggestion: BrainstormSuggestion) => {
    setAcceptingId(suggestion.id)
    setError(null)
    try {
      const res = await fetch('/api/hd-central/brainstorm/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suggestion }),
      })
      if (!res.ok) {
        setError(`Přidání "${suggestion.title}" do backlogu selhalo.`)
        return
      }
      // Suggestion accepted - drop it from the visible list.
      setResponse((prev) =>
        prev
          ? { ...prev, suggestions: prev.suggestions.filter((s) => s.id !== suggestion.id) }
          : prev,
      )
      setAccepted((prev) => [...prev, suggestion.title])
    } catch {
      setError(`Přidání "${suggestion.title}" do backlogu selhalo - síťová chyba.`)
    } finally {
      setAcceptingId(null)
    }
  }, [])

  const suggestions = response?.suggestions ?? []
  const hasGenerated = response !== null

  return (
    <div className="space-y-4 p-4 md:p-6">
      {/* Header */}
      <section className="plastic-card-hi flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-[#00E085]">CEO / Brainstorming</p>
          <h1 className="text-lg font-light uppercase tracking-[2px] text-[#f0f0f0]">Brainstorming Engine</h1>
          <p className="mt-1 text-[11px] text-[#A8A8A8]">
            AI návrhy upgradu filtrované podle Primary Mission a aktuálního plánu backlogu.
          </p>
        </div>
        <Button
          onClick={() => void generate()}
          disabled={loading}
          size="sm"
          aria-label="Vygenerovat návrhy"
          className="h-9 gap-2 text-xs bg-[rgba(0,224,133,0.18)] text-[#1AEE99] border border-[rgba(0,224,133,0.45)] hover:bg-[rgba(0,224,133,0.30)] disabled:opacity-40"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          {loading ? 'Generuji...' : 'Vygenerovat návrhy'}
        </Button>
      </section>

      {/* Status row */}
      {(error || response) && (
        <div className="flex flex-wrap items-center gap-3 text-xs">
          {response?.primaryMissionId && (
            <span className="text-[#A8A8A8]">
              Primary Mission: <span className="font-mono text-[#D0D0D0]">{response.primaryMissionId}</span>
            </span>
          )}
          {response && !response.primaryMissionId && (
            <span className="text-[#6E6E6E]">Žádná ACTIVE mise - zobrazuji základní návrhy.</span>
          )}
          {response && <span className="text-[#6E6E6E]">model: {response.model}</span>}
          {error && <span className="text-red-300">{error}</span>}
        </div>
      )}

      {/* Degraded banner */}
      {response?.degraded && (
        <div
          role="status"
          className="plastic-card flex items-center gap-2 border-amber-500/30 bg-amber-500/[0.06] px-4 py-2.5 text-xs text-amber-300"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
          AI volání selhalo nebo nevrátilo návrhy - zobrazuji rule-based návrhy (degraded mode).
        </div>
      )}

      {/* Accepted toast list */}
      {accepted.length > 0 && (
        <div className="plastic-card flex flex-wrap items-center gap-2 border-emerald-500/25 bg-[rgba(0,224,133,0.05)] px-4 py-2.5 text-xs text-[#1AEE99]">
          <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
          {accepted.length} návrh{accepted.length === 1 ? '' : 'ů'} přidáno do backlogu (CEO Missions inbox).
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <section className="plastic-card flex items-center justify-center gap-3 px-4 py-12 text-sm text-[#6E6E6E]">
          <Loader2 className="h-4 w-4 animate-spin text-[#00E085]" />
          AI generuje kandidátní mise - může to pár sekund trvat.
        </section>
      )}

      {/* Empty state - never generated */}
      {!loading && !hasGenerated && (
        <section className="plastic-card flex flex-col items-center gap-2 px-4 py-12 text-center">
          <Lightbulb className="h-6 w-6 text-[#404040]" aria-hidden="true" />
          <p className="text-sm text-[#6E6E6E]">
            Ještě nejsou žádné návrhy. Spusť generování kandidátních misí.
          </p>
        </section>
      )}

      {/* Empty state - generated, nothing left */}
      {!loading && hasGenerated && suggestions.length === 0 && (
        <section className="plastic-card flex flex-col items-center gap-2 px-4 py-12 text-center">
          <Check className="h-6 w-6 text-[#404040]" aria-hidden="true" />
          <p className="text-sm text-[#6E6E6E]">
            Žádné návrhy k zobrazení. Všechny byly přidány do backlogu nebo AI nic nenavrhlo.
          </p>
        </section>
      )}

      {/* Suggestion cards */}
      {!loading && suggestions.length > 0 && (
        <section className="grid gap-3 md:grid-cols-2">
          {suggestions.map((s) => (
            <article key={s.id} className="plastic-card flex flex-col gap-3 px-4 py-3.5">
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-sm font-medium text-[#E8E8E8]">{s.title}</h2>
                <Badge className={`shrink-0 text-[10px] px-1.5 py-0 ${priorityBadgeClass(s.suggestedPriority)}`}>
                  {s.suggestedPriority}
                </Badge>
              </div>

              <p className="text-xs leading-relaxed text-[#A8A8A8]">{s.rationale}</p>

              <div className="flex flex-wrap items-center gap-1.5">
                <Badge className="text-[10px] px-1.5 py-0 border-indigo-500/30 bg-indigo-500/10 text-indigo-300">
                  {s.suggestedPhase}
                </Badge>
                <Badge className="text-[10px] px-1.5 py-0 border-white/15 bg-white/[0.05] text-[#D0D0D0]">
                  {COMPLEXITY_LABEL[s.estimatedComplexity] ?? s.estimatedComplexity}
                </Badge>
                {s.domains.map((d) => (
                  <Badge
                    key={d}
                    className="text-[10px] px-1.5 py-0 border-emerald-500/25 bg-[rgba(0,224,133,0.08)] text-[#6EC3A1]"
                  >
                    {d}
                  </Badge>
                ))}
              </div>

              <p className="border-l-2 border-[rgba(0,224,133,0.4)] pl-2.5 text-[11px] italic text-[#6EC3A1]">
                {s.relevanceToActive}
              </p>

              <Button
                onClick={() => void accept(s)}
                disabled={acceptingId !== null}
                size="sm"
                aria-label={`Přidat ${s.title} do backlogu`}
                className="mt-auto h-8 gap-1.5 text-xs bg-[rgba(0,224,133,0.10)] text-[#00E085] border border-[rgba(0,224,133,0.30)] hover:bg-[rgba(0,224,133,0.22)] disabled:opacity-40"
              >
                {acceptingId === s.id ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Check className="h-3 w-3" />
                )}
                Přidat do backlogu
              </Button>
            </article>
          ))}
        </section>
      )}
    </div>
  )
}
