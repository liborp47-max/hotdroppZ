/**
 * Audit Dashboard Data Contracts
 * Source of truth: SYSTEM AUDITOR audit reports from INFO/AUDITS/
 */

export type AuditSeverity = 'Critical' | 'High' | 'Medium' | 'Low';
export type AuditStatus = 'Open' | 'In Progress' | 'Blocked' | 'Resolved';
export type ActionPriority = 'P0' | 'P1' | 'P2' | 'P3';
export type ActionState = 'Todo' | 'In Progress' | 'Blocked' | 'Done';
export type PipelineModuleStageStatus = 'healthy' | 'degraded' | 'blocked' | 'retired' | 'no_data';
export type TimeframeCategory = 'next_24h' | 'sprint' | 'backlog';

/**
 * Parsed audit finding from audit report
 */
export interface AuditFinding {
  id: string; // e.g., "AUD-YYYYMMDD-XX"
  name: string;
  severity: AuditSeverity;
  status: AuditStatus;
  impact: {
    business: string;
    technical: string;
  };
  dependencies: {
    upstream: string[];
    downstream: string[];
  };
  evidence: string; // Path or reference
  proposedSolution: {
    shortTerm: string;
    longTerm: string;
  };
  probability?: number; // 0-1, likelihood
  createdAt: string; // ISO
  updatedAt: string; // ISO
}

/**
 * Action item extracted from audit's action plan
 */
export interface AuditActionItem {
  id: string; // e.g., "PLAT-2026-001"
  title: string;
  description: string;
  priority: ActionPriority;
  state: ActionState;
  owner?: string; // Team/person responsible
  estimatedHours?: number;
  timeframe: TimeframeCategory;
  dependencies?: string[]; // Other action IDs
  blockedBy?: string; // Action ID blocking this
  findingId?: string; // Link to AuditFinding
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

/**
 * Single audit report
 */
export interface AuditReport {
  id: string;
  auditDate: string; // ISO, when audit was performed
  reportDate: string; // ISO, when report was generated
  auditorName: string;
  scope: string;
  status: 'Green' | 'Amber' | 'Red';
  topRisks: string[];
  findings: AuditFinding[];
  actions: AuditActionItem[];
  filePath: string; // Path to original markdown file in INFO/AUDITS/
}

/**
 * Pipeline module current status
 */
export interface PipelineModuleStatus {
  name: string; // e.g., "scout", "enrichment", "writer"
  status: PipelineModuleStageStatus;
  moduleId?: string;
  lastRun?: {
    timestamp: string; // ISO
    duration: number; // milliseconds
    inputCount: number;
    outputCount: number;
    errorCount: number;
    result?: 'success' | 'degraded' | 'error';
  };
  recentRuns?: Array<{
    timestamp: string;
    errorCount: number;
    result: 'success' | 'degraded' | 'error';
  }>;
  recentErrors?: string[]; // Last 3 error messages
  relatedAuditFindings?: string[]; // AuditFinding IDs
}

/**
 * User note on dashboard (local state, not persisted to audit)
 */
export interface UserNote {
  id: string;
  content: string;
  createdAt: string; // ISO
  updatedAt: string; // ISO
  lastSavedAt: string; // ISO
  isDirty: boolean; // Unsaved changes?
}

/**
 * List item for audit table/list (denormalized)
 */
export interface AuditListItem {
  id: string;
  auditDate: string;
  scope: string;
  status: 'Green' | 'Amber' | 'Red';
  highestPriority?: ActionPriority;
  findingsCount: number;
  criticalCount: number;
  actionsCount: number;
  resolvedActionsCount: number;
  filePath: string;
}

/**
 * API Response types
 */
export interface AuditDashboardState {
  loading: boolean;
  error?: string;
  data?: {
    audits: AuditListItem[];
    latestAudit?: AuditReport;
    pipelineModules: PipelineModuleStatus[];
    userNotes: UserNote;
  };
  staleAt?: string; // ISO, when data becomes stale
}

export interface FetchAuditsResponse {
  success: boolean;
  data: AuditListItem[];
  error?: string;
  meta: {
    timestamp: string;
    total: number;
  };
}

export interface FetchAuditDetailResponse {
  success: boolean;
  data: AuditReport;
  error?: string;
  meta: {
    timestamp: string;
    filePath: string;
  };
}

export interface SaveNoteResponse {
  success: boolean;
  data: UserNote;
  error?: string;
  meta: {
    timestamp: string;
    savedAt: string;
  };
}

/**
 * UI State for components
 */
export interface AuditListUIState {
  selectedAuditId?: string;
  filterStatus?: AuditStatus | 'All';
  filterSeverity?: AuditSeverity | 'All';
  sortBy: 'date' | 'severity' | 'findings';
  detailPanelOpen: boolean;
}

export interface ActionPanelUIState {
  expandedSections: TimeframeCategory[];
  expandedActions: string[]; // Action IDs
}

/**
 * Validation helpers
 */
export function isValidAuditStatus(s: unknown): s is AuditStatus {
  return ['Open', 'In Progress', 'Blocked', 'Resolved'].includes(s as string);
}

export function isValidActionState(s: unknown): s is ActionState {
  return ['Todo', 'In Progress', 'Blocked', 'Done'].includes(s as string);
}

export function isValidPipelineStatus(s: unknown): s is PipelineModuleStageStatus {
  return ['healthy', 'degraded', 'blocked', 'retired', 'no_data'].includes(s as string);
}

export function isValidTimeframeCategory(s: unknown): s is TimeframeCategory {
  return ['next_24h', 'sprint', 'backlog'].includes(s as string);
}
