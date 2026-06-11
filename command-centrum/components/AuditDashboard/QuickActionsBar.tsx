import React from 'react';

export function QuickActionsBar({
  onViewAllAudits,
  onRunFullPipeline,
  onCheckLogs,
  onOpenSettings,
}: {
  onViewAllAudits: () => void;
  onRunFullPipeline: () => void;
  onCheckLogs: () => void;
  onOpenSettings: () => void;
}) {
  return (
    <section id="quick-actions" className="border border-[#1A1A1A] border-t-[rgba(0,224,133,0.08)] bg-[linear-gradient(160deg,#0A0A0A_0%,#000000_100%)] px-3 pb-6 pt-4 md:px-6">
      <h2 className="text-[20px] font-semibold uppercase tracking-widest text-[#E8E8E8]">Quick Actions</h2>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-x-4 sm:gap-y-3">
        <button
          type="button"
          className="border border-[#1A1A1A] bg-transparent px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-widest text-[#A8A8A8] transition-all duration-150 hover:border-[#00E085] hover:text-[#00E085] hover:shadow-[0_0_12px_rgba(0,224,133,0.2)]"
          onClick={onViewAllAudits}
        >
          View All Audits
        </button>
        <button
          type="button"
          className="border border-[#00E085] bg-[#00E085] px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-widest text-black transition-all duration-150 hover:bg-[#1AEE99] hover:shadow-[0_0_24px_rgba(0,224,133,0.7),0_0_48px_rgba(0,224,133,0.25)] hover:-translate-y-px"
          onClick={onRunFullPipeline}
        >
          Run Full Pipeline
        </button>
        <button
          type="button"
          className="border border-[#1A1A1A] bg-transparent px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-widest text-[#A8A8A8] transition-all duration-150 hover:border-[#00E085] hover:text-[#00E085] hover:shadow-[0_0_12px_rgba(0,224,133,0.2)]"
          onClick={onCheckLogs}
        >
          Check Logs
        </button>
        <button
          type="button"
          className="border border-[#1A1A1A] bg-transparent px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-widest text-[#A8A8A8] transition-all duration-150 hover:border-[#2A2A2A] hover:text-[#E8E8E8]"
          onClick={onOpenSettings}
        >
          Settings
        </button>
      </div>
    </section>
  );
}
