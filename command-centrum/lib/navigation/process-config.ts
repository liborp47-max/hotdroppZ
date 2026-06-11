import { BarChart3, GitMerge, PenLine, Rss, Radio } from 'lucide-react'

export type ProcessCoreElement = {
  label: string
  href: string
  icon: typeof BarChart3
  num: string
  active: true
}

export type ProcessLegacyElement = {
  label: string
  icon: typeof BarChart3
  num: string
  active: false
}

export const PROCESS_CORE_ELEMENTS: ProcessCoreElement[] = [
  { label: 'SCOUT HQ', href: '/scout-hq/overview', icon: BarChart3, num: '01', active: true },
  { label: 'Cluster', href: '/cluster', icon: GitMerge, num: '02', active: true },
  { label: 'FACTORY', href: '/writer', icon: PenLine, num: '03', active: true },
  { label: 'FEED', href: '/feed/incoming', icon: Rss, num: '04', active: true },
  { label: 'Distribution', href: '/distribution', icon: Radio, num: '05', active: true },
]

export const PROCESS_LEGACY_ELEMENTS: ProcessLegacyElement[] = []
