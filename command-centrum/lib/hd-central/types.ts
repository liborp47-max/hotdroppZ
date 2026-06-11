export type Phase = 'Foundation' | 'Build' | 'Validate' | 'Launch' | 'Scale'
export type Priority = 'P0' | 'P1' | 'P2' | 'P3'
export type MissionLifecycleStatus =
  | 'PLAN'
  | 'ACTIVE'
  | 'CEO_RESOLVED'
  | 'AUDIT_PENDING'
  | 'MISSION_DONE'
  /**
   * UM-MISSION_TRUTH_GATE / #01 — Terminal verdict for a mission whose
   * sub-missions completed but whose evidence pack could not be verified
   * against real build/test/runtime artifacts (only simulated or
   * file-system artifacts). MUST NOT be displayed as PASS in CEO Timeline.
   */
  | 'SIMULATED_ONLY'
  /** Retired stage or stale duplicate — terminal, not pending work. */
  | 'ARCHIVED'
  /** Removed from the queue. */
  | 'DELETED'
export type Status =
  | 'todo'
  | 'in_progress'
  | 'blocked'
  | 'done'
  | 'solved'
  | MissionLifecycleStatus

export type ABCOption = {
  id: 'A' | 'B' | 'C'
  label: string
  description: string
  pros?: string
  cons?: string
}

export type SubMissionStatus = 'todo' | 'in_progress' | 'blocked' | 'done'

export type SubMission = {
  id: string
  name: string
  description: string
  status?: SubMissionStatus
  owner?: string
  estimatedDuration?: 'S' | 'M' | 'L'
  /** Why this step matters — short Czech sentence shown in the expand drawer. */
  why?: string
  completedAt?: string
}

export type Mission = {
  id: string
  name: string
  purpose: string
  description?: string
  importantInfo?: string
  phase?: Phase
  priority?: Priority
  status: Status
  domains?: string[]
  options?: ABCOption[]
  subMissions?: SubMission[]
  reportPath?: string
  createdAt?: string
  urgencyScore?: number
  coldCase?: boolean
  isDeleted?: boolean
  deletedAt?: string
  lifecycleStatus?: MissionLifecycleStatus
  auditReport?: MissionAuditReport
  auditReports?: MissionAuditReport[]
  auditLog?: MissionAuditLogEvent[]
  /** When false, mission sits in CEO Missions inbox and is NOT shown in the Mission Timeline. Undefined treated as true for backwards compat. */
  inTimeline?: boolean
  /** Index assigned by the sequencer when the mission is pushed to the timeline. Lower = earlier. */
  sequenceIndex?: number
  sequencedAt?: string
  sequencedBy?: string
  /** Marks user-curated mission templates from the System Audit seed (USER MISSIONS tab). */
  userMission?: boolean
  /** Module identifier from the system audit (e.g. SCOUT, CLUSTER, CEO, FEED). */
  moduleId?: string
  /** Path glob of files this mission is anchored to. */
  modulePath?: string
  /** "Why this mission exists" — long Czech description shown in the expand drawer. */
  rationale?: string
  /** Concrete success criteria (Czech bullet list). */
  successCriteria?: string[]
  estimatedComplexity?: 'S' | 'M' | 'L' | 'XL'
  // ─── Mission Timeline state machine + SLA (UM-MISSIONS_UI) ─────────────────
  /** Execution state on the Mission Timeline. Undefined → derived from inTimeline. */
  timelineState?: TimelineState
  /** Ordered audit trail of timeline-state transitions. */
  timelineLog?: MissionTimelineTransition[]
  /** ISO deadline used for SLA tracking. */
  slaDeadline?: string
  /** Impact severity — distinct from the scheduling `priority`. */
  severity?: Severity
  /** Agent accountable for the mission. */
  ownerAgent?: string
  /** ISO time the mission is scheduled to start (custom bulk scheduling). */
  scheduledFor?: string
  /** True when this mission was auto-spawned as a follow-up by verify-done. */
  isFollowUp?: boolean
  /** ID of the parent mission this follow-up was derived from. */
  followUpOf?: string
  /** Short Czech sentence explaining why this follow-up was needed. */
  followUpReason?: string
  /** Follow-up generation number (1 = first +1 spawned, 2 = +1 of a +1, ...). */
  followUpLevel?: number
}

export type PlanTaskSerialized = {
  id: string
  title: string
  owner: string
  status: 'todo' | 'in_progress' | 'blocked' | 'done'
  priority: Priority
  dependencies: string[]
  auditIds: string[]
  actionIds: string[]
  evidencePath?: string
  createdAt: string
  updatedAt: string
  archivedAt?: string
  prompt?: string
  missionCandidate?: boolean
}

export type Plan = {
  version: number
  updatedAt: string
  missions: Mission[]
  tasks?: PlanTaskSerialized[]
  lastPlanRun?: string
}

// ─── PLAN HQ — Primary Mission (strategic planning) ─────────────────────────

export type KeyResult = {
  id: string
  description: string
  /** Progress toward the key result, 0-100 percent. */
  progress: number
}

export type OKR = {
  id: string
  objective: string
  keyResults: KeyResult[]
}

/**
 * The company-level strategic Primary Mission for PLAN HQ. Distinct from the
 * operational `Mission` queue — this is the single north-star definition.
 */
export type PrimaryMission = {
  id: string
  title: string
  description: string
  /** Measurable success-metric statements. */
  successMetrics: string[]
  targetAudience: string
  okrs: OKR[]
  createdAt: string
  updatedAt: string
}

/** Singleton envelope persisted to NOTES/primary-mission.json. */
export type PrimaryMissionDoc = {
  version: number
  updatedAt: string
  mission: PrimaryMission | null
}

// ─── PLAN HQ — Quarterly Plan (milestones, resources, risk) ─────────────────

export type MilestoneStatus = 'planned' | 'in_progress' | 'done' | 'at_risk'

export type Milestone = {
  id: string
  title: string
  /** ISO date string. */
  dueDate: string
  status: MilestoneStatus
  /** Optional link to a PrimaryMission OKR. */
  okrId?: string
}

export type ResourceAllocation = {
  id: string
  area: string
  owner: string
  /** Share of capacity assigned to this area, 0-100 percent. */
  allocationPct: number
  notes?: string
}

export type RiskSeverity = 'low' | 'medium' | 'high' | 'critical'
export type RiskLikelihood = 'low' | 'medium' | 'high'

export type Risk = {
  id: string
  description: string
  severity: RiskSeverity
  likelihood: RiskLikelihood
  mitigation: string
}

export type QuarterlyPlanStatus = 'draft' | 'active' | 'archived'

/** A single quarter's strategic plan, owned by CEO/PM. */
export type QuarterlyPlan = {
  id: string
  /** e.g. "2026-Q3". */
  quarter: string
  title: string
  objective: string
  status: QuarterlyPlanStatus
  milestones: Milestone[]
  resources: ResourceAllocation[]
  risks: Risk[]
  createdAt: string
  updatedAt: string
}

/** Collection envelope persisted to NOTES/quarterly-plans.json. */
export type QuarterlyPlanDoc = {
  version: number
  updatedAt: string
  plans: QuarterlyPlan[]
}

// ─── PLAN HQ — Quarterly Plan versioning + snapshots ─────────────────────────

export type PlanChangeAction = 'created' | 'updated' | 'deleted' | 'manual'

/** An immutable point-in-time capture of a QuarterlyPlan. */
export type PlanSnapshot = {
  id: string
  planId: string
  quarter: string
  action: PlanChangeAction
  capturedAt: string
  capturedBy?: string
  label?: string
  /** Frozen full plan state; null when action='deleted'. */
  plan: QuarterlyPlan | null
}

/** Collection envelope persisted to NOTES/quarterly-plan-snapshots.json. */
export type PlanSnapshotDoc = {
  version: number
  updatedAt: string
  snapshots: PlanSnapshot[]
}

export type PlanFieldChange = {
  field: string
  before: unknown
  after: unknown
}

/** Added / removed / changed item ids within a plan sub-list. */
export type PlanListDiff = {
  added: string[]
  removed: string[]
  changed: string[]
}

/** Structured difference between two plan snapshots — drives "compare quarters". */
export type PlanDiff = {
  fromSnapshotId: string
  toSnapshotId: string
  fromCapturedAt: string
  toCapturedAt: string
  fields: PlanFieldChange[]
  milestones: PlanListDiff
  resources: PlanListDiff
  risks: PlanListDiff
}

// ─── HD State Report (Analytics Overview / UPDATE) ──────────────────────────

export type StateReportChange = {
  kind: 'added' | 'removed' | 'changed'
  label: string
  /** Previous value — rendered in red in the diff view. */
  before?: string
  /** New value — rendered in green in the diff view. */
  after?: string
}

export type StateReportMetrics = {
  missionsTotal: number
  missionsDone: number
  missionsActive: number
  missionsTodo: number
  subMissionsTotal: number
  subMissionsDone: number
  subMissionsBlocked: number
  completionPct: number
}

export type DoneMissionEntry = {
  id: string
  name: string
  completedAt: string | null
  subDone: number
  subTotal: number
}

/** A point-in-time, plain-language snapshot of HotDroppZ. Saved to SYSTEM/INFO/ANALYTICS. */
export type StateReport = {
  id: string
  generatedAt: string
  trigger: 'manual' | 'auto'
  summary: string
  bullets: string[]
  recentActivity: string[]
  recommendations: string[]
  metrics: StateReportMetrics
  doneMissions: DoneMissionEntry[]
  changesSincePrev: StateReportChange[]
  prevReportId: string | null
}

export type RunStep = {
  ts: string
  level: 'info' | 'action' | 'test' | 'done' | 'error'
  message: string
  file?: string
}

export type MissionReport = {
  runId: string
  missionId: string
  startedAt: string
  finishedAt: string
  decision: 'A' | 'B' | 'C' | 'solve'
  agents: string[]
  tools: string[]
  steps: RunStep[]
  testsPassed: boolean
  summary: string
}

export type MissionAuditReport = {
  missionId: string
  runId: string
  stepIndex: number
  totalSteps?: number
  summary: string
  /**
   * UM-MISSION_TRUTH_GATE / #01: SIMULATED_ONLY = artefacts exist on disk but
   * no real build/test/runtime evidence was collected. Must NOT be aliased to
   * PASS by any downstream renderer or auto-promotion logic.
   */
  verdict: 'PASS' | 'FAIL' | 'SIMULATED_ONLY'
  timestamp: string
}

export type MissionAuditLogEvent = {
  ts: string
  event:
    | 'SOLVE_ALL_STARTED'
    | 'MISSION_ACTIVATED'
    | 'CEO_RESOLVED'
    | 'AUDIT_PENDING'
    | 'AUDITOR_TEST'
    | 'MISSION_SOLVE_STEP_DONE'
    | 'REPORT_SHOWN'
    | 'MISSION_DONE'
    | 'MISSION_SIMULATED_ONLY'
    | 'EVIDENCE_REJECTED'
    | 'EVIDENCE_VERIFIED'
    | 'MISSION_ARCHIVED_RETIRED'
    | 'MISSION_ARCHIVED_DUPLICATE'
    | 'RETURNED_TO_COLD_CASE'
    | 'MISSION_DELETED'
    | 'SOLVE_ALL_FINISHED'
  actor: 'SYSTEM' | 'CEO' | 'AUDITOR' | 'system-auditor'
  note?: string
}

// ─── Mission Timeline state machine (UM-MISSIONS_UI) ────────────────────────

/** Execution state of a mission on the CEO Mission Timeline. */
export type TimelineState = 'draft' | 'queued' | 'running' | 'done' | 'failed'

/** One atomic, audited timeline-state transition. */
export type MissionTimelineTransition = {
  ts: string
  from: TimelineState
  to: TimelineState
  /** Agent or user id that triggered the transition. */
  actor: string
  /** Human-readable reason for the transition. */
  reason: string
}

export type Severity = 'Critical' | 'High' | 'Medium' | 'Low' | 'Unknown'
export type AuditStatus = 'Open' | 'In Progress' | 'Blocked' | 'Resolved'
export type HealthStatus = 'GREEN' | 'AMBER' | 'RED'

export type AuditListItem = {
  id: string
  title: string
  severity: Severity
  status: AuditStatus
  date: string
}

export type AuditDetail = AuditListItem & {
  risks: string[]
  dependencies: string[]
  remediation: string[]
  openQuestions: string[]
}

export type NoteListItem = {
  id: string
  title: string
  preview: string
  updatedAt: string
}

export type NoteDetail = NoteListItem & {
  content: string
  author: string
}

export type PipelineStep = {
  id: string
  name: string
  purpose: string
  principle: string
  aiPowered: boolean
  input: string
  output: string
  rules: string[]
  settings: string[]
  limits: string[]
  health: HealthStatus
}

// ─── Pipeline cockpit (CEO mainpage rebuild — PR-1) ─────────────────────────
// Lowercase health used by SYSTEM/INFO/PIPELINE_STATE/**/state.json payloads.
// HealthStatus (uppercase) intentionally kept for legacy consumers.

export type StageId =
  | 'scout' | 'filter' | 'translator' | 'curator' | 'cluster'
  | 'enrichment' | 'writer' | 'feed-engine' | 'multilang'
  | 'monetizer' | 'droppz-detector'

export type StageRuntimeStatus = 'idle' | 'running' | 'error' | 'degraded' | 'retired'
export type HealthLevel = 'green' | 'amber' | 'red'

export interface PipelineStageState {
  id: StageId
  index: number              // 1..11 chain order
  displayName: string
  description: string
  runtime: 'ts' | 'py' | 'mock + python+ts'
  canonicalFile: string      // např. command-centrum/lib/pipeline/scout.ts
  status: StageRuntimeStatus
  health: HealthLevel
  phase: Phase
  inputStatus: string | null
  outputStatus: string | null
  config: {
    scheduleCron: string | null
    rateLimitPerSecond: number | null
    tokenBudget: number | null
    costCeiling: number | null
    secretRef: string | null
    gatewayId: string | null
    maxRetry: number | null
    timeoutMs: number | null
  }
  kpi: {
    itemsToday: number
    itemsWeek: number
    errorsToday: number
    latencyP95Ms: number
    spark7d: number[]
  }
  lastRunAt: string | null
  nextRunAt: string | null
  manualTriggerEndpoint: string | null
  infoRefs: string[]
}

export interface ScoutWorkerState {
  id: string                    // např. wkr-spotify-playlists
  parentStage: 'scout'
  name: string
  platform: string
  category: string
  description: string
  enabled: boolean
  status: StageRuntimeStatus
  health: HealthLevel
  config: {
    scheduleCron: string | null
    rateLimitPerSecond: number | null
    secretRef: string | null
    gatewayId: string | null
    customConfig: Record<string, unknown>
  }
  kpi: {
    itemsToday: number
    itemsWeek: number
    errorsToday: number
    latencyP95Ms: number
    spark7d: number[]
  }
  sourceCount: number
  lastRunAt: string | null
  nextRunAt: string | null
  manualTriggerEndpoint: string | null   // /api/scout-hq/workers/<platform>/run
}

export interface PipelineActiveRun {
  stage: StageId
  runId: string
  startedAt: string
}

export interface PipelineAggregate {
  generatedAt: string
  stages: PipelineStageState[]
  workers: ScoutWorkerState[]
  health: { green: number; amber: number; red: number }
  lastSyncAt: string | null
  activeRuns: PipelineActiveRun[]
}
