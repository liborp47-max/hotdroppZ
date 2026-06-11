// PLAN HQ — Quarterly Plan versioning + snapshots (storage + diff).
//
// Extracted out of `app/api/hd-central/quarterly-plan/snapshots/route.ts`
// because Next.js App Router rejects custom named exports from route files —
// only HTTP-handler exports (GET/POST/...) and a small allowlist are
// permitted. Route files now import these helpers from here.
//
// AUD-20260523-01 — fixes the Command Centrum production build blocker.

import fs from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'
import type {
  PlanChangeAction,
  PlanDiff,
  PlanFieldChange,
  PlanListDiff,
  PlanSnapshot,
  PlanSnapshotDoc,
  QuarterlyPlan,
  QuarterlyPlanDoc,
} from '@/lib/hd-central/types'

export const SNAP_FILE = path.join(process.cwd(), '..', 'NOTES', 'quarterly-plan-snapshots.json')
export const PLANS_FILE = path.join(process.cwd(), '..', 'NOTES', 'quarterly-plans.json')
export const MAX_SNAPSHOTS = 200

// ─── stores ──────────────────────────────────────────────────────────────────

function emptyDoc(): PlanSnapshotDoc {
  return { version: 1, updatedAt: new Date().toISOString(), snapshots: [] }
}

export function readSnapshotDoc(): PlanSnapshotDoc {
  if (!fs.existsSync(SNAP_FILE)) return emptyDoc()
  try {
    const parsed = JSON.parse(fs.readFileSync(SNAP_FILE, 'utf-8')) as PlanSnapshotDoc
    return {
      version: typeof parsed.version === 'number' ? parsed.version : 1,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
      snapshots: Array.isArray(parsed.snapshots) ? parsed.snapshots : [],
    }
  } catch {
    return emptyDoc()
  }
}

export function writeSnapshotDoc(snapshots: PlanSnapshot[]): PlanSnapshotDoc {
  const doc: PlanSnapshotDoc = {
    version: 1,
    updatedAt: new Date().toISOString(),
    snapshots: snapshots.slice(-MAX_SNAPSHOTS),
  }
  const dir = path.dirname(SNAP_FILE)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(SNAP_FILE, JSON.stringify(doc, null, 2), 'utf-8')
  return doc
}

export function readPlans(): QuarterlyPlan[] {
  if (!fs.existsSync(PLANS_FILE)) return []
  try {
    const parsed = JSON.parse(fs.readFileSync(PLANS_FILE, 'utf-8')) as QuarterlyPlanDoc
    return Array.isArray(parsed.plans) ? parsed.plans : []
  } catch {
    return []
  }
}

/**
 * Append an immutable snapshot of a plan. Best-effort: never throws, so a
 * snapshot failure cannot break the originating plan mutation. Called by the
 * quarterly-plan route on every create/update/delete.
 */
export function recordPlanSnapshot(
  plan: QuarterlyPlan | null,
  action: PlanChangeAction,
  meta: { planId: string; quarter: string; actor?: string; label?: string },
): PlanSnapshot | null {
  try {
    const snap: PlanSnapshot = {
      id: randomUUID(),
      planId: meta.planId,
      quarter: meta.quarter,
      action,
      capturedAt: new Date().toISOString(),
      ...(meta.actor ? { capturedBy: meta.actor } : {}),
      ...(meta.label ? { label: meta.label } : {}),
      plan: plan ? (JSON.parse(JSON.stringify(plan)) as QuarterlyPlan) : null,
    }
    const doc = readSnapshotDoc()
    writeSnapshotDoc([...doc.snapshots, snap])
    return snap
  } catch (e) {
    console.error('[quarterly-plan-snapshots] recordPlanSnapshot error:', e)
    return null
  }
}

// ─── diff (compare quarters) ─────────────────────────────────────────────────

function diffList(before: { id: string }[], after: { id: string }[]): PlanListDiff {
  const beforeJson = new Map(before.map((x) => [x.id, JSON.stringify(x)]))
  const afterJson = new Map(after.map((x) => [x.id, JSON.stringify(x)]))
  const added: string[] = []
  const removed: string[] = []
  const changed: string[] = []
  for (const id of afterJson.keys()) if (!beforeJson.has(id)) added.push(id)
  for (const id of beforeJson.keys()) if (!afterJson.has(id)) removed.push(id)
  for (const [id, av] of afterJson) {
    const bv = beforeJson.get(id)
    if (bv !== undefined && bv !== av) changed.push(id)
  }
  return { added, removed, changed }
}

const FIELD_KEYS: (keyof QuarterlyPlan)[] = ['quarter', 'title', 'objective', 'status']

export function diffSnapshots(from: PlanSnapshot, to: PlanSnapshot): PlanDiff {
  const fp = from.plan
  const tp = to.plan
  const fields: PlanFieldChange[] = []
  for (const k of FIELD_KEYS) {
    const before = fp ? fp[k] : null
    const after = tp ? tp[k] : null
    if (before !== after) fields.push({ field: k, before, after })
  }
  return {
    fromSnapshotId: from.id,
    toSnapshotId: to.id,
    fromCapturedAt: from.capturedAt,
    toCapturedAt: to.capturedAt,
    fields,
    milestones: diffList(fp?.milestones ?? [], tp?.milestones ?? []),
    resources: diffList(fp?.resources ?? [], tp?.resources ?? []),
    risks: diffList(fp?.risks ?? [], tp?.risks ?? []),
  }
}
