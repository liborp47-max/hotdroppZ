import type {
  AuditActionItem,
  AuditListItem,
  AuditReport,
  PipelineModuleStatus,
  UserNote,
} from '../types/audit';

export const DEFAULT_AUDIT_NOTE_KEY = 'hdcc:audit-dashboard:notes';

export const MOCK_AUDITS: AuditListItem[] = [
  {
    id: 'AUD-20260512-01',
    auditDate: '2026-05-12T17:00:00Z',
    scope: 'Stage Registry Foundation',
    status: 'Green',
    highestPriority: 'P0',
    findingsCount: 1,
    criticalCount: 0,
    actionsCount: 2,
    resolvedActionsCount: 2,
    filePath: 'INFO/AUDITS/audit-2026-05-12-1700-p2-foundation.md',
  },
  {
    id: 'AUD-20260512-02',
    auditDate: '2026-05-12T17:15:00Z',
    scope: 'Endpoint Guards & Resilience',
    status: 'Green',
    highestPriority: 'P1',
    findingsCount: 2,
    criticalCount: 0,
    actionsCount: 3,
    resolvedActionsCount: 3,
    filePath: 'INFO/AUDITS/audit-2026-05-12-1715-endpoint-guards.md',
  },
  {
    id: 'AUD-20260512-03',
    auditDate: '2026-05-12T17:30:00Z',
    scope: 'Centralized Logger Adoption',
    status: 'Green',
    highestPriority: 'P0',
    findingsCount: 1,
    criticalCount: 0,
    actionsCount: 2,
    resolvedActionsCount: 2,
    filePath: 'INFO/AUDITS/audit-2026-05-12-1730-logger.md',
  },
  {
    id: 'AUD-20260512-04',
    auditDate: '2026-05-12T17:45:00Z',
    scope: 'Degraded Mode (Scout & Writer)',
    status: 'Green',
    highestPriority: 'P0',
    findingsCount: 2,
    criticalCount: 1,
    actionsCount: 2,
    resolvedActionsCount: 2,
    filePath: 'INFO/AUDITS/audit-2026-05-12-1745-degraded-mode.md',
  },
  {
    id: 'AUD-20260512-05',
    auditDate: '2026-05-12T18:00:00Z',
    scope: 'Markdown Quality Gate',
    status: 'Green',
    highestPriority: 'P2',
    findingsCount: 1,
    criticalCount: 0,
    actionsCount: 3,
    resolvedActionsCount: 3,
    filePath: 'INFO/AUDITS/audit-2026-05-12-1800-markdown-quality.md',
  },
];

export const MOCK_AUDIT_DETAIL: AuditReport = {
  id: 'AUD-20260512-01',
  auditDate: '2026-05-12T17:00:00Z',
  reportDate: '2026-05-12T21:30:00Z',
  auditorName: 'SYSTEM AUDITOR',
  scope: 'Follow-up Verification Audit',
  status: 'Green',
  topRisks: [
    'P4 regression tests pending merge',
    'Integration tests scheduled for Sprint 2',
    'Logger observability still pending',
  ],
  findings: [
    {
      id: 'AUD-20260512-01',
      name: 'Stage Registry Foundation',
      severity: 'Low',
      status: 'Resolved',
      impact: {
        business: 'Unblocks pipeline governance and route safety.',
        technical: 'Central source of truth for stage state.',
      },
      dependencies: {
        upstream: ['Route guards', 'API response contracts'],
        downstream: ['Dashboard audit list', 'Pipeline status cards'],
      },
      evidence: 'lib/config/stage-registry.ts',
      proposedSolution: {
        shortTerm: 'Use existing stage registry.',
        longTerm: 'Keep registry immutable and covered by tests.',
      },
      createdAt: '2026-05-12T17:00:00Z',
      updatedAt: '2026-05-12T21:30:00Z',
    },
  ],
  actions: [
    {
      id: 'PLAT-2026-001',
      title: 'Stage Registry hardening',
      description: 'Keep stage registry immutable and verified by tests.',
      priority: 'P0',
      state: 'Done',
      owner: 'Backend',
      estimatedHours: 8,
      timeframe: 'next_24h',
      dependencies: [],
      findingId: 'AUD-20260512-01',
      createdAt: '2026-05-12T17:05:00Z',
      updatedAt: '2026-05-12T21:30:00Z',
      completedAt: '2026-05-12T19:00:00Z',
    },
    {
      id: 'PLAT-2026-002',
      title: 'Endpoint guards',
      description: 'Guard active, degraded and retired endpoints.',
      priority: 'P0',
      state: 'Done',
      owner: 'Backend',
      estimatedHours: 10,
      timeframe: 'next_24h',
      dependencies: ['PLAT-2026-001'],
      findingId: 'AUD-20260512-02',
      createdAt: '2026-05-12T17:10:00Z',
      updatedAt: '2026-05-12T21:30:00Z',
      completedAt: '2026-05-12T19:10:00Z',
    },
    {
      id: 'PLAT-2026-009',
      title: 'Regression test suite',
      description: 'Add 32 contract + smoke tests.',
      priority: 'P1',
      state: 'In Progress',
      owner: 'QA',
      estimatedHours: 10,
      timeframe: 'sprint',
      dependencies: ['PLAT-2026-002'],
      findingId: 'AUD-20260512-02',
      createdAt: '2026-05-12T17:40:00Z',
      updatedAt: '2026-05-12T21:30:00Z',
    },
    {
      id: 'PLAT-2026-011',
      title: 'Integration tests',
      description: 'Validate live Supabase integration against staging.',
      priority: 'P2',
      state: 'Todo',
      owner: 'QA',
      estimatedHours: 12,
      timeframe: 'backlog',
      dependencies: ['PLAT-2026-009'],
      findingId: 'AUD-20260512-03',
      createdAt: '2026-05-12T17:45:00Z',
      updatedAt: '2026-05-12T21:30:00Z',
    },
  ],
  filePath: 'INFO/AUDITS/audit-2026-05-12-2130-followup-verification.md',
};

export const MOCK_PIPELINE_MODULES: PipelineModuleStatus[] = [
  {
    name: 'scout',
    status: 'healthy',
    lastRun: {
      timestamp: '2026-05-12T21:24:00Z',
      duration: 1120,
      inputCount: 22,
      outputCount: 18,
      errorCount: 0,
    },
    recentErrors: [],
    relatedAuditFindings: ['AUD-20260512-04'],
  },
  {
    name: 'enrichment',
    status: 'degraded',
    lastRun: {
      timestamp: '2026-05-12T21:20:00Z',
      duration: 2420,
      inputCount: 18,
      outputCount: 14,
      errorCount: 2,
    },
    recentErrors: ['YouTube provider timeout'],
    relatedAuditFindings: ['AUD-20260512-02'],
  },
  {
    name: 'writer',
    status: 'blocked',
    lastRun: {
      timestamp: '2026-05-12T21:10:00Z',
      duration: 180,
      inputCount: 0,
      outputCount: 0,
      errorCount: 1,
    },
    recentErrors: ['trigger_blocked=true'],
    relatedAuditFindings: ['AUD-20260512-04'],
  },
];

export const MOCK_USER_NOTE: UserNote = {
  id: 'dashboard-note',
  content: 'Audit dashboard ready. Verify P4 tests after merge.',
  createdAt: '2026-05-12T20:00:00Z',
  updatedAt: '2026-05-12T21:15:00Z',
  lastSavedAt: '2026-05-12T21:15:00Z',
  isDirty: false,
};

export function getMockAuditReport(auditId: string): AuditReport {
  const base = MOCK_AUDIT_DETAIL;

  if (auditId === 'AUD-20260512-05') {
    return {
      ...base,
      id: auditId,
      scope: 'Markdown Quality Gate',
      actions: [],
      topRisks: ['Fallback verification needed for lint templates'],
    };
  }

  if (auditId === 'AUD-20260512-04') {
    return {
      ...base,
      id: auditId,
      scope: 'Degraded Mode (Scout & Writer)',
      actions: base.actions.map((action) => ({
        ...action,
        findingId: auditId,
      })),
    };
  }

  if (auditId === 'AUD-20260512-02') {
    return {
      ...base,
      id: auditId,
      scope: 'Endpoint Guards & Resilience',
      topRisks: ['Integration with resilient wrappers must remain covered'],
      actions: [
        base.actions[0],
        {
          ...base.actions[2],
          id: 'PLAT-2026-010',
          title: 'API response contract',
          priority: 'P1',
          state: 'Todo',
          timeframe: 'sprint',
          dependencies: ['PLAT-2026-002'],
        },
      ],
    };
  }

  if (auditId === 'AUD-20260512-03') {
    return {
      ...base,
      id: auditId,
      scope: 'Centralized Logger Adoption',
      topRisks: ['Observability dashboard still pending'],
      actions: [
        {
          ...base.actions[0],
          id: 'PLAT-2026-006',
          title: 'Logger adoption hardening',
          priority: 'P0',
          state: 'Done',
          timeframe: 'next_24h',
        },
        {
          ...base.actions[2],
          id: 'PLAT-2026-013',
          title: 'Logger observability',
          priority: 'P2',
          state: 'Todo',
          timeframe: 'backlog',
          owner: 'DevOps',
        },
      ],
    };
  }

  if (auditId === 'AUD-20260512-01') {
    return {
      ...base,
      id: auditId,
      scope: 'Stage Registry Foundation',
      topRisks: ['Registry changes must remain immutable'],
    };
  }

  return {
    ...base,
    id: auditId,
    scope: 'Follow-up Verification Audit',
  };
}

export function createEmptyUserNote(key: string): UserNote {
  const now = new Date().toISOString();
  return {
    id: key,
    content: '',
    createdAt: now,
    updatedAt: now,
    lastSavedAt: now,
    isDirty: false,
  };
}

export function buildMockDashboardNote(noteKey: string): UserNote {
  return {
    ...MOCK_USER_NOTE,
    id: noteKey,
  };
}
