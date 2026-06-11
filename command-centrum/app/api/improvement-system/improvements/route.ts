import { NextResponse } from 'next/server'
import {
  createImprovementProposal,
  getImprovementDashboard,
  updateImprovementStatus,
} from '@/lib/improvement-system/store'
import type { ImprovementStatus } from '@/lib/improvement-system/types'

const statuses: ImprovementStatus[] = ['open', 'selected', 'in_progress', 'done', 'archived']

export async function GET() {
  try {
    return NextResponse.json(getImprovementDashboard())
  } catch (error) {
    console.error('[improvement-system] GET:', error)
    return NextResponse.json({ error: 'Failed to load improvement dashboard' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const proposal = createImprovementProposal({
      title: typeof body?.title === 'string' ? body.title : undefined,
      sourceSection: typeof body?.sourceSection === 'string' ? body.sourceSection : undefined,
      route: typeof body?.route === 'string' ? body.route : undefined,
      snapshot: typeof body?.snapshot === 'string' ? body.snapshot : undefined,
      createdFrom: body?.createdFrom === 'manual' ? 'manual' : 'section-trigger',
    })

    return NextResponse.json({ proposal, dashboard: getImprovementDashboard() }, { status: 201 })
  } catch (error) {
    console.error('[improvement-system] POST:', error)
    return NextResponse.json({ error: 'Failed to create improvement proposal' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const id = typeof body?.id === 'string' ? body.id : ''
    const status = body?.status as ImprovementStatus

    if (!id || !statuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid improvement status payload' }, { status: 400 })
    }

    const proposal = updateImprovementStatus(id, status)
    if (!proposal) {
      return NextResponse.json({ error: 'Improvement proposal not found' }, { status: 404 })
    }

    return NextResponse.json({ proposal, dashboard: getImprovementDashboard() })
  } catch (error) {
    console.error('[improvement-system] PATCH:', error)
    return NextResponse.json({ error: 'Failed to update improvement proposal' }, { status: 500 })
  }
}
