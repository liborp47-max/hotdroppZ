'use client'

import { forwardRef, useCallback, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  Loader2,
  Play,
  Wand2,
} from 'lucide-react'
import type { SubMission, SubMissionStatus } from '@/lib/hd-central/types'
import { InfoBadge } from '@/components/info/info-badge'
import { PromptDialog } from '@/components/ceo/prompt-dialog'
import { cn } from '@/lib/utils'

interface SubMissionRowProps {
  missionId: string
  missionName: string
  sub: SubMission
  index: number
  selected: boolean
  onSelect: () => void
}

interface SubPromptResponse {
  output: string
  qualityScore?: number
  owner?: string
}

export const SubMissionRow = forwardRef<HTMLLIElement, SubMissionRowProps>(
  function SubMissionRow({ missionId, missionName, sub, index, selected, onSelect }, ref) {
    const [busy, setBusy] = useState<'solve' | 'prompt' | 'done' | null>(null)
    const [promptOpen, setPromptOpen] = useState(false)
    const [promptResp, setPromptResp] = useState<SubPromptResponse | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [localStatus, setLocalStatus] = useState<SubMissionStatus | null>(null)
    const status: SubMissionStatus = localStatus ?? sub.status ?? 'todo'
    const numLabel = `#${String(index + 1).padStart(2, '0')}`

    const handleSolve = useCallback(
      async (e: React.MouseEvent) => {
        e.stopPropagation()
        setBusy('solve')
        setError(null)
        try {
          const res = await fetch(
            `/api/hd-central/mission/${encodeURIComponent(missionId)}/submission/${encodeURIComponent(sub.id)}/solve`,
            { method: 'POST' },
          )
          if (!res.ok) setError(`Solve failed (${res.status})`)
        } catch (err) {
          setError(`Solve error: ${err instanceof Error ? err.message : String(err)}`)
        } finally {
          setBusy(null)
        }
      },
      [missionId, sub.id],
    )

    const handlePrompt = useCallback(
      async (e: React.MouseEvent) => {
        e.stopPropagation()
        setBusy('prompt')
        setPromptOpen(true)
        setPromptResp(null)
        setError(null)
        try {
          const res = await fetch(
            `/api/hd-central/mission/${encodeURIComponent(missionId)}/submission/${encodeURIComponent(sub.id)}/prompt`,
            { method: 'POST' },
          )
          if (!res.ok) {
            setPromptResp({ output: `Error ${res.status}: ${await res.text()}` })
          } else {
            const data = (await res.json()) as SubPromptResponse
            setPromptResp(data)
          }
        } catch (err) {
          setPromptResp({
            output: `Network error: ${err instanceof Error ? err.message : String(err)}`,
          })
        } finally {
          setBusy(null)
        }
      },
      [missionId, sub.id],
    )

    const handleDone = useCallback(
      async (e: React.MouseEvent) => {
        e.stopPropagation()
        setBusy('done')
        setError(null)
        try {
          const res = await fetch(
            `/api/hd-central/mission/${encodeURIComponent(missionId)}/submission/${encodeURIComponent(sub.id)}`,
            {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ status: 'done', actor: 'CEO' }),
            },
          )
          if (!res.ok) {
            setError(`Mark done failed (${res.status})`)
          } else {
            setLocalStatus('done')
          }
        } catch (err) {
          setError(`Mark done error: ${err instanceof Error ? err.message : String(err)}`)
        } finally {
          setBusy(null)
        }
      },
      [missionId, sub.id],
    )

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLLIElement>) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect()
        }
      },
      [onSelect],
    )

    return (
      <>
        <li
          ref={ref}
          id={`sub-${sub.id}`}
          role="option"
          aria-selected={selected}
          tabIndex={selected ? 0 : -1}
          onClick={onSelect}
          onKeyDown={handleKeyDown}
          data-sub-row
          data-sub-id={sub.id}
          className={cn(
            'flex cursor-pointer items-center gap-2 px-3 py-2 text-[11px] transition-colors',
            'border-l-4 focus:outline-none',
            selected
              ? 'border-l-[#00E085] bg-[rgba(0,224,133,0.06)]'
              : 'border-l-transparent hover:bg-white/[0.03]',
          )}
        >
          <span className="w-8 shrink-0 font-mono text-[10px] text-[#6E6E6E]">{numLabel}</span>
          <StatusIcon status={status} />
          <span className="min-w-0 flex-1 truncate text-[#D0D0D0]">{sub.name}</span>
          <InfoBadge term={`sub-status-${status}`} noFocus>
            <span className="plastic-chip px-1.5 py-0.5 text-[9px] uppercase tracking-widest text-[#A8A8A8]">
              {status.replace('_', ' ')}
            </span>
          </InfoBadge>
          {sub.owner && (
            <span className="hidden font-mono text-[10px] text-[#1AEE99] sm:inline">
              @{sub.owner}
            </span>
          )}
          <button
            type="button"
            onClick={handleSolve}
            onMouseDown={(e) => e.stopPropagation()}
            disabled={busy !== null || status === 'done'}
            aria-label={`Run sub-mission ${sub.name}`}
            aria-busy={busy === 'solve' ? true : undefined}
            className="plastic-button inline-flex h-9 items-center gap-1 px-2.5 text-[10px] font-bold uppercase tracking-widest text-[#00B4FF] disabled:opacity-40"
            style={{ borderColor: 'rgba(0, 180, 255, 0.35)' }}
          >
            <Play aria-hidden className="h-3 w-3" />
            {busy === 'solve' ? '…' : 'Go'}
          </button>
          <button
            type="button"
            onClick={handlePrompt}
            onMouseDown={(e) => e.stopPropagation()}
            disabled={busy !== null}
            aria-label={`Generate prompt for sub-mission ${sub.name}`}
            aria-busy={busy === 'prompt' ? true : undefined}
            className="plastic-button inline-flex h-9 items-center gap-1 px-2.5 text-[10px] font-bold uppercase tracking-widest disabled:opacity-40"
          >
            <Wand2 aria-hidden className="h-3 w-3 text-[#00B4FF]" />
            {busy === 'prompt' ? '…' : 'Prompt'}
          </button>
          <button
            type="button"
            onClick={handleDone}
            onMouseDown={(e) => e.stopPropagation()}
            disabled={busy !== null || status === 'done'}
            aria-label={`Mark sub-mission ${sub.name} as done`}
            aria-busy={busy === 'done' ? true : undefined}
            className="plastic-button inline-flex h-9 items-center gap-1 px-2.5 text-[10px] font-bold uppercase tracking-widest text-[#00E085] disabled:opacity-40"
            style={{ borderColor: 'rgba(0, 224, 133, 0.35)' }}
          >
            <CheckCircle2 aria-hidden className="h-3 w-3" />
            {busy === 'done' ? '…' : status === 'done' ? 'Done' : 'OK'}
          </button>
        </li>
        {error && (
          <li
            aria-live="polite"
            className="px-3 pb-1 text-[10px] font-mono text-[#FF6B6B]"
          >
            {error}
          </li>
        )}
        <PromptDialog
          open={promptOpen}
          onClose={() => setPromptOpen(false)}
          title={`${missionName} / ${sub.name}`}
          subtitle={`${missionId} · #${sub.id}`}
          prompt={promptResp?.output ?? null}
          loading={busy === 'prompt' && promptResp === null}
          qualityScore={promptResp?.qualityScore}
          owner={promptResp?.owner ?? sub.owner}
        />
      </>
    )
  },
)

function StatusIcon({ status }: { status: SubMissionStatus }) {
  switch (status) {
    case 'done':
      return <CheckCircle2 aria-hidden className="h-3.5 w-3.5 shrink-0 text-[#00E085]" />
    case 'in_progress':
      return (
        <Loader2 aria-hidden className="h-3.5 w-3.5 shrink-0 motion-safe:animate-spin text-[#F59E0B]" />
      )
    case 'blocked':
      return <AlertTriangle aria-hidden className="h-3.5 w-3.5 shrink-0 text-[#FF6B6B]" />
    case 'todo':
    default:
      return <Circle aria-hidden className="h-3.5 w-3.5 shrink-0 text-[#6E6E6E]" />
  }
}
