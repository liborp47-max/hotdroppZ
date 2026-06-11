'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutGrid, Rss, Radio, Layers, GitMerge,
  BookOpen, DollarSign, BarChart2, Calendar,
  ChevronDown, ChevronRight, Cpu, Bot, Newspaper,
  Music, Database, Eye, BarChart3, Settings, Archive, PenLine, ShieldCheck, Image as ImageIcon, Globe, Sparkles,
  Zap, Trophy, LayoutTemplate, Inbox, Youtube,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { PROCESS_CORE_ELEMENTS, PROCESS_LEGACY_ELEMENTS } from '@/lib/navigation/process-config'
import GlobalSearch from '@/components/global-search'

const PROCESS_STEPS = PROCESS_CORE_ELEMENTS
const PROCESS_STEPS_SOON = PROCESS_LEGACY_ELEMENTS

// ── SCOUT HQ — workers grouped by category (hidden behind "Workers" expand toggle) ──
const SCOUT_WORKER_CATEGORIES: {
  id: string
  label: string
  color: string
  workers: { label: string; href: string; icon: React.ElementType }[]
}[] = [
  {
    id: 'music',
    label: 'Music',
    color: '#1DB954',
    workers: [
      { label: 'Spotify Playlists', href: '/scout-hq/workers/spotify-playlists', icon: Music },
      { label: 'Spotify Artists',   href: '/scout-hq/workers/spotify-artists',   icon: Music },
      { label: 'Apple Music',       href: '/scout-hq/workers/apple-music',       icon: Music },
      { label: 'Deezer',            href: '/scout-hq/workers/deezer',            icon: Music },
    ],
  },
  {
    id: 'social',
    label: 'Social',
    color: '#E1306C',
    workers: [
      { label: 'Instagram', href: '/scout-hq/workers/instagram', icon: Sparkles },
      { label: 'TikTok',    href: '/scout-hq/workers/tiktok',    icon: Sparkles },
      { label: 'YouTube',   href: '/scout-hq/workers/youtube',   icon: Youtube },
    ],
  },
  {
    id: 'media',
    label: 'Media',
    color: '#FFB84D',
    workers: [
      { label: 'RSS',       href: '/scout-hq/workers/rss',       icon: Rss },
      { label: 'Blogs',     href: '/scout-hq/workers/blogs',     icon: BookOpen },
      { label: 'Magazines', href: '/scout-hq/workers/magazines', icon: BookOpen },
    ],
  },
  {
    id: 'signals',
    label: 'Signals',
    color: '#A78BFA',
    workers: [
      { label: 'Charts', href: '/scout-hq/workers/charts', icon: BarChart3 },
      { label: 'Trends', href: '/scout-hq/workers/trends', icon: BarChart3 },
    ],
  },
]

// ── SCOUT HQ — downstream pipeline (always visible when SCOUT HQ is open) ──
const SCOUT_HQ_DOWNSTREAM_ITEMS = [
  { label: 'Normalization', href: '/scout-hq/normalization', icon: GitMerge },
  { label: 'Final Pool',    href: '/scout-hq/pool',          icon: Layers },
  { label: 'Storage',       href: '/scout-hq/storage',       icon: Archive },
  { label: 'Settings',      href: '/scout-hq/settings',      icon: Settings },
]

const SOURCES_ITEMS = [
  { label: 'RSS Sources',      href: '/sources',          icon: Rss },
  { label: 'AIL',              href: '/sources/artists',  icon: Database },
  { label: 'Gallery',          href: '/sources/gallery',   icon: ImageIcon },
  { label: 'MEDIA',            href: '/sources/media',     icon: ImageIcon },
]

const COORDINATOR_ITEMS = [
  { label: 'Coordinator', href: '/factory/coordinator', icon: Zap },
  { label: 'Templates',   href: '/factory/templates',   icon: LayoutTemplate },
]

const WRITER_ITEMS = [
  { label: 'Story Builder', href: '/story-builder', icon: Newspaper },
  { label: 'Writer',        href: '/writer',         icon: PenLine },
]

const CREATOR_ITEMS = [
  { label: 'Fact Builder', href: '/creator-facts', icon: Newspaper },
  { label: 'Creator', href: '/creator', icon: PenLine },
  { label: 'Queue', href: '/creator-queue', icon: ShieldCheck },
]

const FEED_ITEMS = [
  { label: '01 Incoming', href: '/feed/incoming', icon: Rss },
  { label: '02 Editor', href: '/feed/editor-workflow', icon: PenLine },
  { label: '03 Multilanguage', href: '/feed/multilanguage', icon: Globe },
  { label: '04 Calendar', href: '/feed/calendar', icon: Calendar },
  { label: '05 Approval', href: '/feed/approval', icon: ShieldCheck },
  { label: '06 Published', href: '/feed/published', icon: BookOpen },
]

const TOP_ITEMS = [
  { label: 'HD CENTRAL', href: '/hd-central', icon: LayoutGrid },
]

const HD_CENTRAL_ITEMS = [
  { label: 'CEO',           href: '/hd-central/ceo',            icon: Bot,        children: [
    { label: 'Brainstorming', href: '/hd-central/ceo/brainstorming', icon: Sparkles },
  ]},
  { label: 'PLAN HQ',       href: '/hd-central/planning',        icon: LayoutTemplate, children: [
    { label: 'Primary Mission', href: '/hd-central/planning/mission', icon: Trophy },
    { label: 'Plan Manager',    href: '/hd-central/planning/plan',    icon: Calendar },
    { label: 'Goal Dashboard',  href: '/hd-central/planning/goals',   icon: BarChart2 },
  ]},
  { label: 'Auditor',       href: '/hd-central/auditor',         icon: ShieldCheck, children: [] },
  { label: 'Intel',         href: '/hd-central/intel',           icon: Database,    children: [] },
  { label: 'Analytics',     href: '/hd-central/analytics',       icon: BarChart2,   children: [] },
]

const BOTTOM_ITEMS = [
  { label: 'Published',            href: '/published',    icon: BookOpen },
  { label: 'Monetization',         href: '/monetization', icon: DollarSign },
  { label: 'AI Control',           href: '/ai-control',   icon: Bot },
  { label: 'Analytics & Learning', href: '/analytics',    icon: BarChart2 },
]

function NavLink({
  href,
  icon: Icon,
  label,
  active,
}: {
  href: string
  icon: React.ElementType
  label: string
  active: boolean
}) {
  return (
    <Link
      href={href}
      className={cn(
        'group flex items-center gap-2.5 text-sm font-medium transition-all duration-150 relative px-3 py-2',
        active
          ? 'bg-[#0A0A0A] text-[#E8E8E8] before:absolute before:left-0 before:top-1 before:bottom-1 before:w-0.5 before:bg-[#00E085] before:shadow-[0_0_4px_rgba(0,224,133,0.25)]'
          : 'text-[#A8A8A8] hover:text-[#E8E8E8] hover:bg-[#101010]'
      )}
    >
      <Icon
        className={cn(
          'h-4 w-4 shrink-0 transition-colors',
          active ? 'text-[#00E085]' : 'text-[#6E6E6E] group-hover:text-[#00E085]'
        )}
      />
      <span className="flex-1 leading-none">{label}</span>
      {active && (
        <span className="w-1 h-1 bg-[#00E085] shrink-0 shadow-[0_0_4px_rgba(0,224,133,0.35)]" />
      )}
    </Link>
  )
}

export function Sidebar() {
  const pathname = usePathname()

  const processActive = PROCESS_STEPS.some(
    (s) => pathname === s.href || pathname.startsWith(s.href + '/')
  ) || pathname === '/cluster' || pathname.startsWith('/cluster/')
  const sourcesActive = SOURCES_ITEMS.some(
    (s) => pathname === s.href || pathname.startsWith(s.href + '/')
  )
  const scoutHQActive = pathname.startsWith('/scout-hq')
  const writerActive = WRITER_ITEMS.some(
    (item) => pathname === item.href || pathname.startsWith(item.href + '/')
  )
  const creatorActive = CREATOR_ITEMS.some(
    (item) => pathname === item.href || pathname.startsWith(item.href + '/')
  )
  const feedActive = FEED_ITEMS.some(
    (item) => pathname === item.href || pathname.startsWith(item.href + '/')
  )
  const enrichmentActive = pathname === '/enrichment' || pathname.startsWith('/enrichment/')
  const distributionActive = pathname === '/distribution' || pathname.startsWith('/distribution/')
  const coordinatorActive = pathname.startsWith('/factory/coordinator') || pathname.startsWith('/factory/templates')
  const finalsActive = pathname.startsWith('/factory/finals')
  const factoryActive = writerActive || creatorActive || enrichmentActive || coordinatorActive || finalsActive
  const mainFactoryActive = factoryActive || feedActive || distributionActive

  const hdCentralActive = pathname === '/hd-central' || pathname.startsWith('/hd-central/')
  const [hdCentralOpen, setHdCentralOpen] = useState(hdCentralActive)
  const [hdCentralCeoOpen, setHdCentralCeoOpen] = useState(pathname.startsWith('/hd-central/ceo'))
  const [hdCentralPlanningOpen, setHdCentralPlanningOpen] = useState(pathname.startsWith('/hd-central/planning'))

  const [processOpen, setProcessOpen] = useState(processActive || scoutHQActive || mainFactoryActive)
  const [sourcesOpen, setSourcesOpen] = useState(sourcesActive)
  const [scoutHQOpen, setScoutHQOpen] = useState(scoutHQActive)
  // Workers section auto-opens only when user is already on a worker page.
  const scoutWorkersActive = pathname.startsWith('/scout-hq/workers/')
  const [scoutWorkersOpen, setScoutWorkersOpen] = useState(scoutWorkersActive)
  const [factoryOpen, setFactoryOpen] = useState(factoryActive)
  const [coordinatorOpen, setCoordinatorOpen] = useState(coordinatorActive)
  const [writerOpen, setWriterOpen] = useState(writerActive)
  const [creatorOpen, setCreatorOpen] = useState(creatorActive)
  const [feedOpen, setFeedOpen] = useState(feedActive)

  useEffect(() => {
    if (processActive || scoutHQActive || mainFactoryActive) setProcessOpen(true)
    if (sourcesActive) setSourcesOpen(true)
    if (scoutHQActive) setScoutHQOpen(true)
    if (scoutWorkersActive) setScoutWorkersOpen(true)
    if (factoryActive) setFactoryOpen(true)
    if (coordinatorActive) setCoordinatorOpen(true)
    if (writerActive) setWriterOpen(true)
    if (creatorActive) setCreatorOpen(true)
    if (feedActive) setFeedOpen(true)
  }, [processActive, scoutHQActive, mainFactoryActive, writerActive, creatorActive, sourcesActive, feedActive, coordinatorActive, scoutWorkersActive])

  return (
    <aside className="flex flex-col w-56 h-full bg-black/60 backdrop-blur-2xl backdrop-saturate-150 border-r border-white/[0.06] shrink-0">

      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-white/[0.06] shrink-0">
        <div className="flex items-center justify-center w-7 h-7 bg-white/[0.03] border border-[#00E085]/30 shadow-[0_0_8px_rgba(0,224,133,0.18)] overflow-hidden">
          <img
            src="/icons/ICON.ico"
            alt="HotDroppZ"
            width={28}
            height={28}
            className="object-contain"
          />
        </div>
        <div>
          <span className="text-sm font-bold text-[#E8E8E8] tracking-tight">HotDroppZ</span>
          <span className="block text-[10px] text-[#00E085] leading-none mt-0.5 font-semibold uppercase tracking-widest [text-shadow:0_0_8px_rgba(0,224,133,0.40)]">
            HD Central
          </span>
        </div>
      </div>

      {/* Search */}
      <div className="px-2 py-2 border-b border-white/[0.06]">
        <GlobalSearch variant="bar" placeholder="Search…" className="w-full" />
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">

        {/* HD CENTRAL */}
        <div>
          <div className={cn(
            'flex items-center text-sm font-medium transition-all duration-150',
            hdCentralActive
              ? 'bg-[#111111] text-[#E8E8E8]'
              : 'text-[#A8A8A8] hover:text-[#E8E8E8] hover:bg-[#0D0D0D]'
          )}>
            <Link
              href="/hd-central"
              className="flex items-center gap-2.5 flex-1 px-3 py-2"
            >
              <LayoutGrid className={cn('h-4 w-4 shrink-0', hdCentralActive ? 'text-[#00E085]' : 'text-[#6E6E6E]')} />
              <span className="flex-1 text-left">HD CENTRAL</span>
            </Link>
            <button
              onClick={() => setHdCentralOpen((o) => !o)}
              className="px-2.5 py-2"
            >
              {hdCentralOpen
                ? <ChevronDown className="h-3.5 w-3.5 text-[#6E6E6E]" />
                : <ChevronRight className="h-3.5 w-3.5 text-[#6E6E6E]" />}
            </button>
          </div>

          {hdCentralOpen && (
            <div className="mt-0.5 space-y-0.5 border-l border-[#1F1F1F] ml-5 pl-1">

              {/* CEO */}
              <div>
                <div className={cn(
                  'flex items-center text-[13px] font-medium transition-all duration-150',
                  pathname.startsWith('/hd-central/ceo')
                    ? 'bg-[#111111] text-[#E8E8E8]'
                    : 'text-[#A8A8A8] hover:text-[#E8E8E8] hover:bg-[#0D0D0D]'
                )}>
                  <Link
                    href="/hd-central/ceo"
                    className="flex items-center gap-2 flex-1 px-2.5 py-1.5"
                  >
                    <Bot className={cn('h-3.5 w-3.5 shrink-0', pathname.startsWith('/hd-central/ceo') ? 'text-[#00E085]' : 'text-[#6E6E6E]')} />
                    <span className="flex-1 text-left">CEO</span>
                  </Link>
                  <button
                    onClick={() => setHdCentralCeoOpen((o) => !o)}
                    className="px-2 py-1.5"
                  >
                    {hdCentralCeoOpen ? <ChevronDown className="h-3 w-3 text-[#6E6E6E]" /> : <ChevronRight className="h-3 w-3 text-[#6E6E6E]" />}
                  </button>
                </div>
                {hdCentralCeoOpen && (
                  <div className="mt-0.5 space-y-0.5 border-l border-[#1F1F1F] ml-5 pl-1">
                    <Link href="/hd-central/ceo/missions" className={cn(
                      'group flex items-center gap-2 px-2.5 py-1.5 text-[12px] font-medium transition-all duration-150 relative',
                      pathname === '/hd-central/ceo/missions' ? 'bg-[#111111] text-[#E8E8E8]' : 'text-[#A8A8A8] hover:text-[#E8E8E8] hover:bg-[#0D0D0D]'
                    )}>
                      <Inbox className={cn('h-3 w-3 shrink-0', pathname === '/hd-central/ceo/missions' ? 'text-[#00E085]' : 'text-[#6E6E6E] group-hover:text-[#00E085]')} />
                      <span>Missions</span>
                    </Link>
                    <Link href="/hd-central/ceo/brainstorming" className={cn(
                      'group flex items-center gap-2 px-2.5 py-1.5 text-[12px] font-medium transition-all duration-150 relative',
                      pathname === '/hd-central/ceo/brainstorming' ? 'bg-[#111111] text-[#E8E8E8]' : 'text-[#A8A8A8] hover:text-[#E8E8E8] hover:bg-[#0D0D0D]'
                    )}>
                      <Sparkles className={cn('h-3 w-3 shrink-0', pathname === '/hd-central/ceo/brainstorming' ? 'text-[#00E085]' : 'text-[#6E6E6E] group-hover:text-[#00E085]')} />
                      <span>Brainstorming</span>
                    </Link>
                  </div>
                )}
              </div>

              {/* PLANNING ROOM */}
              <div>
                <button
                  onClick={() => setHdCentralPlanningOpen((o) => !o)}
                  className={cn(
                    'w-full flex items-center gap-2 px-2.5 py-1.5 text-[13px] font-medium transition-all duration-150 relative',
                    pathname.startsWith('/hd-central/planning')
                      ? 'bg-[#111111] text-[#E8E8E8]'
                      : 'text-[#A8A8A8] hover:text-[#E8E8E8] hover:bg-[#0D0D0D]'
                  )}
                >
                  <LayoutTemplate className={cn('h-3.5 w-3.5 shrink-0', pathname.startsWith('/hd-central/planning') ? 'text-[#00E085]' : 'text-[#6E6E6E]')} />
                  <span className="flex-1 text-left">PLAN HQ</span>
                  {hdCentralPlanningOpen ? <ChevronDown className="h-3 w-3 text-[#6E6E6E]" /> : <ChevronRight className="h-3 w-3 text-[#6E6E6E]" />}
                </button>
                {hdCentralPlanningOpen && (
                  <div className="mt-0.5 space-y-0.5 border-l border-[#1F1F1F] ml-5 pl-1">
                    {[
                      { label: 'Primary Mission', href: '/hd-central/planning/mission', icon: Trophy },
                      { label: 'Plan Manager',    href: '/hd-central/planning/plan',    icon: Calendar },
                      { label: 'Goal Dashboard',  href: '/hd-central/planning/goals',   icon: BarChart2 },
                    ].map((item) => {
                      const a = pathname === item.href
                      return (
                        <Link key={item.href} href={item.href} className={cn(
                          'group flex items-center gap-2 px-2.5 py-1.5 text-[12px] font-medium transition-all duration-150 relative',
                          a ? 'bg-[#111111] text-[#E8E8E8]' : 'text-[#A8A8A8] hover:text-[#E8E8E8] hover:bg-[#0D0D0D]'
                        )}>
                          <item.icon className={cn('h-3 w-3 shrink-0', a ? 'text-[#00E085]' : 'text-[#6E6E6E] group-hover:text-[#00E085]')} />
                          <span>{item.label}</span>
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* AUDITOR / INTEL / ANALYTICS */}
              {[
                { label: 'Auditor',   href: '/hd-central/auditor',   icon: ShieldCheck, color: 'text-[#00E085]' },
                { label: 'Intel',     href: '/hd-central/intel',     icon: Database,    color: 'text-[#1AEE99]' },
                { label: 'Analytics', href: '/hd-central/analytics', icon: BarChart2,   color: 'text-[#1AEE99]'  },
              ].map((item) => {
                const a = pathname === item.href || pathname.startsWith(item.href + '/')
                return (
                  <Link key={item.href} href={item.href} className={cn(
                    'group flex items-center gap-2 px-2.5 py-1.5 text-[13px] font-medium transition-all duration-150 relative',
                    a ? 'bg-[#1A1A1A] text-[#E8E8E8]' : 'text-[#A8A8A8] hover:text-[#E8E8E8] hover:bg-[#161616]'
                  )}>
                    <item.icon className={cn('h-3.5 w-3.5 shrink-0', a ? item.color : 'text-[#6E6E6E] group-hover:text-[#00E085]')} />
                    <span>{item.label}</span>
                    {a && <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 bg-[#00E085] shadow-[0_0_8px_rgba(0,224,133,0.8)]" />}
                  </Link>
                )
              })}

            </div>
          )}
        </div>

        {/* Sources Manager group */}
        <div>
          <button
            onClick={() => setSourcesOpen((o) => !o)}
            className={cn(
              'w-full flex items-center gap-2.5 px-3 py-2 text-sm font-medium transition-all duration-150',
              sourcesActive
                ? 'text-[#E8E8E8] bg-[#111111]'
                : 'text-[#A8A8A8] hover:text-[#E8E8E8] hover:bg-[#0D0D0D]'
            )}
          >
            <Music
              className={cn(
                'h-4 w-4 shrink-0 transition-colors',
                sourcesActive ? 'text-[#00E085]' : 'text-[#6E6E6E]'
              )}
            />
            <span className="flex-1 text-left">Sources</span>
            {sourcesOpen
              ? <ChevronDown className="h-3.5 w-3.5 text-[#6E6E6E]" />
              : <ChevronRight className="h-3.5 w-3.5 text-[#6E6E6E]" />
            }
          </button>

          {sourcesOpen && (
            <div className="mt-0.5 space-y-0.5 border-l border-[#1F1F1F] ml-5 pl-1">
              {SOURCES_ITEMS.map((item) => {
                const active = pathname === item.href || pathname.startsWith(item.href + '/')
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'group flex items-center gap-2 px-2.5 py-1.5 text-[13px] font-medium transition-all duration-150 relative',
                      active
                        ? 'bg-[#111111] text-[#E8E8E8]'
                        : 'text-[#A8A8A8] hover:text-[#E8E8E8] hover:bg-[#0D0D0D]'
                    )}
                  >
                    <item.icon
                      className={cn(
                        'h-3.5 w-3.5 shrink-0 transition-colors',
                        active ? 'text-[#00E085]' : 'text-[#6E6E6E] group-hover:text-[#00E085]'
                      )}
                    />
                    <span className="flex-1">{item.label}</span>
                    {active && (
                      <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 bg-[#00E085] shadow-[0_0_6px_rgba(95,163,114,0.2)]" />
                    )}
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="h-px bg-[#1F1F1F] my-2 mx-1" />

        {/* Process group */}
        <div>
          <button
            // AUD-UX-001: expand is a PURE toggle — it no longer navigates
            // (expanding a group must not change the route). Section pages are
            // reached via the sub-links revealed below.
            onClick={() => setProcessOpen((open) => !open)}
            aria-expanded={processOpen}
            className={cn(
              'w-full flex items-center gap-2.5 px-3 py-2 text-sm font-medium transition-all duration-150',
              processActive || scoutHQActive
                ? 'text-[#E8E8E8] bg-[#111111]'
                : 'text-[#A8A8A8] hover:text-[#E8E8E8] hover:bg-[#0D0D0D]'
            )}
          >
            <Cpu
              className={cn(
                'h-4 w-4 shrink-0 transition-colors',
                processActive || scoutHQActive ? 'text-[#00E085]' : 'text-[#6E6E6E]'
              )}
            />
            <span className="flex-1 text-left">Process</span>
            {processOpen
              ? <ChevronDown className="h-3.5 w-3.5 text-[#6E6E6E]" />
              : <ChevronRight className="h-3.5 w-3.5 text-[#6E6E6E]" />
            }
          </button>

          {processOpen && (
            <div className="mt-0.5 space-y-0.5 border-l border-[#1F1F1F] ml-5 pl-1">

              {/* ── SCOUT HQ (01) ── main page + expandable Workers + downstream */}
              <div>
                <div
                  className={cn(
                    'flex items-center text-[13px] font-medium transition-all duration-150 relative',
                    pathname === '/scout-hq'
                      ? 'bg-[#111111] text-[#E8E8E8]'
                      : 'text-[#A8A8A8] hover:text-[#E8E8E8] hover:bg-[#0D0D0D]'
                  )}
                >
                  <Link
                    href="/scout-hq"
                    className="flex items-center gap-2 flex-1 px-2.5 py-1.5"
                  >
                    <BarChart3
                      className={cn(
                        'h-3.5 w-3.5 shrink-0 transition-colors',
                        scoutHQActive ? 'text-[#00E085]' : 'text-[#6E6E6E]'
                      )}
                    />
                    <span className="flex-1 text-left">SCOUT HQ</span>
                    <span className="text-[10px] text-[#6E6E6E] font-mono tabular-nums">01</span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => setScoutHQOpen((o) => !o)}
                    aria-label="Toggle Scout HQ children"
                    className="px-2 py-1.5"
                  >
                    {scoutHQOpen
                      ? <ChevronDown className="h-3 w-3 text-[#6E6E6E]" />
                      : <ChevronRight className="h-3 w-3 text-[#6E6E6E]" />
                    }
                  </button>
                  {pathname === '/scout-hq' && (
                    <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 bg-[#00E085] shadow-[0_0_6px_rgba(95,163,114,0.2)]" />
                  )}
                </div>

                {scoutHQOpen && (
                  <div className="mt-0.5 space-y-0.5 border-l border-[#1F1F1F] ml-5 pl-1">
                    {/* Workers — collapsible parent (default closed) */}
                    <button
                      type="button"
                      onClick={() => setScoutWorkersOpen((o) => !o)}
                      aria-expanded={scoutWorkersOpen}
                      className={cn(
                        'group w-full flex items-center gap-2 px-2.5 py-1.5 text-[12px] font-medium transition-all duration-150 relative',
                        scoutWorkersActive
                          ? 'bg-[#1A1A1A] text-[#E8E8E8]'
                          : 'text-[#A8A8A8] hover:text-[#E8E8E8] hover:bg-[#161616]'
                      )}
                    >
                      <Cpu className={cn(
                        'h-3 w-3 shrink-0 transition-colors',
                        scoutWorkersActive ? 'text-[#00E085]' : 'text-[#6E6E6E] group-hover:text-[#00E085]'
                      )} />
                      <span className="flex-1 text-left">Workers</span>
                      <span className="text-[9px] font-mono text-[#6E6E6E]">12</span>
                      {scoutWorkersOpen
                        ? <ChevronDown className="h-3 w-3 text-[#6E6E6E]" />
                        : <ChevronRight className="h-3 w-3 text-[#6E6E6E]" />}
                    </button>

                    {scoutWorkersOpen && (
                      <div className="mt-0.5 space-y-1 border-l border-[#1F1F1F] ml-3 pl-1">
                        {SCOUT_WORKER_CATEGORIES.map((cat) => (
                          <div key={cat.id} className="pt-1">
                            <div
                              className="px-2.5 py-0.5 text-[9px] uppercase tracking-[0.22em] font-bold opacity-80"
                              style={{ color: cat.color, textShadow: `0 0 6px ${cat.color}40` }}
                            >
                              {cat.label}
                            </div>
                            {cat.workers.map((w) => {
                              const active = pathname === w.href
                              return (
                                <Link
                                  key={w.href}
                                  href={w.href}
                                  className={cn(
                                    'group flex items-center gap-2 px-2.5 py-1 text-[11px] font-medium transition-all duration-150 relative',
                                    active
                                      ? 'bg-[#1A1A1A] text-[#E8E8E8]'
                                      : 'text-[#A8A8A8] hover:text-[#E8E8E8] hover:bg-[#161616]'
                                  )}
                                >
                                  <w.icon
                                    className={cn(
                                      'h-3 w-3 shrink-0 transition-colors',
                                      active ? 'text-[#00E085]' : 'text-[#6E6E6E] group-hover:text-[#00E085]'
                                    )}
                                  />
                                  <span className="flex-1">{w.label}</span>
                                  {active && (
                                    <span className="absolute left-0 top-1 bottom-1 w-0.5 bg-[#00E085] shadow-[0_0_8px_rgba(0,224,133,0.8)]" />
                                  )}
                                </Link>
                              )
                            })}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Downstream pipeline */}
                    <div className="pt-1 mt-1 border-t border-white/[0.04]">
                      {SCOUT_HQ_DOWNSTREAM_ITEMS.map((item) => {
                        const scoutActive = pathname === item.href
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                              'group flex items-center gap-2 px-2.5 py-1.5 text-[12px] font-medium transition-all duration-150 relative',
                              scoutActive
                                ? 'bg-[#1A1A1A] text-[#E8E8E8]'
                                : 'text-[#A8A8A8] hover:text-[#E8E8E8] hover:bg-[#161616]'
                            )}
                          >
                            <item.icon
                              className={cn(
                                'h-3 w-3 shrink-0 transition-colors',
                                scoutActive ? 'text-[#00E085]' : 'text-[#6E6E6E] group-hover:text-[#00E085]'
                              )}
                            />
                            <span className="flex-1">{item.label}</span>
                            {scoutActive && (
                              <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 bg-[#00E085] shadow-[0_0_8px_rgba(0,224,133,0.8)]" />
                            )}
                          </Link>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* ── CLUSTER (02) ── */}
              {(() => {
                const clusterActive = pathname === '/cluster' || pathname.startsWith('/cluster/')
                return (
                  <Link
                    href="/cluster"
                    className={cn(
                      'group flex items-center gap-2 px-2.5 py-1.5 text-[13px] font-medium transition-all duration-150 relative',
                      clusterActive
                        ? 'bg-[#1A1A1A] text-[#E8E8E8]'
                        : 'text-[#A8A8A8] hover:text-[#E8E8E8] hover:bg-[#161616]'
                    )}
                  >
                    <GitMerge
                      className={cn(
                        'h-3.5 w-3.5 shrink-0 transition-colors',
                        clusterActive ? 'text-[#00E085]' : 'text-[#6E6E6E] group-hover:text-[#00E085]'
                      )}
                    />
                    <span className="flex-1">Cluster</span>
                    <span className="text-[10px] text-[#6E6E6E] font-mono tabular-nums">02</span>
                    {clusterActive && (
                      <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 bg-[#00E085] shadow-[0_0_6px_rgba(0,224,133,0.6)]" />
                    )}
                  </Link>
                )
              })()}

              {/* ── FACTORY (03) ── expandable */}
              <div>
                <button
                  // AUD-UX-001: pure expand toggle, no navigation side-effect.
                  onClick={() => setFactoryOpen((open) => !open)}
                  aria-expanded={factoryOpen}
                  className={cn(
                    'w-full flex items-center gap-2 px-2.5 py-1.5 text-[13px] font-medium transition-all duration-150 relative',
                    factoryActive
                      ? 'bg-[#111111] text-[#E8E8E8]'
                      : 'text-[#A8A8A8] hover:text-[#E8E8E8] hover:bg-[#0D0D0D]'
                  )}
                >
                  <PenLine
                    className={cn(
                      'h-3.5 w-3.5 shrink-0 transition-colors',
                      factoryActive ? 'text-[#00E085]' : 'text-[#6E6E6E]'
                    )}
                  />
                  <span className="flex-1 text-left">FACTORY</span>
                    <span className="text-[10px] text-[#6E6E6E] font-mono tabular-nums">03</span>
                  {factoryOpen
                    ? <ChevronDown className="h-3 w-3 text-[#6E6E6E]" />
                    : <ChevronRight className="h-3 w-3 text-[#6E6E6E]" />
                  }
                  {factoryActive && (
                    <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 bg-[#00E085] shadow-[0_0_6px_rgba(95,163,114,0.2)]" />
                  )}
                </button>

                {factoryOpen && (
                    <div className="mt-0.5 space-y-0.5 border-l border-[#1F1F1F] ml-5 pl-1">
                    {/* COORDINATOR */}
                    <div>
                      <button
                        onClick={() => {
                          setCoordinatorOpen((open) => {
                            const next = !open
                            return next
                          })
                        }}
                        className={cn(
                          'w-full flex items-center gap-2 px-2.5 py-1.5 text-[12px] font-semibold transition-all duration-150 relative',
                          coordinatorActive
                            ? 'bg-[#0A1A12] text-[#00E085] border border-[#00E085]/20'
                            : 'text-[#A8A8A8] hover:text-[#E8E8E8] hover:bg-[#161616]'
                        )}
                      >
                        <Zap className={cn('h-3 w-3 shrink-0', coordinatorActive ? 'text-[#00E085]' : 'text-[#6E6E6E]')} />
                        <span className="flex-1 text-left">COORDINATOR</span>
                        <span className="text-[8px] font-black text-[#00E085]/60">CRIT</span>
                        {coordinatorOpen
                          ? <ChevronDown className="h-3 w-3 text-[#6E6E6E]" />
                          : <ChevronRight className="h-3 w-3 text-[#6E6E6E]" />
                        }
                      </button>

                      {coordinatorOpen && (
                        <div className="mt-0.5 space-y-0.5 border-l border-[#00E085]/15 ml-4 pl-1">
                          {COORDINATOR_ITEMS.map((item) => {
                            const active = pathname === item.href || pathname.startsWith(item.href + '/')
                            return (
                              <Link
                                key={item.href}
                                href={item.href}
                                className={cn(
                                  'group flex items-center gap-2 px-2.5 py-1.5 text-[12px] font-medium transition-all duration-150 relative',
                                  active
                                    ? 'bg-[#1A1A1A] text-[#E8E8E8]'
                                    : 'text-[#A8A8A8] hover:text-[#E8E8E8] hover:bg-[#161616]'
                                )}
                              >
                                <item.icon className={cn('h-3 w-3 shrink-0', active ? 'text-[#00E085]' : 'text-[#6E6E6E] group-hover:text-[#00E085]')} />
                                <span className="flex-1">{item.label}</span>
                                {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 bg-[#00E085] shadow-[0_0_8px_rgba(0,224,133,0.8)]" />}
                              </Link>
                            )
                          })}
                        </div>
                      )}
                    </div>

                    {/* WRITER */}
                    <div>
                      <button
                        onClick={() => {
                          setWriterOpen((open) => {
                            const next = !open
                            return next
                          })
                        }}
                        className={cn(
                          'w-full flex items-center gap-2 px-2.5 py-1.5 text-[12px] font-semibold transition-all duration-150 relative',
                          writerActive
                            ? 'bg-[#1A1A1A] text-[#E8E8E8]'
                            : 'text-[#A8A8A8] hover:text-[#E8E8E8] hover:bg-[#161616]'
                        )}
                      >
                        <PenLine
                          className={cn(
                            'h-3 w-3 shrink-0 transition-colors',
                            writerActive ? 'text-[#00E085]' : 'text-[#6E6E6E]'
                          )}
                        />
                        <span className="flex-1 text-left">WRITER</span>
                        {writerOpen
                          ? <ChevronDown className="h-3 w-3 text-[#6E6E6E]" />
                          : <ChevronRight className="h-3 w-3 text-[#6E6E6E]" />
                        }
                        {writerActive && (
                          <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 bg-[#00E085] shadow-[0_0_6px_rgba(0,224,133,0.6)]" />
                        )}
                      </button>

                      {writerOpen && (
                        <div className="mt-0.5 space-y-0.5 border-l border-[#1F1F1F] ml-4 pl-1">
                          {WRITER_ITEMS.map((item) => {
                            const active = pathname === item.href || pathname.startsWith(item.href + '/')
                            return (
                              <Link
                                key={item.href}
                                href={item.href}
                                className={cn(
                                  'group flex items-center gap-2 px-2.5 py-1.5 text-[12px] font-medium transition-all duration-150 relative',
                                  active
                                    ? 'bg-[#1A1A1A] text-[#E8E8E8]'
                                    : 'text-[#A8A8A8] hover:text-[#E8E8E8] hover:bg-[#161616]'
                                )}
                              >
                                <item.icon
                                  className={cn(
                                    'h-3 w-3 shrink-0 transition-colors',
                                    active ? 'text-[#00E085]' : 'text-[#6E6E6E] group-hover:text-[#00E085]'
                                  )}
                                />
                                <span className="flex-1">{item.label}</span>
                                {active && (
                                  <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 bg-[#00E085] shadow-[0_0_6px_rgba(0,224,133,0.6)]" />
                                )}
                              </Link>
                            )
                          })}
                        </div>
                      )}
                    </div>

                    <div>
                      <button
                        onClick={() => {
                          setCreatorOpen((open) => {
                            const next = !open
                            return next
                          })
                        }}
                        className={cn(
                          'w-full flex items-center gap-2 px-2.5 py-1.5 text-[12px] font-semibold transition-all duration-150 relative',
                          creatorActive
                            ? 'bg-[#1A1A1A] text-[#E8E8E8]'
                            : 'text-[#A8A8A8] hover:text-[#E8E8E8] hover:bg-[#161616]'
                        )}
                      >
                        <PenLine
                          className={cn(
                            'h-3 w-3 shrink-0 transition-colors',
                            creatorActive ? 'text-[#00E085]' : 'text-[#6E6E6E]'
                          )}
                        />
                        <span className="flex-1 text-left">CREATOR</span>
                        {creatorOpen
                          ? <ChevronDown className="h-3 w-3 text-[#6E6E6E]" />
                          : <ChevronRight className="h-3 w-3 text-[#6E6E6E]" />
                        }
                        {creatorActive && (
                          <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 bg-[#00E085] shadow-[0_0_6px_rgba(0,224,133,0.6)]" />
                        )}
                      </button>

                      {creatorOpen && (
                        <div className="mt-0.5 space-y-0.5 border-l border-[#1F1F1F] ml-4 pl-1">
                          {CREATOR_ITEMS.map((item) => {
                            const active = pathname === item.href || pathname.startsWith(item.href + '/')
                            return (
                              <Link
                                key={item.href}
                                href={item.href}
                                className={cn(
                                  'group flex items-center gap-2 px-2.5 py-1.5 text-[12px] font-medium transition-all duration-150 relative',
                                  active
                                    ? 'bg-[#1A1A1A] text-[#E8E8E8]'
                                    : 'text-[#A8A8A8] hover:text-[#E8E8E8] hover:bg-[#161616]'
                                )}
                              >
                                <item.icon
                                  className={cn(
                                    'h-3 w-3 shrink-0 transition-colors',
                                    active ? 'text-[#00E085]' : 'text-[#6E6E6E] group-hover:text-[#00E085]'
                                  )}
                                />
                                <span className="flex-1">{item.label}</span>
                                {active && (
                                  <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 bg-[#00E085] shadow-[0_0_6px_rgba(0,224,133,0.6)]" />
                                )}
                              </Link>
                            )
                          })}
                        </div>
                      )}
                    </div>

                    <Link
                      href="/enrichment"
                      className={cn(
                        'group flex items-center gap-2 px-2.5 py-1.5 text-[12px] font-semibold transition-all duration-150 relative',
                        enrichmentActive
                          ? 'bg-[#1A1A1A] text-[#E8E8E8]'
                          : 'text-[#A8A8A8] hover:text-[#E8E8E8] hover:bg-[#161616]'
                      )}
                    >
                      <Sparkles
                        className={cn(
                          'h-3 w-3 shrink-0 transition-colors',
                          enrichmentActive ? 'text-[#00E085]' : 'text-[#6E6E6E] group-hover:text-[#00E085]'
                        )}
                      />
                      <span className="flex-1 text-left">ENRICHMENT</span>
                      {enrichmentActive && (
                        <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 bg-[#00E085] shadow-[0_0_6px_rgba(0,224,133,0.6)]" />
                      )}
                    </Link>

                    {/* FINALS */}
                    <Link
                      href="/factory/finals"
                      className={cn(
                        'group flex items-center gap-2 px-2.5 py-1.5 text-[12px] font-semibold transition-all duration-150 relative',
                        finalsActive
                          ? 'bg-[#1A1A1A] text-[#00E085] border border-[#00E085]/20'
                          : 'text-[#A8A8A8] hover:text-[#E8E8E8] hover:bg-[#161616]'
                      )}
                    >
                      <Trophy
                        className={cn(
                          'h-3 w-3 shrink-0 transition-colors',
                          finalsActive ? 'text-[#00E085]' : 'text-[#6E6E6E] group-hover:text-[#00E085]'
                        )}
                      />
                      <span className="flex-1 text-left">FINALS</span>
                      <span className="text-[8px] text-[#6E6E6E] font-mono">→ FEED</span>
                      {finalsActive && (
                        <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 bg-[#00E085] shadow-[0_0_6px_rgba(0,224,133,0.6)]" />
                      )}
                    </Link>
                  </div>
                )}
              </div>

              {/* ── FEED (04) ── expandable */}
              <div>
                <button
                  onClick={() => {
                    setFeedOpen((open) => {
                      const next = !open
                      return next
                    })
                  }}
                  className={cn(
                    'w-full flex items-center gap-2 px-2.5 py-1.5 text-[13px] font-medium transition-all duration-150 relative',
                  feedActive
                      ? 'bg-[#1A1A1A] text-[#E8E8E8]'
                      : 'text-[#A8A8A8] hover:text-[#E8E8E8] hover:bg-[#161616]'
                  )}
                >
                  <Rss
                    className={cn(
                      'h-3.5 w-3.5 shrink-0 transition-colors',
                      feedActive ? 'text-[#00E085]' : 'text-[#6E6E6E]'
                    )}
                  />
                  <span className="flex-1 text-left">FEED</span>
                  <span className="text-[10px] text-[#6E6E6E] font-mono tabular-nums">04</span>
                  {feedOpen
                    ? <ChevronDown className="h-3 w-3 text-[#6E6E6E]" />
                    : <ChevronRight className="h-3 w-3 text-[#6E6E6E]" />
                  }
                  {feedActive && (
                    <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 bg-[#00E085] shadow-[0_0_8px_rgba(0,224,133,0.8)]" />
                  )}
                </button>

                {feedOpen && (
                  <div className="mt-0.5 space-y-0.5 border-l border-[#1F1F1F] ml-5 pl-1">
                    {FEED_ITEMS.map((item) => {
                      const active = pathname === item.href || pathname.startsWith(item.href + '/')
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={cn(
                            'group flex items-center gap-2 px-2.5 py-1.5 text-[12px] font-medium transition-all duration-150 relative',
                            active
                              ? 'bg-[#1A1A1A] text-[#E8E8E8]'
                              : 'text-[#A8A8A8] hover:text-[#E8E8E8] hover:bg-[#161616]'
                          )}
                        >
                          <item.icon
                            className={cn(
                              'h-3 w-3 shrink-0 transition-colors',
                              active ? 'text-[#00E085]' : 'text-[#6E6E6E] group-hover:text-[#00E085]'
                            )}
                          />
                          <span className="flex-1">{item.label}</span>
                          {active && (
                            <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 bg-[#00E085] shadow-[0_0_8px_rgba(0,224,133,0.8)]" />
                          )}
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* ── DIVIDER ── */}
              <div className="h-px bg-[#1F1F1F] my-1 mx-1" />

              {/* ── DISTRIBUTION (05) ── */}
              <Link
                href="/distribution"
                className={cn(
                  'group flex items-center gap-2 px-2.5 py-1.5 text-[13px] font-medium transition-all duration-150 relative',
                  distributionActive
                    ? 'bg-[#111111] text-[#E8E8E8]'
                    : 'text-[#A8A8A8] hover:text-[#E8E8E8] hover:bg-[#0D0D0D]'
                )}
              >
                <Radio
                  className={cn(
                    'h-3.5 w-3.5 shrink-0 transition-colors',
                    distributionActive ? 'text-[#00E085]' : 'text-[#6E6E6E] group-hover:text-[#00E085]'
                  )}
                />
                <span className="flex-1">Distribution</span>
                <span className="text-[10px] text-[#6E6E6E] font-mono tabular-nums">05</span>
                {distributionActive && (
                  <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 bg-[#00E085] shadow-[0_0_8px_rgba(0,224,133,0.8)]" />
                )}
              </Link>

              {/* ── COMING SOON steps (04–12) ── */}
              {PROCESS_STEPS_SOON.map((step) => (
                <div
                  key={step.num}
                  className="flex items-center gap-2 px-2.5 py-1.5 text-[13px] cursor-default select-none opacity-20"
                >
                  <step.icon className="h-3.5 w-3.5 shrink-0 text-[#1F1F1F]" />
                  <span className="flex-1 text-[#6E6E6E]">{step.label}</span>
                  <span className="text-[10px] text-[#1F1F1F] font-mono tabular-nums">{step.num}</span>
                </div>
              ))}

            </div>
          )}
        </div>

        {/* Divider */}
        <div className="h-px bg-[#1F1F1F] my-2 mx-1" />

        {/* Bottom items */}
        {BOTTOM_ITEMS.map((item) => (
          <NavLink
            key={item.href}
            href={item.href}
            icon={item.icon}
            label={item.label}
            active={pathname === item.href || pathname.startsWith(item.href + '/')}
          />
        ))}

      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-[#1F1F1F] shrink-0">
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 hd-live" />
          <span className="text-[10px] text-[#6E6E6E] font-medium uppercase tracking-widest">Pipeline active</span>
        </div>
      </div>
    </aside>
  )
}
