'use client';

import React from 'react';
import { useEffect, useMemo, useState } from 'react';
import type {
  AuditActionItem,
  AuditFinding,
  AuditListItem,
  AuditReport,
  PipelineModuleStatus,
} from '../../lib/types/audit';
import {
  ErrorState,
} from './BaseComponents';
import type { DashboardInputConfig } from '../../lib/audit-dashboard/adapter';
import {
  createAuditDashboardFallback,
  fetchAuditDetail,
  loadAuditDashboardState,
} from '../../lib/audit-dashboard/adapter';
import { AuditSummary } from './AuditSummary';
import { ExpandableAuditCard } from './ExpandableAuditCard';
import { PipelineModuleCard } from './PipelineModuleCard';
import { RecentRunsList, buildRecentRunRows } from './RecentRunsList';
import { QuickActionsBar } from './QuickActionsBar';

interface AuditDashboardProps extends DashboardInputConfig {
  initialSelectedAuditId?: string;
}

const ALL_PIPELINE_MODULES = [
  'scout',
  'filter',
  'curator',
  'cluster',
  'enrichment',
  'feed',
  'writer',
  'translator',
  'monetizer',
  'graphics',
  'final-check',
];

const LEGACY_MODULES = ['translator', 'monetizer'];

function formatTimestamp(iso?: string) {
  if (!iso) return 'Missing data';
  return new Date(iso).toLocaleString();
}

function groupedActions(actions: AuditActionItem[]) {
  return {
    next_24h: actions.filter((item) => item.timeframe === 'next_24h'),
    sprint: actions.filter((item) => item.timeframe === 'sprint'),
    backlog: actions.filter((item) => item.timeframe === 'backlog'),
  };
}

function getTrendStates(module: PipelineModuleStatus) {
  if (module.recentRuns && module.recentRuns.length > 0) {
    return module.recentRuns.slice(0, 5).map((run) => run.result);
  }
  if (!module.lastRun) return ['no_data', 'no_data', 'no_data', 'no_data', 'no_data'] as const;

  const base = module.lastRun.errorCount > 0 ? 'error' : module.status === 'degraded' ? 'degraded' : 'success';
  return [base, base, base, base, base] as const;
}

function trendDotColor(state: string) {
  if (state === 'success') return '#00E085';
  if (state === 'degraded') return '#F59E0B';
  if (state === 'error') return '#EF4444';
  return '#2A2A2A';
}

export function DetailDrawer({
  auditDetail,
  pipelineModule,
}: {
  auditDetail: AuditReport | null;
  pipelineModule: PipelineModuleStatus | null;
}) {
  if (!auditDetail && !pipelineModule) {
    return (
      <aside className="h-full p-6 bg-[#000000]">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#404040]">Detail Panel</p>
        <p className="mt-4 border border-[#1A1A1A] border-t-[rgba(0,224,133,0.08)] bg-[#0A0A0A] p-3 text-sm leading-[1.6] text-[#A8A8A8]">Select an audit or a pipeline module.</p>
      </aside>
    );
  }

  if (pipelineModule) {
    const trend = getTrendStates(pipelineModule);
    const lastError = pipelineModule.recentErrors?.[0] ?? 'Missing data';
    const recommendation =
      pipelineModule.status === 'healthy'
        ? 'The module is stable. Keep monitoring and continue regular run checks.'
        : pipelineModule.status === 'degraded'
          ? 'The module is degraded. Prioritize upstream timeout and retry diagnostics.'
          : pipelineModule.status === 'blocked'
            ? 'The module is blocked. Do not run dependent pipeline stages until resolved.'
            : pipelineModule.status === 'retired'
              ? 'This module is retired. Verify all dependencies are rerouted to active modules.'
              : 'Module data is unavailable. Recover data flow before diagnostics.';

    return (
      <aside className="h-full overflow-y-auto p-6 bg-[#000000]">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-[#E8E8E8]">{pipelineModule.name}</h2>
          <span className="inline-flex items-center gap-2 text-[10px] uppercase tracking-widest text-[#A8A8A8]">
            <span
              style={{
                width: '6px', height: '6px',
                backgroundColor:
                  pipelineModule.status === 'healthy'
                    ? '#00E085'
                    : pipelineModule.status === 'degraded'
                      ? '#F59E0B'
                      : pipelineModule.status === 'blocked'
                        ? '#EF4444'
                        : '#2A2A2A',
                boxShadow:
                  pipelineModule.status === 'healthy' ? '0 0 6px rgba(0,224,133,0.8)'
                  : pipelineModule.status === 'degraded' ? '0 0 6px rgba(245,158,11,0.6)'
                  : pipelineModule.status === 'blocked' ? '0 0 6px rgba(239,68,68,0.6)'
                  : 'none',
              }}
            />
            {pipelineModule.status}
          </span>
        </div>

        <div className="mt-6 space-y-1.5 text-xs text-[#A8A8A8]">
          <p>
            Name: <span className="font-mono text-[#E8E8E8]">{pipelineModule.name.toUpperCase()}</span>
          </p>
          <p>
            ID: <span className="font-mono text-[#E8E8E8]">{pipelineModule.moduleId ?? pipelineModule.name.toUpperCase()}</span>
          </p>
        </div>

        <section className="mt-8 border border-[#1A1A1A] border-t-[rgba(0,224,133,0.08)] bg-[#0A0A0A] p-3">
          <p className="text-[10px] uppercase tracking-widest text-[#404040]">Error trend (5 runs)</p>
          <div className="mt-3 flex items-center gap-3">
            {trend.map((state, index) => (
              <span
                key={`${state}-${index}`}
                style={{ width: '6px', height: '6px', backgroundColor: trendDotColor(state) }}
              />
            ))}
          </div>
        </section>

        <section className="mt-2 border border-[#1A1A1A] border-t-[rgba(0,224,133,0.08)] bg-[#0A0A0A] p-3">
          <p className="text-[10px] uppercase tracking-widest text-[#404040]">Latest error message</p>
          <p className="mt-2 text-sm leading-[1.6] text-[#E8E8E8]">{lastError}</p>
        </section>

        <section className="mt-2 border border-[#1A1A1A] border-t-[rgba(0,224,133,0.08)] bg-[#0A0A0A] p-3">
          <p className="text-[10px] uppercase tracking-widest text-[#404040]">Recommended action</p>
          <p className="mt-2 text-sm leading-[1.6] text-[#E8E8E8]">{recommendation}</p>
        </section>

        <section className="mt-2 border border-[#1A1A1A] border-t-[rgba(0,224,133,0.08)] bg-[#0A0A0A] p-3">
          <p className="text-[10px] uppercase tracking-widest text-[#404040]">Related audit finding</p>
          <p className="mt-2 font-mono text-sm text-[#E8E8E8]">
            {pipelineModule.relatedAuditFindings?.[0] ?? 'Missing data'}
          </p>
        </section>
      </aside>
    );
  }
  const grouped = groupedActions(auditDetail?.actions ?? []);

  const findFindingForAction = (action: AuditActionItem): AuditFinding | undefined => {
    return auditDetail?.findings.find((finding) => finding.id === action.findingId) ?? auditDetail?.findings[0];
  };

  return (
    <aside className="h-full overflow-y-auto p-6 bg-[#000000]">
      <div className="space-y-3">
        <h2 className="text-[10px] font-semibold uppercase tracking-widest text-[#404040]">Audit Details</h2>
      </div>

      <div className="mt-5 space-y-5">
        <section className="space-y-2">
          <h3 className="text-[10px] font-semibold uppercase tracking-widest text-[#00E085]" style={{textShadow: '0 0 8px rgba(0,224,133,0.4)'}}>Next 24h</h3>
          {grouped.next_24h.length === 0 ? (
            <p className="border border-[#1A1A1A] bg-[#000000] p-3 text-sm text-[#404040]">Missing data</p>
          ) : (
            grouped.next_24h.map((action) => (
              <ExpandableAuditCard
                key={action.id}
                action={action}
                finding={findFindingForAction(action)}
                auditId={auditDetail?.id ?? 'N/A'}
              />
            ))
          )}
        </section>

        <section className="space-y-2">
          <h3 className="text-[10px] font-semibold uppercase tracking-widest text-[#A8A8A8]">Sprint</h3>
          {grouped.sprint.length === 0 ? (
            <p className="border border-[#1A1A1A] bg-[#000000] p-3 text-sm text-[#404040]">Missing data</p>
          ) : (
            grouped.sprint.map((action) => (
              <ExpandableAuditCard
                key={action.id}
                action={action}
                finding={findFindingForAction(action)}
                auditId={auditDetail?.id ?? 'N/A'}
              />
            ))
          )}
        </section>

        <section className="space-y-2">
          <h3 className="text-[10px] font-semibold uppercase tracking-widest text-[#404040]">Backlog</h3>
          {grouped.backlog.length === 0 ? (
            <p className="border border-[#1A1A1A] bg-[#000000] p-3 text-sm text-[#404040]">Missing data</p>
          ) : (
            grouped.backlog.map((action) => (
              <ExpandableAuditCard
                key={action.id}
                action={action}
                finding={findFindingForAction(action)}
                auditId={auditDetail?.id ?? 'N/A'}
              />
            ))
          )}
        </section>
      </div>
    </aside>
  );
}

export function AuditDashboard({
  auditApiBaseUrl,
  pipelineApiBaseUrl,
  notesKey,
  defaultFilters,
  layoutMode = 'grid',
  initialSelectedAuditId,
}: AuditDashboardProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [audits, setAudits] = useState<AuditListItem[]>([]);
  const [auditDetail, setAuditDetail] = useState<AuditReport | null>(null);
  const [selectedAuditDetail, setSelectedAuditDetail] = useState<AuditReport | null>(null);
  const [pipelineModules, setPipelineModules] = useState<PipelineModuleStatus[]>([]);
  const [selectedAuditId, setSelectedAuditId] = useState<string | undefined>(initialSelectedAuditId);
  const [selectedPipelineName, setSelectedPipelineName] = useState<string | undefined>();
  const [pipelineDrawerOpen, setPipelineDrawerOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      setLoading(true);
      const state = await loadAuditDashboardState({
        auditApiBaseUrl,
        pipelineApiBaseUrl,
        notesKey,
        defaultFilters,
        layoutMode,
      });

      if (!mounted) return;
      setAudits(state.audits);
      setAuditDetail(state.auditDetail);
      setPipelineModules(state.pipelineModules);
      setError(state.error);
      setLoading(false);
      setSelectedAuditId((current) => current ?? initialSelectedAuditId ?? state.audits[0]?.id);
    })();

    return () => {
      mounted = false;
    };
  }, [auditApiBaseUrl, pipelineApiBaseUrl, notesKey, layoutMode, defaultFilters, initialSelectedAuditId]);

  useEffect(() => {
    let mounted = true;
    if (!selectedAuditId) {
      setSelectedAuditDetail(null);
      return () => {
        mounted = false;
      };
    }

    void (async () => {
      const detail = await fetchAuditDetail(
        { auditApiBaseUrl, pipelineApiBaseUrl, notesKey, defaultFilters, layoutMode },
        selectedAuditId,
      );
      if (!mounted) return;
      setSelectedAuditDetail(detail);
    })();

    return () => {
      mounted = false;
    };
  }, [selectedAuditId, auditApiBaseUrl, pipelineApiBaseUrl, notesKey, defaultFilters, layoutMode]);

  const selectedAudit = useMemo(() => audits.find((item) => item.id === selectedAuditId), [audits, selectedAuditId]);

  const completePipelineModules = useMemo(() => {
    const map = new Map(pipelineModules.map((module) => [module.name, module]));
    return ALL_PIPELINE_MODULES.map((name) => {
      const existing = map.get(name);
      if (existing) return existing;
      return {
        name,
        moduleId: name.toUpperCase(),
        status: 'no_data' as const,
        recentErrors: [],
        relatedAuditFindings: [],
      };
    });
  }, [pipelineModules]);

  const actionPlan = selectedAudit ? selectedAuditDetail ?? auditDetail : null;
  const selectedPipelineModule = completePipelineModules.find((module) => module.name === selectedPipelineName) ?? null;
  const activeModules = completePipelineModules.filter((module) => !LEGACY_MODULES.includes(module.name));
  const legacyModules = completePipelineModules.filter((module) => LEGACY_MODULES.includes(module.name));
  const recentRows = useMemo(() => buildRecentRunRows(completePipelineModules), [completePipelineModules]);

  const actionCounts = useMemo(() => {
    const actions = actionPlan?.actions ?? [];
    return {
      p0: actions.filter((item) => item.priority === 'P0').length,
      p1: actions.filter((item) => item.priority === 'P1').length,
      p2: actions.filter((item) => item.priority === 'P2').length,
      p3: actions.filter((item) => item.priority === 'P3').length,
    };
  }, [actionPlan]);

  const hasP0Blockers = useMemo(() => {
    const hasP0OpenAction = (actionPlan?.actions ?? []).some((item) => item.priority === 'P0' && item.state !== 'Done');
    const hasBlockedModule = completePipelineModules.some((module) => module.status === 'blocked');
    return hasP0OpenAction || hasBlockedModule;
  }, [actionPlan, completePipelineModules]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#000000] text-sm text-[#A8A8A8] uppercase tracking-widest">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#000000] px-4 py-8 text-[#E8E8E8] md:px-6 lg:px-8">
      <div className="mx-auto max-w-[1600px] space-y-12">
        {error && <ErrorState message={error} onRetry={() => window.location.reload()} />}

        <AuditSummary
          audit={actionPlan}
          counts={actionCounts}
          onOpenDetails={() => document.getElementById('audit-details')?.scrollIntoView({ behavior: 'smooth' })}
          onOpenPipeline={() => document.getElementById('pipeline-modules')?.scrollIntoView({ behavior: 'smooth' })}
        />

        <section id="audit-details" className="border border-[#1A1A1A] border-t-[rgba(0,224,133,0.08)] bg-[linear-gradient(160deg,#0A0A0A_0%,#000000_100%)] px-3 py-4 md:px-6">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-6">
            <h2 className="text-[20px] font-semibold uppercase tracking-widest text-[#E8E8E8]">Audit Details</h2>
            <div className="flex items-center gap-2 text-xs text-[#A8A8A8]">
              <span className="font-mono text-[10px] uppercase tracking-widest">Selected:</span>
              <span className="font-mono text-[#00E085]" style={{textShadow: '0 0 8px rgba(0,224,133,0.4)'}}>{selectedAudit?.id ?? 'N/A'}</span>
            </div>
          </div>

          <div className="mt-2 space-y-1.5">
            {audits.map((audit) => (
              <button
                key={audit.id}
                type="button"
                onClick={() => {
                  setSelectedAuditId(audit.id);
                  setSelectedPipelineName(undefined);
                  setPipelineDrawerOpen(false);
                }}
                className="flex w-full items-center justify-between border border-[#1A1A1A] bg-[#0A0A0A] px-3 py-2 text-left text-xs transition-all duration-150 hover:border-[#00E085]/40 hover:shadow-[0_0_12px_rgba(0,224,133,0.12)]"
                style={{
                  color: selectedAuditId === audit.id ? '#00E085' : '#E8E8E8',
                  borderColor: selectedAuditId === audit.id ? 'rgba(0,224,133,0.4)' : undefined,
                  boxShadow: selectedAuditId === audit.id ? '0 0 12px rgba(0,224,133,0.15)' : undefined,
                }}
                aria-label={`Open audit ${audit.id}`}
              >
                <span className="font-mono">{audit.id}</span>
                <span className="text-[#404040] font-mono">{formatTimestamp(audit.auditDate)}</span>
              </button>
            ))}
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-3">
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#00E085]" style={{textShadow: '0 0 8px rgba(0,224,133,0.4)'}}>Next 24h</p>
              {groupedActions(actionPlan?.actions ?? []).next_24h.map((action) => (
                <ExpandableAuditCard
                  key={action.id}
                  action={action}
                  finding={actionPlan?.findings.find((finding) => finding.id === action.findingId)}
                  auditId={actionPlan?.id ?? 'N/A'}
                />
              ))}
            </div>
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#A8A8A8]">Sprint</p>
              {groupedActions(actionPlan?.actions ?? []).sprint.map((action) => (
                <ExpandableAuditCard
                  key={action.id}
                  action={action}
                  finding={actionPlan?.findings.find((finding) => finding.id === action.findingId)}
                  auditId={actionPlan?.id ?? 'N/A'}
                />
              ))}
            </div>
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#404040]">Backlog</p>
              {groupedActions(actionPlan?.actions ?? []).backlog.map((action) => (
                <ExpandableAuditCard
                  key={action.id}
                  action={action}
                  finding={actionPlan?.findings.find((finding) => finding.id === action.findingId)}
                  auditId={actionPlan?.id ?? 'N/A'}
                />
              ))}
            </div>
          </div>
        </section>

        <section id="pipeline-modules" className="border border-[#1A1A1A] border-t-[rgba(0,224,133,0.08)] bg-[linear-gradient(160deg,#0A0A0A_0%,#000000_100%)] px-3 py-4 md:px-6">
          <h2 className="text-[20px] font-semibold uppercase tracking-widest text-[#E8E8E8]">Pipeline Modules</h2>
          <p className="mt-3 text-sm text-[#A8A8A8]">Minimal operational strip. Select a module to open the right drawer.</p>

          <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            {activeModules.map((module) => (
              <PipelineModuleCard
                key={module.name}
                module={module}
                onOpen={(selected) => {
                  setSelectedPipelineName(selected.name);
                  setSelectedAuditId(undefined);
                  setPipelineDrawerOpen(true);
                }}
              />
            ))}
          </div>

          <details className="mt-8 p-0">
            <summary className="cursor-pointer text-[10px] font-semibold uppercase tracking-widest text-[#404040] hover:text-[#A8A8A8] transition-colors duration-150">
              Legacy modules ({legacyModules.length})
            </summary>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              {legacyModules.map((module) => (
                <PipelineModuleCard
                  key={module.name}
                  module={module}
                  onOpen={(selected) => {
                    setSelectedPipelineName(selected.name);
                    setSelectedAuditId(undefined);
                    setPipelineDrawerOpen(true);
                  }}
                />
              ))}
            </div>
          </details>
        </section>

        <RecentRunsList
          rows={recentRows}
          hasP0Blockers={hasP0Blockers}
          onOpenRun={(moduleName) => {
            setSelectedPipelineName(moduleName);
            setSelectedAuditId(undefined);
            setPipelineDrawerOpen(true);
          }}
        />

        <QuickActionsBar
          onViewAllAudits={() => document.getElementById('audit-details')?.scrollIntoView({ behavior: 'smooth' })}
          onRunFullPipeline={() => document.getElementById('pipeline-modules')?.scrollIntoView({ behavior: 'smooth' })}
          onCheckLogs={() => document.getElementById('recent-runs')?.scrollIntoView({ behavior: 'smooth' })}
          onOpenSettings={() => {
            window.location.href = '/scout-hq/settings';
          }}
        />
      </div>

      <div
        className="fixed inset-y-0 right-0 z-40 w-full max-w-[420px] border-l border-[#1A1A1A] bg-[#000000] shadow-[-10px_0_40px_rgba(0,0,0,0.8)] transition-transform duration-200"
        style={{
          transform: pipelineDrawerOpen ? 'translateX(0)' : 'translateX(100%)',
          transitionTimingFunction: 'ease-in-out',
        }}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1A1A1A]">
          <p className="text-[10px] uppercase tracking-widest font-semibold text-[#00E085]" style={{textShadow: '0 0 8px rgba(0,224,133,0.4)'}}>Module Detail</p>
          <button
            type="button"
            onClick={() => setPipelineDrawerOpen(false)}
            className="text-xs text-[#404040] transition-all duration-150 hover:text-[#00E085] hover:shadow-[0_0_8px_rgba(0,224,133,0.3)]"
            style={{ transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)' }}
          >
            Close
          </button>
        </div>
        <DetailDrawer auditDetail={selectedPipelineName ? null : actionPlan} pipelineModule={selectedPipelineModule} />
      </div>

      {pipelineDrawerOpen && (
        <button
          type="button"
          aria-label="Close module detail drawer"
          className="fixed inset-0 z-30 bg-black/40"
          onClick={() => setPipelineDrawerOpen(false)}
        />
      )}
    </div>
  );
}

export function createDashboardSnapshot(config: DashboardInputConfig) {
  return createAuditDashboardFallback(config);
}
