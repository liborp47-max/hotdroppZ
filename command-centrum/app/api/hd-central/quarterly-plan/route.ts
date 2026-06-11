import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'
import { requireAdmin } from '@/lib/hd-central/auth-guard'
import type {
  Milestone,
  MilestoneStatus,
  QuarterlyPlan,
  QuarterlyPlanDoc,
  QuarterlyPlanStatus,
  ResourceAllocation,
  Risk,
  RiskLikelihood,
  RiskSeverity,
} from '@/lib/hd-central/types'
import { recordPlanSnapshot } from '@/lib/hd-central/quarterly-plan-snapshots'

// PLAN HQ — Quarterly Plan CRUD. Collection of per-quarter plans, JSON-backed
// (NOTES/quarterly-plans.json), following the primary-mission/plan conventions.

const FILE = path.join(process.cwd(), '..', 'NOTES', 'quarterly-plans.json')

function emptyDoc(): QuarterlyPlanDoc {
  return { version: 1, updatedAt: new Date().toISOString(), plans: [] }
}

function readDoc(): QuarterlyPlanDoc {
  if (!fs.existsSync(FILE)) return emptyDoc()
  try {
    const parsed = JSON.parse(fs.readFileSync(FILE, 'utf-8')) as QuarterlyPlanDoc
    return {
      version: typeof parsed.version === 'number' ? parsed.version : 1,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
      plans: Array.isArray(parsed.plans) ? parsed.plans : [],
    }
  } catch {
    return emptyDoc()
  }
}

function writeDoc(plans: QuarterlyPlan[]): QuarterlyPlanDoc {
  const doc: QuarterlyPlanDoc = { version: 1, updatedAt: new Date().toISOString(), plans }
  const dir = path.dirname(FILE)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(FILE, JSON.stringify(doc, null, 2), 'utf-8')
  return doc
}

// ─── sanitizers — never trust client payloads ───────────────────────────────

function asString(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback
}

function oneOf<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : fallback
}

function clampPercent(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n)) return 0
  return Math.min(100, Math.max(0, Math.round(n)))
}

const MILESTONE_STATUS: readonly MilestoneStatus[] = ['planned', 'in_progress', 'done', 'at_risk']
const PLAN_STATUS: readonly QuarterlyPlanStatus[] = ['draft', 'active', 'archived']
const RISK_SEVERITY: readonly RiskSeverity[] = ['low', 'medium', 'high', 'critical']
const RISK_LIKELIHOOD: readonly RiskLikelihood[] = ['low', 'medium', 'high']

function normalizeMilestone(v: unknown): Milestone {
  const m = (v ?? {}) as Record<string, unknown>
  const okrId = asString(m.okrId)
  return {
    id: asString(m.id) || randomUUID(),
    title: asString(m.title),
    dueDate: asString(m.dueDate),
    status: oneOf(m.status, MILESTONE_STATUS, 'planned'),
    ...(okrId ? { okrId } : {}),
  }
}

function normalizeResource(v: unknown): ResourceAllocation {
  const r = (v ?? {}) as Record<string, unknown>
  const notes = asString(r.notes)
  return {
    id: asString(r.id) || randomUUID(),
    area: asString(r.area),
    owner: asString(r.owner),
    allocationPct: clampPercent(r.allocationPct),
    ...(notes ? { notes } : {}),
  }
}

function normalizeRisk(v: unknown): Risk {
  const r = (v ?? {}) as Record<string, unknown>
  return {
    id: asString(r.id) || randomUUID(),
    description: asString(r.description),
    severity: oneOf(r.severity, RISK_SEVERITY, 'medium'),
    likelihood: oneOf(r.likelihood, RISK_LIKELIHOOD, 'medium'),
    mitigation: asString(r.mitigation),
  }
}

/** Build a full QuarterlyPlan from raw input, preserving identity of an existing record. */
function normalizePlan(input: Record<string, unknown>, existing: QuarterlyPlan | null): QuarterlyPlan {
  const now = new Date().toISOString()
  return {
    id: existing?.id ?? (asString(input.id) || randomUUID()),
    quarter: asString(input.quarter),
    title: asString(input.title).trim(),
    objective: asString(input.objective),
    status: oneOf(input.status, PLAN_STATUS, 'draft'),
    milestones: Array.isArray(input.milestones) ? input.milestones.map(normalizeMilestone) : [],
    resources: Array.isArray(input.resources) ? input.resources.map(normalizeResource) : [],
    risks: Array.isArray(input.risks) ? input.risks.map(normalizeRisk) : [],
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  }
}

// ─── handlers ────────────────────────────────────────────────────────────────

// GET — list all quarterly plans.
export async function GET(request: Request) {
  const auth = await requireAdmin(request)
  if (auth instanceof NextResponse) return auth
  try {
    return NextResponse.json(readDoc())
  } catch (e) {
    console.error('[quarterly-plan] GET error:', e)
    return NextResponse.json({ error: 'Failed to load quarterly plans' }, { status: 500 })
  }
}

// POST — create a new quarterly plan.
export async function POST(request: Request) {
  const auth = await requireAdmin(request)
  if (auth instanceof NextResponse) return auth
  try {
    const body = (await request.json()) as Record<string, unknown>
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }
    if (!asString(body.title).trim()) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 })
    }
    const current = readDoc()
    const plan = normalizePlan({ ...body, id: undefined }, null)
    const doc = writeDoc([...current.plans, plan])
    recordPlanSnapshot(plan, 'created', {
      planId: plan.id,
      quarter: plan.quarter,
      actor: auth.user.email ?? auth.user.id,
    })
    return NextResponse.json({ doc, plan }, { status: 201 })
  } catch (e) {
    console.error('[quarterly-plan] POST error:', e)
    return NextResponse.json({ error: 'Failed to create quarterly plan' }, { status: 500 })
  }
}

// PUT — full update of an existing quarterly plan (body.id required).
export async function PUT(request: Request) {
  const auth = await requireAdmin(request)
  if (auth instanceof NextResponse) return auth
  try {
    const body = (await request.json()) as Record<string, unknown>
    if (!body || typeof body !== 'object' || !asString(body.id)) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }
    if (!asString(body.title).trim()) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 })
    }
    const current = readDoc()
    const existing = current.plans.find((p) => p.id === body.id)
    if (!existing) {
      return NextResponse.json({ error: 'Quarterly plan not found' }, { status: 404 })
    }
    const updated = normalizePlan(body, existing)
    const doc = writeDoc(current.plans.map((p) => (p.id === updated.id ? updated : p)))
    recordPlanSnapshot(updated, 'updated', {
      planId: updated.id,
      quarter: updated.quarter,
      actor: auth.user.email ?? auth.user.id,
    })
    return NextResponse.json({ doc, plan: updated })
  } catch (e) {
    console.error('[quarterly-plan] PUT error:', e)
    return NextResponse.json({ error: 'Failed to update quarterly plan' }, { status: 500 })
  }
}

// DELETE — remove a quarterly plan by id (?id=...).
export async function DELETE(request: Request) {
  const auth = await requireAdmin(request)
  if (auth instanceof NextResponse) return auth
  try {
    const id = new URL(request.url).searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'id query param is required' }, { status: 400 })
    }
    const current = readDoc()
    const removed = current.plans.find((p) => p.id === id)
    const next = current.plans.filter((p) => p.id !== id)
    if (next.length === current.plans.length) {
      return NextResponse.json({ error: 'Quarterly plan not found' }, { status: 404 })
    }
    const doc = writeDoc(next)
    recordPlanSnapshot(null, 'deleted', {
      planId: id,
      quarter: removed?.quarter ?? '',
      actor: auth.user.email ?? auth.user.id,
    })
    return NextResponse.json(doc)
  } catch (e) {
    console.error('[quarterly-plan] DELETE error:', e)
    return NextResponse.json({ error: 'Failed to delete quarterly plan' }, { status: 500 })
  }
}
