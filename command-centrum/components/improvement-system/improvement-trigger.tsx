'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowUp, Loader2, Sparkles, X } from 'lucide-react'
import type { ImprovementProposal } from '@/lib/improvement-system/types'

function routeToSection(pathname: string) {
  if (!pathname || pathname === '/') return 'Dashboard'

  return pathname
    .split('/')
    .filter(Boolean)
    .map((part) => part.replaceAll('-', ' '))
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' / ')
}

function captureSnapshot() {
  const heading = document.querySelector('h1')?.textContent?.trim()
  const sectionTitle = document.querySelector('.section-title')?.textContent?.trim()
  const mainText = document.querySelector('main')?.textContent?.replace(/\s+/g, ' ').trim()
  const snippets = [heading, sectionTitle, mainText?.slice(0, 600)].filter(Boolean)
  return snippets.join(' | ')
}

export function ImprovementTrigger() {
  const pathname = usePathname()
  const [isRunning, setIsRunning] = useState(false)
  const [proposal, setProposal] = useState<ImprovementProposal | null>(null)
  const [error, setError] = useState<string | null>(null)
  const section = useMemo(() => routeToSection(pathname), [pathname])

  async function runImprovementManager() {
    if (isRunning) return
    setIsRunning(true)
    setError(null)

    try {
      const response = await fetch('/api/improvement-system/improvements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceSection: section,
          route: pathname,
          snapshot: captureSnapshot(),
          createdFrom: 'section-trigger',
        }),
      })

      if (!response.ok) {
        throw new Error(await response.text())
      }

      const data = (await response.json()) as { proposal: ImprovementProposal }
      setProposal(data.proposal)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Improovment Manager failed')
    } finally {
      setIsRunning(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={runImprovementManager}
        disabled={isRunning}
        className="absolute left-2 top-2 z-40 flex h-7 w-7 items-center justify-center border border-[#00E085]/35 bg-black/75 text-[#00E085] shadow-[0_0_10px_rgba(0,224,133,0.18)] transition hover:border-[#00E085]/70 hover:bg-[#00160D] disabled:opacity-40"
        title="Run IMPROOVMENT MANAGER"
        aria-label={`Run IMPROOVMENT MANAGER for ${section}`}
      >
        {isRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowUp className="h-3.5 w-3.5" />}
      </button>

      {(proposal || error) && (
        <div className="fixed left-[15rem] top-24 z-50 w-[360px] border border-white/[0.10] bg-black/85 p-4 shadow-[0_20px_55px_rgba(0,0,0,0.75)] backdrop-blur-2xl">
          <div className="flex items-start gap-2">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[#00E085]" />
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-[#00E085]">
                IMPROOVMENT MANAGER
              </div>
              {proposal ? (
                <>
                  <h2 className="mt-1 text-sm font-bold text-[#E8E8E8]">{proposal.title}</h2>
                  <p className="mt-1 text-xs leading-relaxed text-[#A8A8A8]">
                    Navrh byl ulozen do CEO / Brainstorming a je pripraveny pro Brainstorming Agenta.
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    <Link
                      href="/hd-central/ceo/brainstorming"
                      className="plastic-button-venom px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest"
                    >
                      Open brainstorming
                    </Link>
                    <span className="font-mono text-[10px] text-[#6E6E6E]">{proposal.priority}</span>
                  </div>
                </>
              ) : (
                <p className="mt-1 text-xs leading-relaxed text-[#FF5A5A]">{error}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                setProposal(null)
                setError(null)
              }}
              className="text-[#6E6E6E] hover:text-[#E8E8E8]"
              aria-label="Close improvement notification"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </>
  )
}
