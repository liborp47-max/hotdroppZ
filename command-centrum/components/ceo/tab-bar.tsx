'use client'

import { useCallback, useId, useRef, type KeyboardEvent, type ReactNode } from 'react'

export type TabBarBadgeVariant = 'venom' | 'cyan' | 'amber' | 'red' | 'neutral'

export interface TabBarTab {
  id: string
  label: string
  icon?: ReactNode
  badge?: ReactNode
  badgeVariant?: TabBarBadgeVariant
}

interface TabBarProps {
  tabs: TabBarTab[]
  active: string
  onChange: (id: string) => void
  /** Optional id used to associate panels via aria-labelledby. */
  ariaLabel?: string
}

const BADGE_STYLES: Record<TabBarBadgeVariant, string> = {
  venom:   'bg-[rgba(0,224,133,0.14)] text-[#1AEE99] border border-[#00E085]/30',
  cyan:    'bg-[rgba(0,180,255,0.12)] text-[#7CD8FF] border border-[#00B4FF]/30',
  amber:   'bg-[rgba(245,158,11,0.14)] text-[#FBBF24] border border-[#F59E0B]/30',
  red:     'bg-[rgba(255,107,107,0.14)] text-[#FFB3B3] border border-[#FF6B6B]/30',
  neutral: 'bg-white/[0.04] text-[#A8A8A8] border border-white/[0.08]',
}

/**
 * Browser-tab styled switcher.
 *
 * Visual:
 *  - container has bottom border, tabs sit on the border with angled top corners
 *  - active tab gets venom-green underline + brighter background + venom text
 *  - inactive tabs are muted with subtle hover
 *
 * A11y:
 *  - role="tablist" / role="tab" with aria-selected
 *  - roving tabindex (only active tab is in tab order)
 *  - ← / → cycle, Home / End jump, Enter / Space activate
 *  - 40px min touch target (h-10) — close to WCAG 44px while staying compact
 */
export function TabBar({ tabs, active, onChange, ariaLabel }: TabBarProps) {
  const containerId = useId()
  const buttonRefs = useRef<Map<string, HTMLButtonElement | null>>(new Map())

  const focusTab = useCallback((id: string) => {
    const btn = buttonRefs.current.get(id)
    btn?.focus()
  }, [])

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLButtonElement>, idx: number) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'Home' && e.key !== 'End') {
        return
      }
      e.preventDefault()
      let nextIdx = idx
      if (e.key === 'ArrowLeft')  nextIdx = (idx - 1 + tabs.length) % tabs.length
      if (e.key === 'ArrowRight') nextIdx = (idx + 1) % tabs.length
      if (e.key === 'Home')       nextIdx = 0
      if (e.key === 'End')        nextIdx = tabs.length - 1
      const next = tabs[nextIdx]
      onChange(next.id)
      focusTab(next.id)
    },
    [tabs, onChange, focusTab],
  )

  return (
    <div
      role="tablist"
      aria-label={ariaLabel ?? 'Sections'}
      className="flex items-end gap-0.5 border-b border-[#1F1F1F] px-2 pt-2 shrink-0"
      style={{ background: 'linear-gradient(180deg, #161616 0%, #0F0F0F 100%)' }}
    >
      {tabs.map((tab, idx) => {
        const selected = tab.id === active
        const variant: TabBarBadgeVariant = tab.badgeVariant ?? 'neutral'
        return (
          <button
            key={tab.id}
            ref={(el) => { buttonRefs.current.set(tab.id, el) }}
            id={`${containerId}-tab-${tab.id}`}
            role="tab"
            type="button"
            aria-selected={selected}
            aria-controls={`${containerId}-panel-${tab.id}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.id)}
            onKeyDown={(e) => onKeyDown(e, idx)}
            className={
              'inline-flex items-center gap-2 px-4 h-10 rounded-t-md ' +
              'border-x border-t text-[12px] uppercase tracking-widest transition-colors ' +
              'focus:outline-2 focus:outline-[#00E085]/60 focus:outline-offset-[-2px] ' +
              (selected
                ? 'bg-[#0F0F0F] border-[#1F1F1F] text-[#1AEE99] ' +
                  '-mb-px border-b-2 border-b-[#00E085] ' +
                  'shadow-[inset_0_-2px_0_0_#00E085,0_-4px_12px_-6px_rgba(0,224,133,0.35)]'
                : 'border-transparent text-[#6E6E6E] hover:text-[#A8A8A8] hover:bg-white/[0.02]')
            }
          >
            {tab.icon && (
              <span aria-hidden className="inline-flex items-center [&_svg]:h-3.5 [&_svg]:w-3.5">
                {tab.icon}
              </span>
            )}
            <span>{tab.label}</span>
            {tab.badge !== undefined && tab.badge !== null && tab.badge !== '' && (
              <span
                className={
                  'inline-flex items-center text-[10px] font-mono px-1.5 py-0.5 rounded ' +
                  BADGE_STYLES[variant]
                }
              >
                {tab.badge}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
