import { ShieldCheck } from 'lucide-react'
import { AuditDashboard } from '@/components/AuditDashboard/AuditDashboard'
import { AuditDriftPanel } from './audit-drift-panel'

export const metadata = {
  title: 'Auditor | HD Central',
  description: 'Audit dashboard for HDCC compliance + drift detection',
}

// UM-AUDITOR SM-1 — mount existing AuditDashboard component
// (run-20260528-um-auditor-46590949). The adapter at
// lib/audit-dashboard/adapter.ts handles loading: tries the audits + pipeline
// APIs first, falls back to mock data on timeout/error. When both env vars
// are undefined (default dev), render is mock-only.
//
// notesKey is the localStorage key for per-user audit dashboard notes.
export default function AuditorPage() {
  return (
    <div className="flex flex-col h-full">
      <header className="px-6 py-5 border-b border-[#1A1A1A]">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-[#5C9A72] font-semibold">
          <ShieldCheck className="h-3 w-3" />
          <span>HD Central / Auditor</span>
        </div>
        <h1 className="text-2xl font-bold text-[#E8E8E8] mt-1">Auditor</h1>
        <p className="text-sm text-[#A8A8A8] mt-1">Compliance, odchylky od Plan, system drift. Listing predchozich auditu + detailni vystupy s vygenerovanymi prompty.</p>
      </header>
      <main className="flex-1 overflow-y-auto">
        <AuditDriftPanel />
        <AuditDashboard
          notesKey="hdcc:audit-dashboard:notes"
          auditApiBaseUrl={process.env.NEXT_PUBLIC_AUDIT_API_BASE_URL}
          pipelineApiBaseUrl={process.env.NEXT_PUBLIC_PIPELINE_API_BASE_URL}
          layoutMode="grid"
        />
      </main>
    </div>
  )
}
