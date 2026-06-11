import React from 'react';
import type { AuditReport } from '../../lib/types/audit';

function statusColor(status: 'Red' | 'Amber' | 'Green') {
  if (status === 'Red') return '#EF4444';
  if (status === 'Amber') return '#F59E0B';
  return '#00E085';
}

function summarize(audit: AuditReport | null) {
  if (!audit) {
    return [
      'The current audit payload is unavailable.',
      'This means the team does not have a verified issue snapshot yet.',
      'If this stays unresolved, the next release may move without clear risk visibility.',
    ];
  }

  const firstRisk = audit.topRisks[0] ?? 'Current risk tracking is incomplete and needs review.';
  return [
    `The primary issue is in ${audit.scope.toLowerCase()}.`,
    'In practice, this impacts delivery confidence and day-to-day operational clarity.',
    `If we skip it, the risk is that ${firstRisk.toLowerCase()}`,
  ].slice(0, 4);
}

function freshnessLabel(iso?: string) {
  if (!iso) return 'Missing';
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.max(1, Math.floor(diffMs / 60000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export function AuditSummary({
  audit,
  counts,
  onOpenDetails,
  onOpenPipeline,
}: {
  audit: AuditReport | null;
  counts: { p0: number; p1: number; p2: number; p3: number };
  onOpenDetails?: () => void;
  onOpenPipeline?: () => void;
}) {
  const summaryLines = summarize(audit);
  const status = audit?.status ?? 'Amber';
  const openRisks = counts.p0 + counts.p1;
  const integrity = Math.max(40, 100 - (counts.p0 * 18 + counts.p1 * 8 + counts.p2 * 4));

  return (
    <section
      id="audit-summary"
      className="border border-[#1A1A1A] border-t-[rgba(0,224,133,0.12)] bg-[linear-gradient(160deg,#0A0A0A_0%,#000000_100%)] px-3 py-4 shadow-[0_0_28px_rgba(0,224,133,0.06)] md:px-6 md:py-6"
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-[#00E085] font-semibold" style={{textShadow: '0 0 8px rgba(0,224,133,0.5)'}}>Auditor Command Surface</p>
          <h2 className="mt-1 text-[20px] font-semibold uppercase tracking-widest text-[#E8E8E8]">Audit Summary</h2>
          <p className="mt-2 text-sm text-[#A8A8A8]">
            <span className="font-mono text-[#E8E8E8]">{audit?.id ?? 'N/A'}</span> — {audit?.scope ?? 'N/A'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onOpenDetails}
            className="border border-[#00E085]/30 bg-[#00E085]/10 px-3 py-1 text-[10px] uppercase tracking-widest text-[#00E085] transition-all duration-150 hover:shadow-[0_0_12px_rgba(0,224,133,0.3)]"
          >
            Health: {status}
          </button>
          <button
            type="button"
            onClick={onOpenDetails}
            className="border border-[#00E085]/30 bg-[#00E085]/10 px-3 py-1 text-[10px] uppercase tracking-widest text-[#00E085] transition-all duration-150 hover:shadow-[0_0_14px_rgba(0,224,133,0.4)]"
          >
            Integrity: {integrity}%
          </button>
          <button
            type="button"
            onClick={onOpenDetails}
            className="border border-[#F59E0B]/30 bg-[#F59E0B]/10 px-3 py-1 text-[10px] uppercase tracking-widest text-[#F59E0B] transition-all duration-150 hover:shadow-[0_0_12px_rgba(245,158,11,0.3)]"
          >
            Risk: {openRisks}
          </button>
          <button
            type="button"
            onClick={onOpenPipeline}
            className="border border-[#1A1A1A] bg-transparent px-3 py-1 text-[10px] uppercase tracking-widest text-[#A8A8A8] transition-all duration-150 hover:border-[#00E085] hover:text-[#00E085] hover:shadow-[0_0_12px_rgba(0,224,133,0.2)]"
          >
            Freshness: {freshnessLabel(audit?.auditDate)}
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-2 md:grid-cols-4">
        {[
          { label: 'P0 Blockers', value: counts.p0, onClick: onOpenDetails },
          { label: 'P1 Actions', value: counts.p1, onClick: onOpenDetails },
          { label: 'P2 Actions', value: counts.p2, onClick: onOpenDetails },
          { label: 'Pipeline Watch', value: counts.p3, onClick: onOpenPipeline },
        ].map((metric) => (
          <button
            key={metric.label}
            type="button"
            onClick={metric.onClick}
            className="border border-[#1A1A1A] border-t-[rgba(0,224,133,0.08)] bg-[#0A0A0A] px-3 py-3 text-left transition-all duration-150 hover:border-[#00E085]/40 hover:shadow-[0_0_14px_rgba(0,224,133,0.15)]"
          >
            <p className="text-[10px] uppercase tracking-widest text-[#404040]">{metric.label}</p>
            <p className="mt-1 text-[27px] font-semibold text-[#00E085]" style={{textShadow: '0 0 14px rgba(0,224,133,0.5)'}}>{metric.value}</p>
          </button>
        ))}
      </div>

      <div className="mt-6 grid gap-1 text-center text-[15px] leading-[1.6] text-[#E8E8E8] md:text-left">
        {summaryLines.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>
    </section>
  );
}
