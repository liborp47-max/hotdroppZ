'use client'

import { usePathname } from 'next/navigation'
import { Bell, ChevronRight, KeyRound, LogOut, User } from 'lucide-react'
import { PromptModule } from '@/components/prompt-module/prompt-module'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { TestModeBadge, useTestMode } from './test-mode-context'

// AUD-UX-001: labels for the REAL dashboard routes (the old map listed retired
// routes like inbox/curated/cms/preview, so every real page fell through to a
// raw slug). Unknown slugs now title-case gracefully instead of showing raw.
const BREADCRUMB_LABELS: Record<string, string> = {
  'hd-central': 'HD Central',
  'scout-hq': 'Scout HQ',
  sources: 'Sources',
  feed: 'Feed',
  creator: 'Creator',
  'creator-facts': 'Creator Facts',
  'creator-queue': 'Creator Queue',
  'story-builder': 'Story Builder',
  published: 'Published',
  monetization: 'Monetization',
  analytics: 'Analytics',
  distribution: 'Distribution',
  'ai-control': 'AI Control',
  learning: 'Learning',
  writer: 'Writer',
  factory: 'Factory',
}

function titleCaseSlug(slug: string): string {
  if (!slug) return 'Home'
  return slug.split('-').map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w)).join(' ')
}

interface HeaderProps {
  userEmail?: string | null
  pendingCount?: number
}

export function Header({ userEmail, pendingCount = 0 }: HeaderProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { enabled: testMode, setEnabled: setTestMode } = useTestMode()

  const segments = pathname.split('/').filter(Boolean)
  const currentPage = segments[0]
  const pageLabel = BREADCRUMB_LABELS[currentPage] ?? titleCaseSlug(currentPage)

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <header className="flex items-center justify-between h-12 px-5 border-b border-white/[0.06] bg-black/60 backdrop-blur-2xl backdrop-saturate-150 flex-shrink-0">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm">
        <span className="text-[#00E085] text-[10px] uppercase tracking-widest font-semibold [text-shadow:0_0_6px_rgba(0,224,133,0.40)]">HDCC</span>
        <ChevronRight className="h-3.5 w-3.5 text-[#404040]" />
        <span className="text-[#E8E8E8] font-medium uppercase tracking-wider text-xs">{pageLabel}</span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {/* Prompt Module */}
        <PromptModule />

        {/* Notifications */}
        <button
          type="button"
          aria-label={pendingCount > 0 ? `Notifications (${pendingCount} pending)` : 'Notifications'}
          title="Notifications"
          className="relative p-1.5 text-[#A8A8A8] hover:text-[#00E085] hover:bg-white/[0.04] transition-all duration-150"
        >
          <Bell className="h-4 w-4" />
          {pendingCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[16px] h-4 px-0.5 bg-[#00E085] text-[9px] font-bold text-black shadow-[0_0_10px_rgba(0,224,133,0.8)]">
              {pendingCount > 99 ? '99+' : pendingCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setTestMode(!testMode)}
          className={`flex h-7 items-center gap-2 border px-2 text-[11px] font-semibold uppercase tracking-wider backdrop-blur-md transition-all duration-150 ${
            testMode
              ? 'border-[#00E085]/45 bg-[rgba(0,224,133,0.10)] text-[#00E085] shadow-[0_0_10px_rgba(0,224,133,0.20)]'
              : 'border-white/10 bg-white/[0.03] text-[#A8A8A8] hover:border-white/20 hover:text-[#E8E8E8]'
          }`}
          aria-pressed={testMode}
          title={testMode ? 'Přepnout na ostrou verzi' : 'Přepnout na testovací verzi'}
        >
          <span>TEST MODE:</span>
          <span>{testMode ? 'ON' : 'OFF'}</span>
        </button>
        <TestModeBadge />

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center justify-center w-7 h-7 bg-white/[0.03] backdrop-blur-md border border-white/10 text-[#E8E8E8] text-xs font-semibold hover:border-[#00E085]/60 hover:text-[#00E085] hover:shadow-[0_0_10px_rgba(0,224,133,0.25)] transition-all duration-150">
              {userEmail ? userEmail[0].toUpperCase() : <User className="h-3.5 w-3.5" />}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[#404040]">Signed in as</p>
                <p className="text-xs text-[#A8A8A8] truncate">{userEmail ?? 'Unknown'}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="gap-2 text-[#888888] focus:text-[#00E085] focus:bg-[#00E085]/10"
              onClick={() => router.push('/account')}
            >
              <KeyRound className="h-4 w-4" />
              Change password
            </DropdownMenuItem>
            <DropdownMenuItem
              className="gap-2 text-[#888888] focus:text-[#00E085] focus:bg-[#00E085]/10"
              onClick={handleSignOut}
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
