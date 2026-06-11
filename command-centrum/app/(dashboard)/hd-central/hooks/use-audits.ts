'use client'

import { useCallback, useMemo, useState } from 'react'
import type { AuditDetail } from '@/lib/hd-central/types'

const AUDIT_SEED: AuditDetail[] = [
  {
    id: 'AUD-20260513-01',
    title: 'Missing HD Central runtime modules',
    severity: 'High',
    status: 'In Progress',
    date: '2026-05-13T09:00:00.000Z',
    risks: ['Build blocker in production pipeline', 'UI section unavailable after deploy'],
    dependencies: ['Type exports in lib/hd-central/types', 'Hooks in app/(dashboard)/hd-central/hooks'],
    remediation: ['Doplnit chybejici moduly', 'Pridat focused build check do CI'],
    openQuestions: ['Jak casto probehne full build gate?'],
  },
  {
    id: 'AUD-20260512-02',
    title: 'Pipeline writer stage degraded',
    severity: 'Medium',
    status: 'Open',
    date: '2026-05-12T18:30:00.000Z',
    risks: ['Nedokoncena persistence writer outputu'],
    dependencies: ['AI provider adapter', 'DB write transaction'],
    remediation: ['Dokoncit writer implementaci', 'Dodat integration testy'],
    openQuestions: ['Pozadovane SLO pro writer stage?'],
  },
]

type SeverityFilter = 'all' | 'Critical' | 'High' | 'Medium' | 'Low' | 'Unknown'
type DateFilter = 'all' | '7d' | '30d' | '90d'

function inDateRange(dateIso: string, filter: DateFilter): boolean {
  if (filter === 'all') return true
  const now = Date.now()
  const date = new Date(dateIso).getTime()
  const dayMs = 24 * 60 * 60 * 1000
  if (filter === '7d') return now - date <= 7 * dayMs
  if (filter === '30d') return now - date <= 30 * dayMs
  return now - date <= 90 * dayMs
}

export function useAudits() {
  const [audits] = useState<AuditDetail[]>(AUDIT_SEED)
  const [selectedAudit, setSelectedAudit] = useState<AuditDetail | null>(AUDIT_SEED[0] ?? null)
  const [loading] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error] = useState<string | null>(null)
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all')
  const [dateFilter, setDateFilter] = useState<DateFilter>('all')

  const filteredAudits = useMemo(() => {
    return audits.filter((audit) => {
      const severityOk = severityFilter === 'all' || audit.severity === severityFilter
      const dateOk = inDateRange(audit.date, dateFilter)
      return severityOk && dateOk
    })
  }, [audits, dateFilter, severityFilter])

  const loadAuditDetail = useCallback(async (id: string) => {
    setDetailLoading(true)
    try {
      const found = audits.find((audit) => audit.id === id) ?? null
      setSelectedAudit(found)
    } finally {
      setDetailLoading(false)
    }
  }, [audits])

  return {
    filteredAudits,
    selectedAudit,
    loading,
    detailLoading,
    error,
    severityFilter,
    setSeverityFilter,
    dateFilter,
    setDateFilter,
    loadAuditDetail,
  }
}
