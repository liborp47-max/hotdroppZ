'use client'

import { useCallback, useRef } from 'react'
import type { Mission } from '@/lib/hd-central/types'
import { SubMissionRow } from './sub-mission-row'

interface SubMissionListProps {
  mission: Mission
  selectedSubId: string | null
  onSelect: (id: string) => void
}

/**
 * ARIA listbox of sub-missions with up/down keyboard navigation.
 *
 * Selection model: single-select. Enter/Space inside a focused row triggers selection
 * (handled in SubMissionRow). The list container handles ArrowUp/ArrowDown/Home/End
 * to move the active selection across rows.
 */
export function SubMissionList({ mission, selectedSubId, onSelect }: SubMissionListProps) {
  const subs = mission.subMissions ?? []
  const listRef = useRef<HTMLUListElement | null>(null)

  const focusRow = useCallback((id: string) => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-sub-id="${CSS.escape(id)}"]`)
    el?.focus()
  }, [])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLUListElement>) => {
      if (subs.length === 0) return
      const currentIdx = Math.max(0, subs.findIndex((s) => s.id === selectedSubId))
      let nextIdx: number | null = null
      switch (e.key) {
        case 'ArrowDown':
          nextIdx = Math.min(subs.length - 1, currentIdx + 1)
          break
        case 'ArrowUp':
          nextIdx = Math.max(0, currentIdx - 1)
          break
        case 'Home':
          nextIdx = 0
          break
        case 'End':
          nextIdx = subs.length - 1
          break
        default:
          return
      }
      if (nextIdx === null || nextIdx === currentIdx) return
      e.preventDefault()
      const nextId = subs[nextIdx].id
      onSelect(nextId)
      // Defer focus until after React re-renders with new tabIndex distribution.
      requestAnimationFrame(() => focusRow(nextId))
    },
    [subs, selectedSubId, onSelect, focusRow],
  )

  if (subs.length === 0) {
    return (
      <section className="plastic-card-hi p-3">
        <div className="section-title mb-1">Sub-missions</div>
        <p className="text-[11px] italic text-[#6E6E6E]">
          No sub-missions defined for this mission.
        </p>
      </section>
    )
  }

  return (
    <section className="plastic-card-hi">
      <header className="flex items-center gap-2 border-b border-white/[0.06] px-3 py-2">
        <span className="section-title">Sub-missions</span>
        <span className="font-mono text-[10px] text-[#6E6E6E]">({subs.length})</span>
      </header>
      <ul
        ref={listRef}
        role="listbox"
        aria-label={`Sub-missions for ${mission.name}`}
        aria-activedescendant={selectedSubId ? `sub-${selectedSubId}` : undefined}
        onKeyDown={handleKeyDown}
        className="flex max-h-[280px] flex-col overflow-y-auto py-1 focus:outline-none"
        style={{ scrollbarWidth: 'thin' }}
      >
        {subs.map((sub, i) => (
          <SubMissionRow
            key={sub.id}
            missionId={mission.id}
            missionName={mission.name}
            sub={sub}
            index={i}
            selected={selectedSubId === sub.id}
            onSelect={() => onSelect(sub.id)}
          />
        ))}
      </ul>
    </section>
  )
}
