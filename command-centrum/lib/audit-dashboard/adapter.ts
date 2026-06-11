import type {
  ActionPriority,
  AuditActionItem,
  AuditFinding,
  AuditListItem,
  AuditReport,
  PipelineModuleStatus,
  UserNote,
} from '../types/audit';
import {
  MOCK_AUDITS,
  MOCK_AUDIT_DETAIL,
  MOCK_PIPELINE_MODULES,
  buildMockDashboardNote,
  getMockAuditReport,
  createEmptyUserNote,
} from './mock-data';

export interface DashboardInputConfig {
  auditApiBaseUrl?: string;
  pipelineApiBaseUrl?: string;
  notesKey: string;
  defaultFilters?: {
    status?: string;
    priority?: string;
  };
  layoutMode?: 'grid' | 'stack';
}

export interface DashboardLoadState {
  audits: AuditListItem[];
  auditDetail: AuditReport | null;
  pipelineModules: PipelineModuleStatus[];
  note: UserNote;
  loading: boolean;
  stale: boolean;
  error?: string;
  source: 'api' | 'mock' | 'mixed';
}

const DEFAULT_TIMEOUT_MS = 3500;
const STALE_AFTER_MS = 5 * 60 * 1000;

export async function fetchJsonWithTimeout<T>(url: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

function isFresh(timestampIso?: string) {
  if (!timestampIso) return false;
  return Date.now() - new Date(timestampIso).getTime() < STALE_AFTER_MS;
}

export function groupActionsByTimeframe(actions: AuditActionItem[]) {
  const grouped = {
    next_24h: [] as AuditActionItem[],
    sprint: [] as AuditActionItem[],
    backlog: [] as AuditActionItem[],
  };

  for (const action of actions) {
    grouped[action.timeframe].push(action);
  }

  return grouped;
}

export function filterAuditList(items: AuditListItem[], query: { status?: string; priority?: string }) {
  return items.filter((item) => {
    const statusMatches = !query.status || query.status === 'all' || item.status.toLowerCase() === query.status.toLowerCase();
    const priorityMatches =
      !query.priority ||
      query.priority === 'all' ||
      item.highestPriority === query.priority;
    return statusMatches && priorityMatches;
  });
}

export function normalizeAuditReport(report: AuditReport | null): AuditReport | null {
  return report;
}

export function createAuditDashboardFallback(config: DashboardInputConfig): DashboardLoadState {
  const note = typeof window !== 'undefined'
    ? loadNoteFromStorage(config.notesKey) ?? buildMockDashboardNote(config.notesKey)
    : buildMockDashboardNote(config.notesKey);

  return {
    audits: MOCK_AUDITS,
    auditDetail: MOCK_AUDIT_DETAIL,
    pipelineModules: MOCK_PIPELINE_MODULES,
    note,
    loading: false,
    stale: false,
    source: 'mock',
  };
}

export async function loadAuditDashboardState(config: DashboardInputConfig): Promise<DashboardLoadState> {
  const fallback = createAuditDashboardFallback(config);
  const loadStartedAt = Date.now();

  const [auditResult, pipelineResult] = await Promise.allSettled([
    config.auditApiBaseUrl ? fetchJsonWithTimeout<{ success: boolean; data: AuditListItem[]; meta?: { timestamp?: string } }>(`${config.auditApiBaseUrl}/audits`) : Promise.resolve(null),
    config.pipelineApiBaseUrl ? fetchJsonWithTimeout<{ success: boolean; data: PipelineModuleStatus[]; meta?: { timestamp?: string } }>(`${config.pipelineApiBaseUrl}/modules`) : Promise.resolve(null),
  ]);

  let audits = fallback.audits;
  let pipelineModules = fallback.pipelineModules;
  let source: DashboardLoadState['source'] = 'mock';
  let error: string | undefined;
  let stale = false;

  if (auditResult.status === 'fulfilled' && auditResult.value?.success) {
    audits = auditResult.value.data;
    source = config.pipelineApiBaseUrl ? 'mixed' : 'api';
    stale = !isFresh(auditResult.value.meta?.timestamp);
  } else if (auditResult.status === 'rejected' && config.auditApiBaseUrl) {
    error = auditResult.reason instanceof Error ? auditResult.reason.message : 'Failed to load audits';
  }

  if (pipelineResult.status === 'fulfilled' && pipelineResult.value?.success) {
    pipelineModules = pipelineResult.value.data;
    source = source === 'api' ? 'api' : 'mixed';
    stale = stale || !isFresh(pipelineResult.value.meta?.timestamp);
  } else if (pipelineResult.status === 'rejected' && config.pipelineApiBaseUrl && !error) {
    error = pipelineResult.reason instanceof Error ? pipelineResult.reason.message : 'Failed to load pipeline';
  }

  const auditDetail = MOCK_AUDIT_DETAIL;

  const note = typeof window !== 'undefined'
    ? loadNoteFromStorage(config.notesKey) ?? createEmptyUserNote(config.notesKey)
    : fallback.note;

  return {
    audits,
    auditDetail,
    pipelineModules,
    note,
    loading: false,
    stale: stale || Date.now() - loadStartedAt > STALE_AFTER_MS,
    error,
    source,
  };
}

export async function fetchAuditDetail(
  config: DashboardInputConfig,
  auditId: string,
): Promise<AuditReport> {
  if (!config.auditApiBaseUrl) {
    return getMockAuditReport(auditId);
  }

  try {
    const response = await fetchJsonWithTimeout<{ success: boolean; data: AuditReport }>(
      `${config.auditApiBaseUrl}/audits/${auditId}`,
    );
    if (response.success) {
      return response.data;
    }
  } catch {
    // Fall back to source of truth mock data when API is unavailable.
  }

  return getMockAuditReport(auditId);
}

export function loadNoteFromStorage(notesKey: string): UserNote | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(notesKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as UserNote;
    return parsed;
  } catch {
    return null;
  }
}

export function saveNoteToStorage(notesKey: string, note: UserNote) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(notesKey, JSON.stringify(note));
}

// ────────────────────────────────────────────────────────────────────────────
// UM-AUDITOR SM-2 — Compliance scoring (skeleton)
//
// Pure deterministic formula. Auditor agent compares Primary Mission state vs
// pipeline behavior reflected in the audit findings + action plan, and emits a
// 0-100 score plus a 3-section remediation plan.
//
// Mission spec: "Audit agent srovnává Primary Mission s pipeline behavior;
// score 0-100 + remediation plan."
//
// Skeleton scope (UM-AUDITOR run-20260528-um-auditor-46590949):
//  - Deterministic point-based formula from severities + action state
//  - No AI call (future SM-4 prompt generator wraps this)
//  - No persistence (caller writes wherever appropriate)
//  - Stable output for identical input — testable as pure function
// ────────────────────────────────────────────────────────────────────────────

export interface ComplianceScore {
  /** 0-100. ≥80 Green, ≥50 Amber, <50 Red. */
  score: number;
  /** Same vocabulary as AuditReport.status — derived from score thresholds. */
  status: 'Green' | 'Amber' | 'Red';
  /** Per-bucket breakdown of point deductions for transparency / debugging. */
  breakdown: {
    findingDeductions: number;
    openActionDeductions: number;
    resolvedActionBonus: number;
  };
}

export interface RemediationPlan {
  /** Up to 3 highest-priority unresolved items, ranked P0 → P3 then by state. */
  topRisks: Array<{
    id: string;
    title: string;
    priority: ActionPriority;
    state: AuditActionItem['state'];
    relatedFindingId?: string;
  }>;
  /** Counts of open actions per timeframe — direct input to weekly stand-up. */
  nextSteps: {
    next_24h: number;
    sprint: number;
    backlog: number;
  };
  /** Sum of estimatedHours across open (non-Done) actions; null when no estimates known. */
  estimatedHoursOpen: number | null;
  /** Count of findings still in 'Open' or 'In Progress'. */
  openFindings: number;
}

const FINDING_DEDUCTION: Record<AuditFinding['severity'], number> = {
  Critical: 25,
  High: 10,
  Medium: 3,
  Low: 1,
};

const OPEN_ACTION_DEDUCTION: Record<ActionPriority, number> = {
  P0: 15,
  P1: 5,
  P2: 2,
  P3: 1,
};

const PRIORITY_RANK: Record<ActionPriority, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };

export function computeComplianceScore(audit: AuditReport | null): ComplianceScore {
  if (!audit) {
    return {
      score: 0,
      status: 'Red',
      breakdown: { findingDeductions: 0, openActionDeductions: 0, resolvedActionBonus: 0 },
    };
  }

  const findingDeductions = audit.findings.reduce((sum, f) => {
    if (f.status === 'Resolved') return sum;
    return sum + (FINDING_DEDUCTION[f.severity] ?? 0);
  }, 0);

  const openActions = audit.actions.filter((a) => a.state !== 'Done');
  const openActionDeductions = openActions.reduce(
    (sum, a) => sum + (OPEN_ACTION_DEDUCTION[a.priority] ?? 0),
    0,
  );

  const totalActions = audit.actions.length;
  const resolvedActions = audit.actions.filter((a) => a.state === 'Done').length;
  const resolvedRatio = totalActions > 0 ? resolvedActions / totalActions : 0;
  const resolvedActionBonus = Math.round(resolvedRatio * 10);

  const raw = 100 - findingDeductions - openActionDeductions + resolvedActionBonus;
  const score = Math.max(0, Math.min(100, raw));

  return {
    score,
    status: score >= 80 ? 'Green' : score >= 50 ? 'Amber' : 'Red',
    breakdown: { findingDeductions, openActionDeductions, resolvedActionBonus },
  };
}

export function buildRemediationPlan(audit: AuditReport | null): RemediationPlan {
  if (!audit) {
    return {
      topRisks: [],
      nextSteps: { next_24h: 0, sprint: 0, backlog: 0 },
      estimatedHoursOpen: null,
      openFindings: 0,
    };
  }

  const openActions = audit.actions.filter((a) => a.state !== 'Done');

  const topRisks = [...openActions]
    .sort((a, b) => {
      const priorityDiff = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      const stateRank = (s: AuditActionItem['state']) =>
        s === 'In Progress' ? 0 : s === 'Todo' ? 1 : 2;
      return stateRank(a.state) - stateRank(b.state);
    })
    .slice(0, 3)
    .map((a) => ({
      id: a.id,
      title: a.title,
      priority: a.priority,
      state: a.state,
      relatedFindingId: a.findingId,
    }));

  const nextSteps = openActions.reduce(
    (acc, a) => {
      acc[a.timeframe] += 1;
      return acc;
    },
    { next_24h: 0, sprint: 0, backlog: 0 } as RemediationPlan['nextSteps'],
  );

  const knownEstimates = openActions
    .map((a) => a.estimatedHours)
    .filter((h): h is number => typeof h === 'number');
  const estimatedHoursOpen =
    knownEstimates.length > 0 ? knownEstimates.reduce((s, h) => s + h, 0) : null;

  const openFindings = audit.findings.filter(
    (f) => f.status === 'Open' || f.status === 'In Progress',
  ).length;

  return { topRisks, nextSteps, estimatedHoursOpen, openFindings };
}
