'use client'

import { useCallback, useMemo } from 'react'
import { ArrowUpRight } from 'lucide-react'
import type { Mission, StageId } from '@/lib/hd-central/types'

interface PipelineLinkProps {
  mission: Mission
}

const ALL_STAGES: readonly StageId[] = [
  'scout',
  'filter',
  'translator',
  'curator',
  'cluster',
  'enrichment',
  'writer',
  'feed-engine',
  'multilang',
  'monetizer',
  'droppz-detector',
] as const

const ALL_STAGES_SET: ReadonlySet<string> = new Set(ALL_STAGES)

/**
 * Renders "Affects pipeline: [scout] [filter]" clickable chips.
 *
 * Stages are derived from `mission.modulePath` by scanning for any reference to
 * either `lib/pipeline/<name>.ts` (TypeScript pipeline modules) or
 * `ai/agents/<name>.py` (Python pipeline agents). Path separators (`/` or `\`)
 * are tolerated. Each matched `<name>` is validated against the canonical
 * StageId list, then deduplicated.
 *
 * `modulePath` may be a single path or a comma/semicolon/whitespace-separated
 * list — every chunk is scanned independently.
 *
 * Clicking a chip dispatches a `hd:focus-stage` CustomEvent picked up by
 * PipelineDiagram, which scrolls + flashes the matching node.
 */
export function PipelineLink({ mission }: PipelineLinkProps) {
  const stages = useMemo(() => deriveStages(mission.modulePath), [mission.modulePath])

  const focusStage = useCallback((stageId: StageId) => {
    if (typeof window === 'undefined') return
    try {
      window.dispatchEvent(
        new CustomEvent('hd:focus-stage', { detail: { stageId } }),
      )
    } catch (e) {
      // CustomEvent unsupported (very old runtime). No fallback — chips are best-effort UX.
      console.warn('[pipeline-link] dispatch failed', e)
    }
  }, [])

  if (stages.length === 0) return null

  return (
    <section
      className="flex flex-wrap items-center gap-2 px-1 text-[11px]"
      aria-label="Pipeline stages affected by this mission"
    >
      <span className="text-[10px] uppercase tracking-widest text-[#6E6E6E]">
        Affects pipeline:
      </span>
      {stages.map((stage) => (
        <button
          key={stage}
          type="button"
          onClick={() => focusStage(stage)}
          aria-label={`View ${stage} in pipeline`}
          className="plastic-chip inline-flex items-center gap-1 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-[#00B4FF] transition-colors hover:text-[#5DD6FF] focus:outline-2 focus:outline-[#00B4FF]/60"
          style={{ borderColor: 'rgba(0, 180, 255, 0.35)' }}
        >
          {stage}
          <ArrowUpRight aria-hidden className="h-3 w-3" />
        </button>
      ))}
    </section>
  )
}

/**
 * Extracts pipeline stage ids from a modulePath string.
 *
 * Generic regex covers both TS pipeline modules and Python agents:
 *   - `<…>/lib/pipeline/<name>.ts`
 *   - `<…>/ai/agents/<name>.py`
 *
 * Path separators may be `/` or `\`. The captured `<name>` is matched
 * case-insensitively against the canonical StageId list; unknown names
 * (e.g. agent helpers like `fact_checker.py`) are ignored.
 */
function deriveStages(modulePath?: string): StageId[] {
  if (!modulePath) return []
  // Split on comma/semicolon/whitespace runs to support multi-path module refs.
  const chunks = modulePath.split(/[,;\s]+/).filter(Boolean)
  const re = /(?:lib[\\/]pipeline|ai[\\/]agents)[\\/]([a-z][a-z0-9_-]*)\.(?:ts|py)/i
  const found = new Set<StageId>()
  for (const chunk of chunks) {
    const match = chunk.match(re)
    if (!match) continue
    const candidate = match[1].toLowerCase()
    if (ALL_STAGES_SET.has(candidate)) {
      found.add(candidate as StageId)
    }
  }
  return Array.from(found)
}
