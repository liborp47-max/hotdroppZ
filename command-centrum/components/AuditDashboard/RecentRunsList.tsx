import React from 'react';
import type { PipelineModuleStatus } from '../../lib/types/audit';

export interface RunRow {
  moduleName: string;
  timestamp: string;
  status: 'healthy' | 'degraded' | 'blocked' | 'retired' | 'no_data';
  message: string;
}

function statusDot(status: RunRow['status']) {
  if (status === 'healthy') return { color: '#00E085', glow: '0 0 6px rgba(0,224,133,0.8)' };
  if (status === 'degraded') return { color: '#F59E0B', glow: '0 0 6px rgba(245,158,11,0.6)' };
  if (status === 'blocked') return { color: '#EF4444', glow: '0 0 6px rgba(239,68,68,0.6)' };
  return { color: '#2A2A2A', glow: 'none' };
}

export function buildRecentRunRows(modules: PipelineModuleStatus[]): RunRow[] {
  return modules
    .map((module) => ({
      moduleName: module.name,
      timestamp: module.lastRun?.timestamp ?? new Date(0).toISOString(),
      status: module.status,
      message:
        module.lastRun
          ? module.lastRun.errorCount > 0
            ? `${module.lastRun.errorCount} errors found`
            : 'Run completed successfully'
          : 'No run data',
    }))
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 10);
}

export function RecentRunsList({
  rows,
  hasP0Blockers,
  onOpenRun,
}: {
  rows: RunRow[];
  hasP0Blockers: boolean;
  onOpenRun: (moduleName: string) => void;
}) {
  return (
    <section id="recent-runs" className="border border-[#1A1A1A] border-t-[rgba(0,224,133,0.08)] bg-[linear-gradient(160deg,#0A0A0A_0%,#000000_100%)] px-3 py-4 md:px-6">
      <h2 className="text-[20px] font-semibold uppercase tracking-widest text-[#E8E8E8]">Recent Runs &amp; Alerts</h2>

      {hasP0Blockers && (
        <div className="mt-6 border-l-2 border-[#EF4444] pl-4 text-sm text-[#E8E8E8] bg-[#EF4444]/5 py-2">
          P0 blockers detected. Resolve critical items before the next full run.
        </div>
      )}

      <div className="mt-6 space-y-1.5">
        {rows.map((row) => {
          const dot = statusDot(row.status);
          return (
            <button
              key={`${row.moduleName}-${row.timestamp}`}
              type="button"
              onClick={() => onOpenRun(row.moduleName)}
              className="group grid w-full grid-cols-[90px_90px_14px_1fr] items-center gap-3 border border-[#1A1A1A] bg-[#0A0A0A] px-3 py-2 text-left text-xs transition-all duration-150 hover:border-[#00E085]/40 hover:shadow-[0_0_12px_rgba(0,224,133,0.1)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#00E085]"
            >
              <span className="text-right font-mono text-[#404040]">{new Date(row.timestamp).toLocaleTimeString()}</span>
              <span className="text-[#E8E8E8] uppercase tracking-widest text-[10px] font-semibold">{row.moduleName}</span>
              <span className="inline-flex items-center justify-center">
                <span style={{ width: '6px', height: '6px', backgroundColor: dot.color, boxShadow: dot.glow !== 'none' ? dot.glow : undefined }} />
              </span>
              <span className="truncate text-[#A8A8A8] group-hover:text-[#00E085] transition-colors duration-150">
                {row.message}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
