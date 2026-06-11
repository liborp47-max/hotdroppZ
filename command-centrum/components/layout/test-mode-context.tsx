'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { TEST_MODE, TEST_MODE_STORAGE_KEY } from '@/config/testMode'

type TestModeContextValue = {
  enabled: boolean
  setEnabled: (enabled: boolean) => void
}

const TestModeContext = createContext<TestModeContextValue | null>(null)

export function TestModeProvider({ children }: { children: React.ReactNode }) {
  const [enabled, setEnabledState] = useState(TEST_MODE)

  useEffect(() => {
    const stored = window.localStorage.getItem(TEST_MODE_STORAGE_KEY)
    if (stored === 'true') setEnabledState(true)
    if (stored === 'false') setEnabledState(false)
  }, [])

  const setEnabled = useCallback((nextEnabled: boolean) => {
    setEnabledState(nextEnabled)
    window.localStorage.setItem(TEST_MODE_STORAGE_KEY, String(nextEnabled))
  }, [])

  return (
    <TestModeContext.Provider value={{ enabled, setEnabled }}>
      {children}
    </TestModeContext.Provider>
  )
}

export function useTestMode() {
  const ctx = useContext(TestModeContext)
  if (!ctx) throw new Error('useTestMode must be used inside <TestModeProvider>')
  return ctx
}

export function TestModeBadge({ className = '' }: { className?: string }) {
  const { enabled } = useTestMode()
  if (!enabled) return null

  return (
    <span className={`inline-flex items-center border border-amber-400/40 bg-amber-400/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-200 ${className}`}>
      TEST MODE ACTIVE
    </span>
  )
}

