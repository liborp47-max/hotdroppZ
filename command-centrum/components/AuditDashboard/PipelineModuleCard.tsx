import React from 'react';
import type { PipelineModuleStatus } from '../../lib/types/audit';

function moduleStatusStyle(status: PipelineModuleStatus['status']) {
  if (status === 'healthy') return { dot: '#00E085', glow: 'rgba(0,224,133,0.8)', label: 'HEALTHY' };
  if (status === 'degraded') return { dot: '#F59E0B', glow: 'rgba(245,158,11,0.6)', label: 'DEGRADED' };
  if (status === 'blocked') return { dot: '#EF4444', glow: 'rgba(239,68,68,0.6)', label: 'BLOCKED' };
  if (status === 'retired') return { dot: '#2A2A2A', glow: 'none', label: 'RETIRED' };
  return { dot: '#2A2A2A', glow: 'none', label: 'NO DATA' };
}

function runResultLabel(module: PipelineModuleStatus) {
  const result = module.lastRun?.result;
  if (result) return result.toUpperCase();
  if (!module.lastRun) return 'NO DATA';
  return module.lastRun.errorCount > 0 ? 'ERROR' : 'SUCCESS';
}

export function PipelineModuleCard({
  module,
  onOpen,
}: {
  module: PipelineModuleStatus;
  onOpen: (module: PipelineModuleStatus) => void;
}) {
  const status = moduleStatusStyle(module.status);
  const hasErrors = (module.lastRun?.errorCount ?? 0) > 0;

  return (
    <button
      type="button"
      onClick={() => onOpen(module)}
      className="group w-full border border-[#1A1A1A] border-t-[rgba(0,224,133,0.08)] bg-[linear-gradient(160deg,#0A0A0A_0%,#000000_100%)] px-4 py-3 text-left transition-all duration-150 hover:border-[#00E085]/40 hover:bg-[#0E1610] hover:shadow-[0_0_14px_rgba(0,224,133,0.12)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#00E085]"
      aria-label={`Open detail ${module.name}`}
    >
      <div className="flex items-center gap-2">
        <p className="text-[10px] uppercase tracking-widest text-[#E8E8E8] font-semibold">{module.name}</p>
        <span
          style={{
            width: '6px', height: '6px',
            backgroundColor: status.dot,
            boxShadow: status.glow !== 'none' ? `0 0 6px ${status.glow}` : undefined,
            animation: status.label === 'HEALTHY' ? 'hd-pulse 2s infinite' : undefined,
          }}
        />
      </div>

      <p className="mt-2 text-[11px] text-[#404040] font-mono">
        {module.lastRun ? new Date(module.lastRun.timestamp).toLocaleString() : 'Missing data'}
      </p>

      <p className="mt-1 text-[11px] text-[#A8A8A8]">
        {status.label} — {runResultLabel(module)} — {hasErrors ? `${module.lastRun?.errorCount ?? 0} errors` : 'No errors'}
      </p>
    </button>
  );
}
