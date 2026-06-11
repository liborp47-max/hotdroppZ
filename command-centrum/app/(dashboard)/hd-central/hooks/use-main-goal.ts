'use client'

import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'hd-central:main-goal'

type GoalState = {
  value: string
  author: string
  updatedAt: string
}

const DEFAULT_GOAL: GoalState = {
  value: 'Deliver top-tier content pipeline and command governance with zero strategic drift.',
  author: 'SYSTEM AUDITOR',
  updatedAt: new Date().toISOString(),
}

export function useMainGoal() {
  const [goal, setGoal] = useState<GoalState>(DEFAULT_GOAL)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as GoalState
        if (parsed?.value && parsed?.author && parsed?.updatedAt) {
          setGoal(parsed)
        }
      }
      setError(null)
    } catch {
      setError('Failed to load main goal')
    } finally {
      setLoading(false)
    }
  }, [])

  const saveGoal = useCallback(async (value: string, author: string) => {
    setLoading(true)
    try {
      const next: GoalState = {
        value: value.trim(),
        author: author.trim() || 'SYSTEM AUDITOR',
        updatedAt: new Date().toISOString(),
      }
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      setGoal(next)
      setError(null)
    } catch {
      setError('Failed to save main goal')
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    goal,
    loading,
    error,
    saveGoal,
  }
}
