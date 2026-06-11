'use client'

// Unified mission filter bar (HD Central UI upgrade).
// One control set for every Missions surface: scope segment (a11y TabBar) +
// search + priority + phase + sort. Czech labels; replaces the two divergent
// filter toolbars (missions-section tabs + user-missions-panel row).

import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { TabBar, type TabBarTab, type TabBarBadgeVariant } from './tab-bar'
import type {
  MissionFilters,
  MissionScope,
  ScopeCounts,
} from '@/lib/hd-central/mission-filters'
import type { Phase, Priority } from '@/lib/hd-central/types'

const SCOPES: { id: MissionScope; label: string; badge: TabBarBadgeVariant }[] = [
  { id: 'inbox', label: 'Příchozí', badge: 'amber' },
  { id: 'timeline', label: 'Timeline', badge: 'venom' },
  { id: 'spec_ops', label: 'Spec Ops', badge: 'cyan' },
  { id: 'done', label: 'Hotové', badge: 'neutral' },
  { id: 'all', label: 'Vše', badge: 'neutral' },
]

const PHASES: Phase[] = ['Foundation', 'Build', 'Validate', 'Launch', 'Scale']
const PRIORITIES: Priority[] = ['P0', 'P1', 'P2', 'P3']

interface MissionFilterBarProps {
  filters: MissionFilters
  counts: ScopeCounts
  onChange: (patch: Partial<MissionFilters>) => void
}

export function MissionFilterBar({ filters, counts, onChange }: MissionFilterBarProps) {
  const tabs: TabBarTab[] = SCOPES.map((s) => ({
    id: s.id,
    label: s.label,
    badge: counts[s.id],
    badgeVariant: s.badge,
  }))

  return (
    <div className="space-y-2">
      <TabBar
        tabs={tabs}
        active={filters.scope}
        onChange={(id) => onChange({ scope: id as MissionScope })}
        ariaLabel="Filtr misí podle stavu"
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#6E6E6E]" />
          <Input
            value={filters.search}
            onChange={(e) => onChange({ search: e.target.value })}
            placeholder="Hledat mise…"
            className="h-8 w-56 border-white/10 bg-black/50 pl-7 text-xs backdrop-blur-xl"
          />
        </div>

        <Select value={filters.priority} onValueChange={(v) => onChange({ priority: v as MissionFilters['priority'] })}>
          <SelectTrigger className="h-8 w-28 border-white/10 bg-black/50 text-xs backdrop-blur-xl">
            <SelectValue placeholder="Priorita" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Priorita</SelectItem>
            {PRIORITIES.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.phase} onValueChange={(v) => onChange({ phase: v as MissionFilters['phase'] })}>
          <SelectTrigger className="h-8 w-32 border-white/10 bg-black/50 text-xs backdrop-blur-xl">
            <SelectValue placeholder="Fáze" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Fáze</SelectItem>
            {PHASES.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <span className="text-[10px] text-[#6E6E6E]">Řazení: klikni na záhlaví sloupce</span>
      </div>
    </div>
  )
}
