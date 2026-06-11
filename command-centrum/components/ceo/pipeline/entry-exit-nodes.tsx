'use client'

import Link from 'next/link'
import { Cloud, Globe } from 'lucide-react'

export function EntryCloudNode() {
  return (
    <Link
      href="/sources"
      aria-label="Sources — pipeline entry"
      className="plastic-card flex w-[140px] shrink-0 flex-col items-center justify-center gap-2 rounded-md border border-white/[0.06] bg-white/[0.02] px-3 py-4 text-center transition-colors hover:border-white/[0.15] focus:outline-2 focus:outline-[#00E085]/60 focus:outline-offset-2"
    >
      <Cloud aria-hidden className="h-6 w-6 text-[#A8A8A8]" />
      <span className="text-[10px] uppercase tracking-widest text-[#A8A8A8]">From sources</span>
      <span className="text-[9px] font-mono text-[#6E6E6E]">RSS · API · workers</span>
    </Link>
  )
}

export function ExitFeedNode() {
  return (
    <Link
      href="/feed/published"
      aria-label="Public feed — pipeline exit"
      className="plastic-card flex w-[140px] shrink-0 flex-col items-center justify-center gap-2 rounded-md border border-white/[0.06] bg-white/[0.02] px-3 py-4 text-center transition-colors hover:border-white/[0.15] focus:outline-2 focus:outline-[#00E085]/60 focus:outline-offset-2"
    >
      <Globe aria-hidden className="h-6 w-6 text-[#1AEE99]" />
      <span className="text-[10px] uppercase tracking-widest text-[#A8A8A8]">Public feed</span>
      <span className="text-[9px] font-mono text-[#6E6E6E]">hotdroppz.com</span>
    </Link>
  )
}
