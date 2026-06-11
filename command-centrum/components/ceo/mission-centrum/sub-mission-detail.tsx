'use client'

import { useMemo } from 'react'
import type { Mission, MissionAuditLogEvent, SubMission } from '@/lib/hd-central/types'
import { InfoBadge } from '@/components/info/info-badge'

interface SubMissionDetailProps {
  mission: Mission
  sub: SubMission
}

/**
 * Expanded detail view shown under the listbox for the currently selected sub-mission.
 *
 * Layout:
 *  1. Top meta strip: [mission-type badge] · created/parent metadata
 *  2. Three-box grid: Description | Why this matters | Status & owner
 *  3. Change history mini-timeline (last 8 entries; scrollable)
 */
export function SubMissionDetail({ mission, sub }: SubMissionDetailProps) {
  const missionType = useMemo(() => deriveMissionType(sub), [sub])
  const history = useMemo(() => extractHistory(mission, sub), [mission, sub])
  const status = sub.status ?? 'todo'

  return (
    <section className="flex flex-col gap-3" aria-label={`Detail for sub-mission ${sub.name}`}>
      {/* Top meta strip */}
      <div className="plastic-card-hi flex flex-wrap items-center gap-3 px-3 py-2 text-[10px] uppercase tracking-widest">
        <MissionTypeBadge type={missionType} />
        {sub.completedAt && (
          <>
            <span className="text-[#3A3A3A]">·</span>
            <span className="font-mono text-[#A8A8A8] normal-case tracking-normal">
              completed: {formatDate(sub.completedAt)}
            </span>
          </>
        )}
        <span className="text-[#3A3A3A]">·</span>
        <span className="font-mono text-[#6E6E6E] normal-case tracking-normal">
          parent: {mission.id}
        </span>
        <span className="text-[#3A3A3A]">·</span>
        <span className="font-mono text-[#6E6E6E] normal-case tracking-normal">
          sub: #{sub.id}
        </span>
      </div>

      {/* 3-box grid */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="plastic-card-hi p-3">
          <div className="section-title mb-2">Description</div>
          {sub.description ? (
            <p className="text-[12px] leading-relaxed text-[#D0D0D0]">{sub.description}</p>
          ) : (
            <p className="text-[11px] italic text-[#6E6E6E]">No description.</p>
          )}
        </div>

        <div className="plastic-card-hi p-3">
          <div className="section-title mb-2">Why this matters</div>
          {sub.why ? (
            <p className="text-[12px] italic leading-relaxed text-[#F59E0B]">{sub.why}</p>
          ) : (
            <p className="text-[11px] italic text-[#6E6E6E]">
              Derived from parent rationale at run time.
            </p>
          )}
        </div>

        <div className="plastic-card-hi p-3">
          <div className="section-title mb-2">Status &amp; owner</div>
          <dl className="space-y-1.5 text-[11px]">
            <Row label="Status">
              <InfoBadge term={`sub-status-${status}`}>
                <span className="plastic-chip px-1.5 py-0.5 font-semibold text-[#E8E8E8]">
                  {status.replace('_', ' ')}
                </span>
              </InfoBadge>
            </Row>
            <Row label="Owner">
              <span className="font-mono text-[#1AEE99]">
                @{sub.owner ?? 'unassigned'}
              </span>
            </Row>
            {sub.estimatedDuration && (
              <Row label="Duration">
                <span className="font-mono text-[#A8A8A8]">{sub.estimatedDuration}</span>
              </Row>
            )}
          </dl>
        </div>
      </div>

      {/* History mini-timeline */}
      <div className="plastic-card-hi">
        <header className="flex items-center gap-2 border-b border-white/[0.06] px-3 py-2">
          <span className="section-title">Change history</span>
          <span className="font-mono text-[10px] text-[#6E6E6E]">({history.length})</span>
        </header>
        {history.length === 0 ? (
          <p className="px-3 py-3 text-[11px] italic text-[#6E6E6E]">
            No history entries reference this sub-mission yet.
          </p>
        ) : (
          <ol
            aria-label="Sub-mission change history"
            className="max-h-44 overflow-y-auto py-1"
          >
            {history.map((entry, i) => (
              <li
                key={`${entry.ts}-${i}`}
                className="flex items-baseline gap-3 px-3 py-1 text-[11px]"
              >
                <span className="w-28 shrink-0 font-mono text-[10px] text-[#6E6E6E]">
                  {formatDate(entry.ts)}
                </span>
                <span className="w-20 shrink-0 font-mono text-[10px] text-[#00B4FF]">
                  @{entry.actor}
                </span>
                <span className="min-w-0 flex-1 text-[#D0D0D0]">{entry.message}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="w-20 shrink-0 text-[10px] uppercase tracking-widest text-[#6E6E6E]">
        {label}
      </dt>
      <dd className="min-w-0 flex-1">{children}</dd>
    </div>
  )
}

type MissionType =
  | 'implementation'
  | 'validation'
  | 'refactor'
  | 'spike'
  | 'docs'
  | 'task'

/**
 * Heuristic mapping from sub-mission name/description to a high-level type.
 * Mirrors logic from MISSION_DETAILS_EXTENSION/2026-05-18/01-patch-v2.md.
 */
function deriveMissionType(sub: SubMission): MissionType {
  const text = `${sub.name} ${sub.description ?? ''}`.toLowerCase()
  if (/\b(implement|build|create|naprogramovat)\b/.test(text)) return 'implementation'
  if (/\b(test|verify|validate|ověř|overit)\b/.test(text)) return 'validation'
  if (/\b(refactor|migrac|přepsat|prepsat)\b/.test(text)) return 'refactor'
  if (/\b(audit|spike|analyz|průzkum|pruzkum)\b/.test(text)) return 'spike'
  if (/\b(document|dokumentac)\b/.test(text)) return 'docs'
  return 'task'
}

const MISSION_TYPE_STYLE: Record<MissionType, { fg: string; border: string; bg: string }> = {
  implementation: {
    fg: '#1AEE99',
    border: 'rgba(0, 224, 133, 0.45)',
    bg: 'rgba(0, 224, 133, 0.10)',
  },
  validation: {
    fg: '#00B4FF',
    border: 'rgba(0, 180, 255, 0.45)',
    bg: 'rgba(0, 180, 255, 0.10)',
  },
  refactor: {
    fg: '#F59E0B',
    border: 'rgba(245, 158, 11, 0.45)',
    bg: 'rgba(245, 158, 11, 0.10)',
  },
  spike: {
    fg: '#9D6CFF',
    border: 'rgba(157, 108, 255, 0.45)',
    bg: 'rgba(157, 108, 255, 0.10)',
  },
  docs: {
    fg: '#5DD6FF',
    border: 'rgba(93, 214, 255, 0.45)',
    bg: 'rgba(93, 214, 255, 0.10)',
  },
  task: {
    fg: '#A8A8A8',
    border: 'rgba(255, 255, 255, 0.12)',
    bg: 'rgba(255, 255, 255, 0.03)',
  },
}

function MissionTypeBadge({ type }: { type: MissionType }) {
  const s = MISSION_TYPE_STYLE[type]
  return (
    <span
      className="px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest"
      style={{ color: s.fg, borderColor: s.border, background: s.bg, border: '1px solid' }}
    >
      [{type}]
    </span>
  )
}

interface HistoryEntry {
  ts: string
  actor: string
  message: string
}

/**
 * Filter mission.auditLog for events that mention this sub-mission (by id or `#<id>`).
 * Returns the most recent 8 entries (newest first). Empty-safe.
 */
function extractHistory(mission: Mission, sub: SubMission): HistoryEntry[] {
  const log: MissionAuditLogEvent[] = mission.auditLog ?? []
  if (log.length === 0) return []
  const idMarker = `#${sub.id}`
  const matches = log.filter((e) => {
    const note = e.note ?? ''
    return note.includes(idMarker) || note.includes(sub.id) || note.includes(sub.name)
  })
  return matches
    .slice()
    .sort((a, b) => (a.ts < b.ts ? 1 : -1))
    .slice(0, 8)
    .map((e) => ({
      ts: e.ts,
      actor: e.actor,
      message: extractMessage(e),
    }))
}

function extractMessage(e: MissionAuditLogEvent): string {
  if (e.note && e.note.trim().length > 0) return e.note
  return e.event.toLowerCase().replace(/_/g, ' ')
}

function formatDate(iso: string): string {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    return `${d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
  } catch {
    return iso
  }
}
